import {
  CellTypeId,
  CompareOp,
  EmitArea,
  GlobalVarId,
  GraphNode,
  GraphScope,
  InterfaceId,
  NodeGraph,
  NotificationSeverity,
  OpenInterfaceRequest,
  RuntimeValue,
  SupplyId,
  UiCondition,
} from './types';

// ============================================================================
// Load-Time Graph Compiler
// ============================================================================

export interface CompiledEdgeTarget {
  nodeId: string;
  port: string;
}

export interface CompiledGraph {
  scope: GraphScope;
  nodes: Map<string, GraphNode>;
  /** `${fromNode}:${fromPort}` -> list of exec targets in edge order */
  execOut: Map<string, CompiledEdgeTarget[]>;
  /** `${toNode}:${toPort}` -> single data source */
  dataIn: Map<string, { nodeId: string; port: string }>;
  /** Entry nodes indexed by node.type (e.g. 'event.click', 'event.cycle') */
  entriesByType: Map<string, GraphNode[]>;
  /** Interface action entry nodes indexed by actionId */
  uiActionsById: Map<string, GraphNode[]>;
}

export function compileGraph(graph: NodeGraph, scope: GraphScope): CompiledGraph {
  const nodes = new Map<string, GraphNode>();
  const execOut = new Map<string, CompiledEdgeTarget[]>();
  const dataIn = new Map<string, { nodeId: string; port: string }>();
  const entriesByType = new Map<string, GraphNode[]>();
  const uiActionsById = new Map<string, GraphNode[]>();

  for (const node of graph.nodes) {
    nodes.set(node.id, node);
    if (node.type.startsWith('event.')) {
      const list = entriesByType.get(node.type) ?? [];
      list.push(node);
      entriesByType.set(node.type, list);
      if (node.type === 'event.uiAction') {
        const actionId = String(node.data?.actionId ?? '');
        if (actionId) {
          const actionList = uiActionsById.get(actionId) ?? [];
          actionList.push(node);
          uiActionsById.set(actionId, actionList);
        }
      }
    }
  }

  for (const edge of graph.edges) {
    const outKey = `${edge.fromNode}:${edge.fromPort}`;
    const list = execOut.get(outKey) ?? [];
    list.push({ nodeId: edge.toNode, port: edge.toPort });
    execOut.set(outKey, list);

    const inKey = `${edge.toNode}:${edge.toPort}`;
    dataIn.set(inKey, { nodeId: edge.fromNode, port: edge.fromPort });
  }

  return {
    scope,
    nodes,
    execOut,
    dataIn,
    entriesByType,
    uiActionsById,
  };
}

// ============================================================================
// Execution Context & Host Interface
// ============================================================================

export interface GraphExecutionContext {
  scope: GraphScope;
  cycle: number;
  x?: number;
  y?: number;
  cellTypeId?: CellTypeId;
  cellTypeName?: string;
  /** Event payload values (e.g., from/to/reason for enter/exit, value for uiAction) */
  eventData?: Record<string, RuntimeValue>;
  /** Params passed into an open interface */
  uiParams?: Record<string, unknown>;
}

export interface GraphVmHost {
  // Setup & RNG
  getSetupParam(paramId: string): RuntimeValue;
  random(): number;

  // GlobalState (access control enforced inside host/VM)
  getGlobal(varId: GlobalVarId, scope: GraphScope): RuntimeValue;
  getGlobalCap(varId: GlobalVarId, scope: GraphScope): number;
  getGlobalVarName(varId: GlobalVarId): string;
  setGlobal(varId: GlobalVarId, value: RuntimeValue, scope: GraphScope): void;
  addGlobal(varId: GlobalVarId, amount: number, scope: GraphScope): void;
  consumeGlobal(varId: GlobalVarId, amount: number, scope: GraphScope): boolean;
  addGlobalCap(varId: GlobalVarId, delta: number, scope: GraphScope): void;

  // Cell State & Visuals & Lifecycle
  getCellState(x: number, y: number, key: string, scope: GraphScope): RuntimeValue;
  setCellState(x: number, y: number, key: string, value: RuntimeValue, scope: GraphScope): void;
  addCellState(x: number, y: number, key: string, amount: number, scope: GraphScope): void;
  setCellSprite(x: number, y: number, spriteId: string | null): void;
  setCellColor(x: number, y: number, color: string | null): void;
  setCellOpacity(x: number, y: number, opacity: number): void;
  transformCell(x: number, y: number, toId: CellTypeId, reason: string): void;

  // Unified Numeric Supplies
  getSupply(x: number, y: number, supplyId: SupplyId): number;
  emitSupply(
    x: number,
    y: number,
    supplyId: SupplyId,
    amount: number,
    area: EmitArea,
    includeSelf: boolean
  ): void;
  consumeSupply(x: number, y: number, supplyId: SupplyId, amount: number): boolean;

  // World Utilities
  reclaimCellState(
    stateKey: string,
    amount: number,
    options?: {
      resetVisualToDefault?: boolean;
      setStateOnAffected?: Record<string, RuntimeValue>;
    }
  ): number;

  // Notifications
  pushGlobalNotification(
    severity: NotificationSeverity,
    title: string,
    message: string
  ): void;
  pushCellNotification(
    x: number,
    y: number,
    severity: NotificationSeverity,
    title: string,
    message: string
  ): void;
  clearCellNotifications(x: number, y: number): void;
}

export interface GraphExecutionResult {
  mutated: boolean;
  /** Non-null if execution paused at a `ui.openInterface` node */
  pausedOpenInterface?: {
    nodeId: string;
    request: OpenInterfaceRequest;
  };
  /** Set if an interface graph hit `ui.closeInterface` */
  closedInterface?: {
    hasResult: boolean;
    result?: RuntimeValue;
  };
}

const MAX_EXEC_STEPS = 2048;

export function compareValues(a: RuntimeValue, op: CompareOp, b: RuntimeValue): boolean {
  switch (op) {
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case '>':
      return Number(a) > Number(b);
    case '>=':
      return Number(a) >= Number(b);
    case '<':
      return Number(a) < Number(b);
    case '<=':
      return Number(a) <= Number(b);
  }
}

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v !== '' && v !== 'false' && v !== '0';
  return Boolean(v);
}

function toStr(v: unknown, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  return String(v);
}

// ============================================================================
// Graph VM Runner
// ============================================================================

class GraphVmSession {
  private steps = 0;
  private mutated = false;
  private pausedOpenInterface?: { nodeId: string; request: OpenInterfaceRequest };
  private closedInterface?: { hasResult: boolean; result?: RuntimeValue };
  /** Output values produced by impure/event nodes (e.g., event.enter -> reason, ui.openInterface -> result, world.reclaimCellState -> reclaimed) */
  private runtimeOutputs = new Map<string, RuntimeValue>();
  /** Per-step memo cache for pure data nodes (cleared after mutations so reads stay fresh) */
  private pureCache = new Map<string, RuntimeValue>();

  constructor(
    private readonly compiled: CompiledGraph,
    private readonly ctx: GraphExecutionContext,
    private readonly host: GraphVmHost
  ) {}

  setRuntimeOutput(nodeId: string, port: string, value: RuntimeValue): void {
    this.runtimeOutputs.set(`${nodeId}:${port}`, value);
  }

  runFromOutputPin(fromNodeId: string, fromPort: string): GraphExecutionResult {
    const targets = this.compiled.execOut.get(`${fromNodeId}:${fromPort}`);
    if (targets) {
      for (const target of targets) {
        this.executeNode(target.nodeId);
        if (this.pausedOpenInterface || this.closedInterface) break;
      }
    }
    return {
      mutated: this.mutated,
      pausedOpenInterface: this.pausedOpenInterface,
      closedInterface: this.closedInterface,
    };
  }

  private clearPureCache(): void {
    this.pureCache.clear();
  }

  private readInput(
    nodeId: string,
    port: string,
    fallback: RuntimeValue = 0,
    visiting = new Set<string>()
  ): RuntimeValue {
    const src = this.compiled.dataIn.get(`${nodeId}:${port}`);
    if (!src) {
      const node = this.compiled.nodes.get(nodeId);
      const dataVal = node?.data?.[port];
      if (dataVal !== undefined && dataVal !== null) {
        return dataVal as RuntimeValue;
      }
      return fallback;
    }
    return this.evalOutput(src.nodeId, src.port, visiting);
  }

  private evalOutput(
    nodeId: string,
    port: string,
    visiting: Set<string>
  ): RuntimeValue {
    const key = `${nodeId}:${port}`;
    if (this.runtimeOutputs.has(key)) {
      return this.runtimeOutputs.get(key)!;
    }
    if (this.pureCache.has(key)) {
      return this.pureCache.get(key)!;
    }
    if (visiting.has(key)) {
      return 0; // Guard against accidental data cycles
    }

    const node = this.compiled.nodes.get(nodeId);
    if (!node) return 0;

    visiting.add(key);
    const val = this.computePureNodeOutput(node, port, visiting);
    visiting.delete(key);

    this.pureCache.set(key, val);
    return val;
  }

  private computePureNodeOutput(
    node: GraphNode,
    port: string,
    visiting: Set<string>
  ): RuntimeValue {
    const data = node.data ?? {};

    switch (node.type) {
      // Event output pins (if queried)
      case 'event.enter':
      case 'event.exit':
      case 'event.uiAction':
        return this.ctx.eventData?.[port] ?? '';

      case 'const.value':
        return (data.value as RuntimeValue) ?? 0;

      case 'get.setupParam':
        return this.host.getSetupParam(toStr(data.paramId));

      case 'get.cycle':
        return this.ctx.cycle;

      case 'get.cellPos':
        return port === 'x' ? (this.ctx.x ?? 0) : (this.ctx.y ?? 0);

      case 'get.cellType':
        return port === 'name'
          ? (this.ctx.cellTypeName ?? '')
          : (this.ctx.cellTypeId ?? '');

      case 'get.uiParam': {
        const raw = this.ctx.uiParams?.[toStr(data.key)];
        if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string') {
          return raw;
        }
        return '';
      }

      case 'get.globalVarName': {
        const varId = toStr(this.readInput(node.id, 'varId', toStr(data.varId), visiting));
        return this.host.getGlobalVarName(varId);
      }

      case 'math.op': {
        const a = toNumber(this.readInput(node.id, 'a', toNumber(data.a, 0), visiting));
        const b = toNumber(this.readInput(node.id, 'b', toNumber(data.b, 0), visiting));
        switch (data.op) {
          case 'add':
            return a + b;
          case 'sub':
            return a - b;
          case 'mul':
            return a * b;
          case 'div':
            return b === 0 ? 0 : a / b;
          case 'min':
            return Math.min(a, b);
          case 'max':
            return Math.max(a, b);
          case 'mod':
            return b === 0 ? 0 : a % b;
          default:
            return a + b;
        }
      }

      case 'math.clamp': {
        const v = toNumber(this.readInput(node.id, 'value', 0, visiting));
        const min = toNumber(this.readInput(node.id, 'min', toNumber(data.min, 0), visiting));
        const max = toNumber(this.readInput(node.id, 'max', toNumber(data.max, 100), visiting));
        return Math.max(min, Math.min(max, v));
      }

      case 'math.round': {
        const v = toNumber(this.readInput(node.id, 'value', 0, visiting));
        if (data.mode === 'ceil') return Math.ceil(v);
        if (data.mode === 'round') return Math.round(v);
        return Math.floor(v);
      }

      case 'logic.compare': {
        const a = this.readInput(node.id, 'a', (data.a as RuntimeValue) ?? 0, visiting);
        const b = this.readInput(node.id, 'b', (data.b as RuntimeValue) ?? 0, visiting);
        return compareValues(a, (data.op as CompareOp) ?? '==', b);
      }

      case 'logic.bool': {
        const op = data.op ?? 'and';
        const a = toBool(this.readInput(node.id, 'a', false, visiting));
        if (op === 'not') return !a;
        const b = toBool(this.readInput(node.id, 'b', false, visiting));
        return op === 'or' ? a || b : a && b;
      }

      case 'logic.select': {
        const cond = toBool(this.readInput(node.id, 'condition', false, visiting));
        return cond
          ? this.readInput(node.id, 'ifTrue', (data.ifTrue as RuntimeValue) ?? '', visiting)
          : this.readInput(node.id, 'ifFalse', (data.ifFalse as RuntimeValue) ?? '', visiting);
      }

      case 'string.format': {
        const template = toStr(data.template);
        const a = this.readInput(node.id, 'a', '', visiting);
        const b = this.readInput(node.id, 'b', '', visiting);
        const c = this.readInput(node.id, 'c', '', visiting);
        return template
          .replace(/\{a\}/g, String(a))
          .replace(/\{b\}/g, String(b))
          .replace(/\{c\}/g, String(c));
      }

      case 'global.get': {
        const varId = toStr(this.readInput(node.id, 'varId', toStr(data.varId), visiting));
        return this.host.getGlobal(varId, this.ctx.scope);
      }

      case 'global.getCap': {
        const varId = toStr(this.readInput(node.id, 'varId', toStr(data.varId), visiting));
        return this.host.getGlobalCap(varId, this.ctx.scope);
      }

      case 'cell.getState': {
        if (this.ctx.x === undefined || this.ctx.y === undefined) return 0;
        return this.host.getCellState(this.ctx.x, this.ctx.y, toStr(data.key), this.ctx.scope);
      }

      case 'supply.get': {
        if (this.ctx.x === undefined || this.ctx.y === undefined) return 0;
        return this.host.getSupply(this.ctx.x, this.ctx.y, toStr(data.supplyId));
      }

      default:
        return 0;
    }
  }

  private follow(nodeId: string, outPort: string): void {
    const targets = this.compiled.execOut.get(`${nodeId}:${outPort}`);
    if (!targets) return;
    for (const target of targets) {
      this.executeNode(target.nodeId);
      if (this.pausedOpenInterface || this.closedInterface) return;
    }
  }

  private executeNode(nodeId: string): void {
    if (this.pausedOpenInterface || this.closedInterface) return;
    if (++this.steps > MAX_EXEC_STEPS) {
      console.warn('[Gridbound VM] Execution step limit exceeded, halting graph.');
      return;
    }

    const node = this.compiled.nodes.get(nodeId);
    if (!node) return;
    const data = node.data ?? {};

    switch (node.type) {
      case 'flow.branch': {
        const cond = toBool(this.readInput(node.id, 'condition', false));
        this.follow(node.id, cond ? 'true' : 'false');
        return;
      }

      case 'flow.sequence': {
        this.follow(node.id, 'then0');
        if (this.pausedOpenInterface || this.closedInterface) return;
        this.follow(node.id, 'then1');
        if (this.pausedOpenInterface || this.closedInterface) return;
        this.follow(node.id, 'then2');
        if (this.pausedOpenInterface || this.closedInterface) return;
        this.follow(node.id, 'then3');
        return;
      }

      case 'flow.switchString': {
        const val = toStr(this.readInput(node.id, 'value', ''));
        const cases = Array.isArray(data.cases) ? (data.cases as string[]) : [];
        const idx = cases.indexOf(val);
        if (idx >= 0) {
          this.follow(node.id, `case_${idx}`);
        } else {
          this.follow(node.id, 'default');
        }
        return;
      }

      case 'flow.chance': {
        const prob = toNumber(this.readInput(node.id, 'probability', toNumber(data.probability, 0.5)));
        const passed = this.host.random() < prob;
        this.follow(node.id, passed ? 'pass' : 'fail');
        return;
      }

      case 'global.set': {
        const varId = toStr(this.readInput(node.id, 'varId', toStr(data.varId)));
        const val = this.readInput(node.id, 'value', (data.value as RuntimeValue) ?? 0);
        if (varId) {
          this.host.setGlobal(varId, val, this.ctx.scope);
          this.mutated = true;
          this.clearPureCache();
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'global.add': {
        const varId = toStr(this.readInput(node.id, 'varId', toStr(data.varId)));
        const amount = toNumber(this.readInput(node.id, 'amount', toNumber(data.amount, 0)));
        if (varId && amount !== 0) {
          this.host.addGlobal(varId, amount, this.ctx.scope);
          this.mutated = true;
          this.clearPureCache();
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'global.consume': {
        const varId = toStr(this.readInput(node.id, 'varId', toStr(data.varId)));
        const amount = toNumber(this.readInput(node.id, 'amount', toNumber(data.amount, 1)));
        const ok = varId ? this.host.consumeGlobal(varId, amount, this.ctx.scope) : false;
        if (ok) {
          this.mutated = true;
          this.clearPureCache();
          this.follow(node.id, 'out');
        } else {
          this.follow(node.id, 'insufficient');
        }
        return;
      }

      case 'global.addCap': {
        const varId = toStr(this.readInput(node.id, 'varId', toStr(data.varId)));
        const delta = toNumber(this.readInput(node.id, 'delta', toNumber(data.delta, 0)));
        if (varId && delta !== 0) {
          this.host.addGlobalCap(varId, delta, this.ctx.scope);
          this.mutated = true;
          this.clearPureCache();
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'cell.setState': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const key = toStr(data.key);
          const val = this.readInput(node.id, 'value', (data.value as RuntimeValue) ?? 0);
          if (key) {
            this.host.setCellState(this.ctx.x, this.ctx.y, key, val, this.ctx.scope);
            this.mutated = true;
            this.clearPureCache();
          }
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'cell.addState': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const key = toStr(data.key);
          const amount = toNumber(this.readInput(node.id, 'amount', toNumber(data.amount, 1)));
          if (key && amount !== 0) {
            this.host.addCellState(this.ctx.x, this.ctx.y, key, amount, this.ctx.scope);
            this.mutated = true;
            this.clearPureCache();
          }
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'cell.setSprite': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const raw = this.compiled.dataIn.has(`${node.id}:spriteId`)
            ? this.readInput(node.id, 'spriteId', '')
            : (data.spriteId as string | null | undefined);
          const spriteId = raw === null || raw === '' || raw === undefined ? null : String(raw);
          this.host.setCellSprite(this.ctx.x, this.ctx.y, spriteId);
          this.mutated = true;
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'cell.setColor': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const raw = this.compiled.dataIn.has(`${node.id}:color`)
            ? this.readInput(node.id, 'color', '')
            : (data.color as string | null | undefined);
          const color = raw === null || raw === '' || raw === undefined ? null : String(raw);
          this.host.setCellColor(this.ctx.x, this.ctx.y, color);
          this.mutated = true;
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'cell.setOpacity': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const opacity = Math.max(
            0,
            Math.min(1, toNumber(this.readInput(node.id, 'opacity', toNumber(data.opacity, 1))))
          );
          this.host.setCellOpacity(this.ctx.x, this.ctx.y, opacity);
          this.mutated = true;
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'cell.transform': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const toId = toStr(this.readInput(node.id, 'toId', toStr(data.toId)));
          const reason = toStr(this.readInput(node.id, 'reason', toStr(data.reason)));
          if (toId) {
            this.host.transformCell(this.ctx.x, this.ctx.y, toId, reason);
            this.mutated = true;
            this.clearPureCache();
          }
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'supply.emit': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const supplyId = toStr(data.supplyId);
          const amount = toNumber(this.readInput(node.id, 'amount', toNumber(data.amount, 1)));
          const area = (data.area as EmitArea) ?? { shape: 'self' };
          const includeSelf = data.includeSelf !== false;
          if (supplyId && amount > 0) {
            this.host.emitSupply(this.ctx.x, this.ctx.y, supplyId, amount, area, includeSelf);
            this.mutated = true;
          }
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'supply.consume': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const supplyId = toStr(data.supplyId);
          const amount = toNumber(this.readInput(node.id, 'amount', toNumber(data.amount, 1)));
          const ok = supplyId
            ? this.host.consumeSupply(this.ctx.x, this.ctx.y, supplyId, amount)
            : false;
          if (ok) {
            this.mutated = true;
            this.clearPureCache();
            this.follow(node.id, 'out');
          } else {
            this.follow(node.id, 'insufficient');
          }
        }
        return;
      }

      case 'world.reclaimCellState': {
        const stateKey = toStr(data.stateKey);
        const amount = toNumber(this.readInput(node.id, 'amount', toNumber(data.amount, 1)));
        const reclaimed = stateKey
          ? this.host.reclaimCellState(stateKey, amount, {
              resetVisualToDefault: Boolean(data.resetVisualToDefault),
              setStateOnAffected: data.setStateOnAffected as
                | Record<string, RuntimeValue>
                | undefined,
            })
          : 0;
        this.setRuntimeOutput(node.id, 'reclaimed', reclaimed);
        if (reclaimed > 0) {
          this.mutated = true;
          this.clearPureCache();
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'notify.global': {
        const severity = (data.severity as NotificationSeverity) ?? 'info';
        const title = toStr(this.readInput(node.id, 'title', toStr(data.title)));
        const message = toStr(this.readInput(node.id, 'message', toStr(data.message)));
        this.host.pushGlobalNotification(severity, title, message);
        this.mutated = true;
        this.follow(node.id, 'out');
        return;
      }

      case 'notify.cell': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const severity = (data.severity as NotificationSeverity) ?? 'warning';
          const title = toStr(this.readInput(node.id, 'title', toStr(data.title)));
          const message = toStr(this.readInput(node.id, 'message', toStr(data.message)));
          this.host.pushCellNotification(this.ctx.x, this.ctx.y, severity, title, message);
          this.mutated = true;
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'notify.clearCell': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          this.host.clearCellNotifications(this.ctx.x, this.ctx.y);
          this.mutated = true;
        }
        this.follow(node.id, 'out');
        return;
      }

      case 'ui.openInterface': {
        if (this.ctx.x !== undefined && this.ctx.y !== undefined) {
          const interfaceId = toStr(data.interfaceId) as InterfaceId;
          const params = (data.params as Record<string, unknown>) ?? {};
          if (interfaceId) {
            this.pausedOpenInterface = {
              nodeId: node.id,
              request: {
                interfaceId,
                cellX: this.ctx.x,
                cellY: this.ctx.y,
                params,
              },
            };
            return; // Pause execution until interface closes with result/cancel
          }
        }
        this.follow(node.id, 'onCancel');
        return;
      }

      case 'ui.closeInterface': {
        const hasResultEdge = this.compiled.dataIn.has(`${node.id}:result`);
        const hasResultData = data.result !== undefined;
        const result = hasResultEdge
          ? this.readInput(node.id, 'result', '')
          : hasResultData
            ? (data.result as RuntimeValue)
            : undefined;
        this.closedInterface = {
          hasResult: hasResultEdge || hasResultData,
          result,
        };
        return;
      }

      default:
        return;
    }
  }
}

export function executeGraphEntry(
  compiled: CompiledGraph,
  entryNodeType: string,
  execPin: string,
  ctx: GraphExecutionContext,
  host: GraphVmHost,
  uiActionId?: string
): GraphExecutionResult {
  const entries =
    entryNodeType === 'event.uiAction' && uiActionId
      ? compiled.uiActionsById.get(uiActionId)
      : compiled.entriesByType.get(entryNodeType);

  if (!entries || entries.length === 0) {
    return { mutated: false };
  }

  let mutated = false;
  for (const entry of entries) {
    const session = new GraphVmSession(compiled, ctx, host);
    if (ctx.eventData) {
      for (const [k, v] of Object.entries(ctx.eventData)) {
        session.setRuntimeOutput(entry.id, k, v);
      }
    }
    const res = session.runFromOutputPin(entry.id, execPin);
    if (res.mutated) mutated = true;
    if (res.pausedOpenInterface || res.closedInterface) {
      return { ...res, mutated };
    }
  }

  return { mutated };
}

export function resumeGraphFromInterface(
  compiled: CompiledGraph,
  nodeId: string,
  outcome: 'result' | 'cancel',
  resultValue: RuntimeValue | undefined,
  ctx: GraphExecutionContext,
  host: GraphVmHost
): GraphExecutionResult {
  const session = new GraphVmSession(compiled, ctx, host);
  if (outcome === 'result' && resultValue !== undefined) {
    session.setRuntimeOutput(nodeId, 'result', resultValue);
  }
  return session.runFromOutputPin(nodeId, outcome === 'result' ? 'onResult' : 'onCancel');
}

// ============================================================================
// UI Condition Evaluator & Template Formatter (Universal Interfaces)
// ============================================================================

export interface UiTemplateContext {
  cellName: string;
  cellTypeId: CellTypeId;
  getState: (key: string) => RuntimeValue;
  getGlobal: (varId: GlobalVarId) => RuntimeValue;
  getGlobalCap: (varId: GlobalVarId) => number;
  getGlobalVarName: (varId: GlobalVarId) => string;
  getSupply: (supplyId: SupplyId) => number;
  getSetup: (paramId: string) => RuntimeValue;
  params: Record<string, unknown>;
}

export function evaluateUiConditions(
  conditions: UiCondition[] | undefined,
  ctx: UiTemplateContext
): boolean {
  if (!conditions || conditions.length === 0) return true;
  for (const cond of conditions) {
    let actual: RuntimeValue;
    switch (cond.source) {
      case 'state':
        actual = ctx.getState(cond.key);
        break;
      case 'global':
        actual = ctx.getGlobal(cond.key);
        break;
      case 'globalCap':
        actual = ctx.getGlobalCap(cond.key);
        break;
      case 'supply':
        actual = ctx.getSupply(cond.key);
        break;
      case 'setup':
        actual = ctx.getSetup(cond.key);
        break;
      case 'param': {
        const raw = ctx.params[cond.key];
        actual =
          typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string'
            ? raw
            : '';
        break;
      }
    }
    if (!compareValues(actual, cond.op, cond.value)) {
      return false;
    }
  }
  return true;
}

export function formatUiTemplate(template: string, ctx: UiTemplateContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, exprRaw: string) => {
    const expr = exprRaw.trim();
    if (expr === 'cell.name') return ctx.cellName;
    if (expr === 'cell.id') return ctx.cellTypeId;
    if (expr.startsWith('state.')) return String(ctx.getState(expr.slice(6)));
    if (expr.startsWith('global.')) return String(ctx.getGlobal(expr.slice(7)));
    if (expr.startsWith('globalCap.')) return String(ctx.getGlobalCap(expr.slice(10)));
    if (expr.startsWith('varNameFromState.')) {
      const varId = String(ctx.getState(expr.slice(17)));
      return varId ? ctx.getGlobalVarName(varId) : 'None';
    }
    if (expr.startsWith('supply.')) return String(ctx.getSupply(expr.slice(7)));
    if (expr.startsWith('setup.')) return String(ctx.getSetup(expr.slice(6)));
    if (expr.startsWith('param.')) {
      const val = ctx.params[expr.slice(6)];
      return val !== undefined && val !== null ? String(val) : '';
    }
    return '';
  });
}
