import {
  applyDecayRule,
  assertValidRuleset,
  CellRuntimeSnapshot,
  CellTypeId,
  CellTypeManifest,
  CellVisualState,
  CompiledGraph,
  compileGraph,
  createSeededRng,
  EmitArea,
  executeGraphEntry,
  GameNotification,
  generateRandomSeed,
  GlobalVarId,
  GlobalVariableManifest,
  GraphExecutionResult,
  GraphScope,
  GraphVmHost,
  InterfaceId,
  InterfaceManifest,
  NotificationSeverity,
  OpenInterfaceRequest,
  ResourceBreakdown,
  resumeGraphFromInterface,
  RulesetManifest,
  RuntimeValue,
  runWorldGeneratorGraph,
  SerializedSimulationState,
  SimulationStats,
  SpriteAssetManifest,
  SpriteId,
  StateFieldManifest,
  SupplyId,
  SupplyManifest,
  UiTemplateContext,
} from './sdk';

export interface ActiveInterfaceContinuation {
  compiled: CompiledGraph;
  scope: GraphScope;
  nodeId: string;
  cellX: number;
  cellY: number;
  cellTypeId: CellTypeId;
  cellTypeName: string;
  request: OpenInterfaceRequest;
}

export interface InteractionResult {
  mutated: boolean;
  uiRequest?: OpenInterfaceRequest;
  closeInterface?: boolean;
}

interface PendingTransform {
  idx: number;
  x: number;
  y: number;
  fromId: CellTypeId;
  toId: CellTypeId;
  reason: string;
}

interface CoreMutableState {
  grid: Uint16Array;
  cellStates: Map<number, Record<string, RuntimeValue>>;
  cellVisuals: Map<number, CellVisualState>;
  globalValues: Record<GlobalVarId, RuntimeValue>;
  globalCaps: Record<GlobalVarId, number>;
  supplies: Map<SupplyId, Int16Array>;
  notifications: GameNotification[];
  cycle: number;
}

const MAX_TRANSFORM_DEPTH = 16;

export class SimulationCore {
  public readonly manifest: RulesetManifest;
  public width: number;
  public height: number;
  public seed = '';
  public setupValues: Record<string, RuntimeValue> = {};

  // Indexed manifest lookups
  public readonly cellTypes: CellTypeManifest[];
  public readonly cellTypeById = new Map<CellTypeId, CellTypeManifest>();
  public readonly cellIndexById = new Map<CellTypeId, number>();
  public readonly globalVarById = new Map<GlobalVarId, GlobalVariableManifest>();
  public readonly supplyById = new Map<SupplyId, SupplyManifest>();
  public readonly spriteById = new Map<SpriteId, SpriteAssetManifest>();
  public readonly interfaceById = new Map<InterfaceId, InterfaceManifest>();

  // Load-time compiled graphs
  private readonly compiledGlobalGraph: CompiledGraph;
  private readonly compiledCellGraphs = new Map<CellTypeId, CompiledGraph>();
  private readonly compiledInterfaceGraphs = new Map<InterfaceId, CompiledGraph>();
  private readonly stateFieldMapByCell = new Map<
    CellTypeId,
    Map<string, StateFieldManifest>
  >();

  // Live mutable simulation state
  private state: CoreMutableState;
  private pendingContinuation: ActiveInterfaceContinuation | null = null;
  private stateVersion = 0;
  private cachedStatsVersion = -1;
  private cachedStats: SimulationStats | null = null;
  private rng = createSeededRng('init');
  private notifCounter = 0;
  private transformDepth = 0;

  constructor(rawManifest: RulesetManifest) {
    this.manifest = assertValidRuleset(rawManifest);
    this.width = this.manifest.defaultGridSize.width;
    this.height = this.manifest.defaultGridSize.height;

    this.cellTypes = this.manifest.cellTypes;
    this.cellTypes.forEach((ct, index) => {
      this.cellTypeById.set(ct.id, ct);
      this.cellIndexById.set(ct.id, index);
      this.compiledCellGraphs.set(ct.id, compileGraph(ct.graph, 'cell'));
      const fieldMap = new Map<string, StateFieldManifest>();
      for (const f of ct.stateSchema) {
        fieldMap.set(f.key, f);
      }
      this.stateFieldMapByCell.set(ct.id, fieldMap);
    });

    for (const v of this.manifest.globalState.variables) {
      this.globalVarById.set(v.id, v);
    }
    this.compiledGlobalGraph = compileGraph(this.manifest.globalState.graph, 'global');

    for (const s of this.manifest.supplies) {
      this.supplyById.set(s.id, s);
    }
    for (const sp of this.manifest.sprites) {
      this.spriteById.set(sp.id, sp);
    }
    for (const iface of this.manifest.interfaces) {
      this.interfaceById.set(iface.id, iface);
      if (iface.graph) {
        this.compiledInterfaceGraphs.set(iface.id, compileGraph(iface.graph, 'interface'));
      }
    }

    this.state = this.createEmptyState(this.width, this.height);
  }

  // ── Public Getters ───────────────────────────────────────────────────────

  get cycle(): number {
    return this.state.cycle;
  }

  get grid(): Uint16Array {
    return this.state.grid;
  }

  get notifications(): GameNotification[] {
    return this.state.notifications;
  }

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  public dismissNotification(id: string): void {
    const before = this.state.notifications.length;
    this.state.notifications = this.state.notifications.filter((n) => n.id !== id);
    if (this.state.notifications.length !== before) {
      this.bumpVersion();
    }
  }

  public getCellTypeAt(x: number, y: number): CellTypeManifest {
    const idx = y * this.width + x;
    return this.cellTypes[this.state.grid[idx]] ?? this.cellTypes[0];
  }

  public getCellVisualAt(x: number, y: number): CellVisualState {
    const idx = y * this.width + x;
    const existing = this.state.cellVisuals.get(idx);
    if (existing) return existing;
    const ct = this.getCellTypeAt(x, y);
    return {
      spriteId: ct.defaultSpriteId,
      tintColor: null,
      opacity: ct.defaultOpacity ?? 1,
    };
  }

  public getSupplyBuffer(supplyId: SupplyId): Int16Array | undefined {
    return this.state.supplies.get(supplyId);
  }

  public getSupplyAt(x: number, y: number, supplyId: SupplyId): number {
    const buf = this.state.supplies.get(supplyId);
    if (!buf) return 0;
    return buf[y * this.width + x] ?? 0;
  }

  public getGlobalValue(varId: GlobalVarId): RuntimeValue {
    return this.state.globalValues[varId] ?? 0;
  }

  public getGlobalCap(varId: GlobalVarId): number {
    return this.state.globalCaps[varId] ?? 0;
  }

  public getHoverInterfaceId(x: number, y: number): InterfaceId | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const ct = this.getCellTypeAt(x, y);
    if (ct.hoverInterfaceId !== undefined) {
      return ct.hoverInterfaceId;
    }
    return this.manifest.defaultHoverInterfaceId ?? null;
  }

  public getCellSnapshot(x: number, y: number): CellRuntimeSnapshot | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const idx = y * this.width + x;
    const ct = this.getCellTypeAt(x, y);
    const visual = this.getCellVisualAt(x, y);
    const stateObj = this.state.cellStates.get(idx);

    const visibleState = ct.stateSchema
      .filter((f) => f.access !== 'private')
      .map((f) => ({
        key: f.key,
        label: f.label ?? f.key,
        type: f.type,
        value: stateObj?.[f.key] ?? f.initialValue,
        access: f.access,
      }));

    const supplies = this.manifest.supplies.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      amount: this.getSupplyAt(x, y, s.id),
    }));

    return {
      x,
      y,
      cellType: ct,
      visual,
      visibleState,
      supplies,
    };
  }

  public getUiTemplateContext(
    x: number,
    y: number,
    params: Record<string, unknown> = {}
  ): UiTemplateContext {
    const ct = this.getCellTypeAt(x, y);
    return {
      cellName: ct.name,
      cellTypeId: ct.id,
      getState: (key) => this.readCellStateInternal(this.state, x, y, key, 'interface'),
      getGlobal: (varId) => this.readGlobalInternal(this.state, varId, 'interface'),
      getGlobalCap: (varId) => this.readGlobalCapInternal(this.state, varId, 'interface'),
      getGlobalVarName: (varId) => this.globalVarById.get(varId)?.name ?? varId,
      getSupply: (supplyId) => this.getSupplyAt(x, y, supplyId),
      getSetup: (paramId) => this.setupValues[paramId] ?? 0,
      params,
    };
  }

  // ── Game Lifecycle ───────────────────────────────────────────────────────

  public createNewGame(options?: {
    width?: number;
    height?: number;
    seed?: string;
    setupParams?: Record<string, RuntimeValue>;
  }): void {
    this.width = options?.width ?? this.manifest.defaultGridSize.width;
    this.height = options?.height ?? this.manifest.defaultGridSize.height;
    this.seed = options?.seed?.trim() || generateRandomSeed();

    this.setupValues = {
      width: this.width,
      height: this.height,
      seed: this.seed,
    };
    for (const opt of this.manifest.setupOptions ?? []) {
      this.setupValues[opt.id] = options?.setupParams?.[opt.id] ?? opt.defaultValue;
    }

    this.rng = createSeededRng(`${this.seed}:sim`);
    this.pendingContinuation = null;
    this.state = this.createEmptyState(this.width, this.height);

    const defaultCellIndex = this.cellIndexById.get(this.manifest.defaultCellTypeId) ?? 0;
    runWorldGeneratorGraph(this.manifest.worldGenerator, this.state.grid, {
      width: this.width,
      height: this.height,
      seed: this.seed,
      setupValues: this.setupValues,
      cellIndexById: this.cellIndexById,
      defaultCellIndex,
    });

    // Initialize per-cell states & visuals from each cell type's defaults
    const size = this.width * this.height;
    for (let i = 0; i < size; i++) {
      const ct = this.cellTypes[this.state.grid[i]];
      this.initCellDefaults(this.state, i, ct);
    }

    // Run GlobalState On World Start
    const host = this.createHost(this.state, {
      immediateEmit: true,
      immediateTransform: true,
    });
    executeGraphEntry(
      this.compiledGlobalGraph,
      'event.worldStart',
      'out',
      { scope: 'global', cycle: 0 },
      host
    );

    // Run initial Supply phase pass so emitters (e.g. Water -> Moisture) show on Cycle 0
    this.runSupplyPhaseOnly(this.state);
    this.bumpVersion();
  }

  // ── 4-Phase Simulation Step ──────────────────────────────────────────────

  public step(): void {
    this.pendingContinuation = null;
    this.executeStepOnState(this.state, false);
    this.bumpVersion();
  }

  private executeStepOnState(
    target: CoreMutableState,
    trackBreakdown: boolean
  ): { breakdown: Record<GlobalVarId, ResourceBreakdown> } {
    const breakdown: Record<GlobalVarId, ResourceBreakdown> = {};
    if (trackBreakdown) {
      for (const v of this.manifest.globalState.variables) {
        if (v.type === 'number') {
          breakdown[v.id] = { gained: 0, consumed: 0 };
        }
      }
    }

    const nextCycle = target.cycle + 1;
    target.cycle = nextCycle;

    // ── Phase 1: Decay (Supplies + Decaying Global Variables) ──────────────
    for (const supply of this.manifest.supplies) {
      const buf = target.supplies.get(supply.id);
      if (!buf) continue;
      if (supply.decay.kind === 'clear') {
        buf.fill(0);
      } else if (supply.decay.kind !== 'none') {
        for (let i = 0; i < buf.length; i++) {
          if (buf[i] > 0) {
            buf[i] = applyDecayRule(buf[i], supply.decay);
          }
        }
      }
    }

    for (const v of this.manifest.globalState.variables) {
      if (v.type === 'number' && v.decay && v.decay.kind !== 'none') {
        const cur = Number(target.globalValues[v.id] ?? 0);
        if (cur > 0) {
          const decayed = applyDecayRule(cur, v.decay);
          const loss = cur - decayed;
          target.globalValues[v.id] = decayed;
          if (trackBreakdown && loss > 0) {
            breakdown[v.id].consumed += loss;
          }
        }
      }
    }

    // ── Phase 2: Supply Distribution (Simultaneous Buffering) ──────────────
    const phase2Emissions = this.createSupplyBufferMap(this.width * this.height);
    const phase2Host = this.createHost(target, {
      immediateEmit: false,
      emitStaging: phase2Emissions,
      immediateTransform: false,
      breakdown: trackBreakdown ? breakdown : undefined,
    });

    executeGraphEntry(
      this.compiledGlobalGraph,
      'event.worldCycle',
      'supply',
      { scope: 'global', cycle: nextCycle },
      phase2Host
    );

    const size = this.width * this.height;
    for (let i = 0; i < size; i++) {
      const ct = this.cellTypes[target.grid[i]];
      const compiled = this.compiledCellGraphs.get(ct.id);
      if (!compiled || !compiled.entriesByType.has('event.cycle')) continue;
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      executeGraphEntry(
        compiled,
        'event.cycle',
        'supply',
        {
          scope: 'cell',
          cycle: nextCycle,
          x,
          y,
          cellTypeId: ct.id,
          cellTypeName: ct.name,
        },
        phase2Host
      );
    }

    this.flushSupplyStaging(target, phase2Emissions);

    // ── Phase 3: Production (GlobalState + Cells) ──────────────────────────
    const phase3Transforms: PendingTransform[] = [];
    const phase3Host = this.createHost(target, {
      immediateEmit: true,
      immediateTransform: false,
      transformQueue: phase3Transforms,
      breakdown: trackBreakdown ? breakdown : undefined,
    });

    executeGraphEntry(
      this.compiledGlobalGraph,
      'event.worldCycle',
      'produce',
      { scope: 'global', cycle: nextCycle },
      phase3Host
    );

    for (let i = 0; i < size; i++) {
      const ct = this.cellTypes[target.grid[i]];
      const compiled = this.compiledCellGraphs.get(ct.id);
      if (!compiled || !compiled.entriesByType.has('event.cycle')) continue;
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      executeGraphEntry(
        compiled,
        'event.cycle',
        'produce',
        {
          scope: 'cell',
          cycle: nextCycle,
          x,
          y,
          cellTypeId: ct.id,
          cellTypeName: ct.name,
        },
        phase3Host
      );
    }

    // ── Phase 4: Consumption & Reactions (Prioritized) ─────────────────────
    // Refresh notifications fresh for this cycle
    target.notifications = [];

    const phase4Transforms: PendingTransform[] = [...phase3Transforms];
    const phase4Host = this.createHost(target, {
      immediateEmit: true,
      immediateTransform: false,
      transformQueue: phase4Transforms,
      breakdown: trackBreakdown ? breakdown : undefined,
    });

    executeGraphEntry(
      this.compiledGlobalGraph,
      'event.worldCycle',
      'react',
      { scope: 'global', cycle: nextCycle },
      phase4Host
    );

    // Build prioritized execution order for cells with event.cycle
    const reactOrder: { idx: number; priority: number }[] = [];
    for (let i = 0; i < size; i++) {
      const ct = this.cellTypes[target.grid[i]];
      const compiled = this.compiledCellGraphs.get(ct.id);
      if (!compiled || !compiled.entriesByType.has('event.cycle')) continue;
      let priority = 0;
      if (ct.priorityByState) {
        const st = target.cellStates.get(i);
        const raw = st?.[ct.priorityByState];
        priority = typeof raw === 'number' ? raw : 0;
      }
      reactOrder.push({ idx: i, priority });
    }
    reactOrder.sort((a, b) => b.priority - a.priority || a.idx - b.idx);

    for (const item of reactOrder) {
      const i = item.idx;
      const ct = this.cellTypes[target.grid[i]];
      const compiled = this.compiledCellGraphs.get(ct.id)!;
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      executeGraphEntry(
        compiled,
        'event.cycle',
        'react',
        {
          scope: 'cell',
          cycle: nextCycle,
          x,
          y,
          cellTypeId: ct.id,
          cellTypeName: ct.name,
        },
        phase4Host
      );
    }

    // Commit queued cell transformations (onExit -> replace -> onEnter)
    for (const tr of phase4Transforms) {
      this.applyTransformInternal(
        target,
        tr.x,
        tr.y,
        tr.toId,
        tr.reason,
        trackBreakdown ? breakdown : undefined
      );
    }

    return { breakdown };
  }

  private runSupplyPhaseOnly(target: CoreMutableState): void {
    const staging = this.createSupplyBufferMap(this.width * this.height);
    const host = this.createHost(target, {
      immediateEmit: false,
      emitStaging: staging,
      immediateTransform: false,
    });

    executeGraphEntry(
      this.compiledGlobalGraph,
      'event.worldCycle',
      'supply',
      { scope: 'global', cycle: target.cycle },
      host
    );

    const size = this.width * this.height;
    for (let i = 0; i < size; i++) {
      const ct = this.cellTypes[target.grid[i]];
      const compiled = this.compiledCellGraphs.get(ct.id);
      if (!compiled || !compiled.entriesByType.has('event.cycle')) continue;
      executeGraphEntry(
        compiled,
        'event.cycle',
        'supply',
        {
          scope: 'cell',
          cycle: target.cycle,
          x: i % this.width,
          y: Math.floor(i / this.width),
          cellTypeId: ct.id,
          cellTypeName: ct.name,
        },
        host
      );
    }

    this.flushSupplyStaging(target, staging);
  }

  // ── Player Interaction & Interface Continuations ─────────────────────────

  public handleCellClick(
    x: number,
    y: number,
    button: 'left' | 'right'
  ): InteractionResult {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return { mutated: false };
    }
    this.pendingContinuation = null;

    const ct = this.getCellTypeAt(x, y);
    const compiled = this.compiledCellGraphs.get(ct.id);
    if (!compiled) return { mutated: false };

    const host = this.createHost(this.state, {
      immediateEmit: true,
      immediateTransform: true,
    });

    const res = executeGraphEntry(
      compiled,
      'event.click',
      button,
      {
        scope: 'cell',
        cycle: this.state.cycle,
        x,
        y,
        cellTypeId: ct.id,
        cellTypeName: ct.name,
      },
      host
    );

    return this.finalizeInteraction(res, compiled, 'cell', x, y, ct.id, ct.name);
  }

  public resolveActiveInterface(result: RuntimeValue): InteractionResult {
    const cont = this.pendingContinuation;
    this.pendingContinuation = null;
    if (!cont) return { mutated: false, closeInterface: true };

    const host = this.createHost(this.state, {
      immediateEmit: true,
      immediateTransform: true,
    });

    const res = resumeGraphFromInterface(
      cont.compiled,
      cont.nodeId,
      'result',
      result,
      {
        scope: cont.scope,
        cycle: this.state.cycle,
        x: cont.cellX,
        y: cont.cellY,
        cellTypeId: cont.cellTypeId,
        cellTypeName: cont.cellTypeName,
      },
      host
    );

    return this.finalizeInteraction(
      res,
      cont.compiled,
      cont.scope,
      cont.cellX,
      cont.cellY,
      cont.cellTypeId,
      cont.cellTypeName
    );
  }

  public cancelActiveInterface(): InteractionResult {
    const cont = this.pendingContinuation;
    this.pendingContinuation = null;
    if (!cont) return { mutated: false, closeInterface: true };

    const host = this.createHost(this.state, {
      immediateEmit: true,
      immediateTransform: true,
    });

    const res = resumeGraphFromInterface(
      cont.compiled,
      cont.nodeId,
      'cancel',
      undefined,
      {
        scope: cont.scope,
        cycle: this.state.cycle,
        x: cont.cellX,
        y: cont.cellY,
        cellTypeId: cont.cellTypeId,
        cellTypeName: cont.cellTypeName,
      },
      host
    );

    return this.finalizeInteraction(
      res,
      cont.compiled,
      cont.scope,
      cont.cellX,
      cont.cellY,
      cont.cellTypeId,
      cont.cellTypeName
    );
  }

  public triggerInterfaceAction(
    interfaceId: InterfaceId,
    actionId: string,
    cellX: number,
    cellY: number,
    params: Record<string, unknown>,
    value?: RuntimeValue
  ): InteractionResult {
    const compiled = this.compiledInterfaceGraphs.get(interfaceId);
    if (!compiled) return { mutated: false };

    const ct = this.getCellTypeAt(cellX, cellY);
    const host = this.createHost(this.state, {
      immediateEmit: true,
      immediateTransform: true,
    });

    const res = executeGraphEntry(
      compiled,
      'event.uiAction',
      'out',
      {
        scope: 'interface',
        cycle: this.state.cycle,
        x: cellX,
        y: cellY,
        cellTypeId: ct.id,
        cellTypeName: ct.name,
        eventData: value !== undefined ? { value } : {},
        uiParams: params,
      },
      host,
      actionId
    );

    if (res.mutated) {
      this.bumpVersion();
    }

    if (res.closedInterface) {
      if (this.pendingContinuation) {
        if (res.closedInterface.hasResult && res.closedInterface.result !== undefined) {
          const contRes = this.resolveActiveInterface(res.closedInterface.result);
          return {
            mutated: res.mutated || contRes.mutated,
            uiRequest: contRes.uiRequest,
            closeInterface: !contRes.uiRequest,
          };
        } else {
          const contRes = this.cancelActiveInterface();
          return {
            mutated: res.mutated || contRes.mutated,
            uiRequest: contRes.uiRequest,
            closeInterface: !contRes.uiRequest,
          };
        }
      }
      return { mutated: res.mutated, closeInterface: true };
    }

    if (res.pausedOpenInterface) {
      this.pendingContinuation = {
        compiled,
        scope: 'interface',
        nodeId: res.pausedOpenInterface.nodeId,
        cellX,
        cellY,
        cellTypeId: ct.id,
        cellTypeName: ct.name,
        request: res.pausedOpenInterface.request,
      };
      return {
        mutated: res.mutated,
        uiRequest: res.pausedOpenInterface.request,
      };
    }

    return { mutated: res.mutated };
  }

  private finalizeInteraction(
    res: GraphExecutionResult,
    compiled: CompiledGraph,
    scope: GraphScope,
    cellX: number,
    cellY: number,
    cellTypeId: CellTypeId,
    cellTypeName: string
  ): InteractionResult {
    if (res.mutated) {
      this.bumpVersion();
    }
    if (res.pausedOpenInterface) {
      this.pendingContinuation = {
        compiled,
        scope,
        nodeId: res.pausedOpenInterface.nodeId,
        cellX,
        cellY,
        cellTypeId,
        cellTypeName,
        request: res.pausedOpenInterface.request,
      };
      return {
        mutated: res.mutated,
        uiRequest: res.pausedOpenInterface.request,
      };
    }
    return { mutated: res.mutated, closeInterface: true };
  }

  // ── Direct Transformation (Public API & Tests) ───────────────────────────

  public transformCell(
    x: number,
    y: number,
    toId: CellTypeId,
    reason = ''
  ): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const ok = this.applyTransformInternal(this.state, x, y, toId, reason);
    if (ok) this.bumpVersion();
    return ok;
  }

  private applyTransformInternal(
    target: CoreMutableState,
    x: number,
    y: number,
    toId: CellTypeId,
    reason: string,
    breakdown?: Record<GlobalVarId, ResourceBreakdown>
  ): boolean {
    const toIndex = this.cellIndexById.get(toId);
    if (toIndex === undefined) return false;
    if (this.transformDepth >= MAX_TRANSFORM_DEPTH) return false;

    const idx = y * this.width + x;
    const oldIndex = target.grid[idx];
    const oldType = this.cellTypes[oldIndex];
    const newType = this.cellTypes[toIndex];

    this.transformDepth++;
    try {
      // 1. Run On Exit on old cell type (while old cell state is still intact!)
      const exitHost = this.createHost(target, {
        immediateEmit: true,
        immediateTransform: true,
        breakdown,
      });
      const oldCompiled = this.compiledCellGraphs.get(oldType.id);
      if (oldCompiled) {
        executeGraphEntry(
          oldCompiled,
          'event.exit',
          'out',
          {
            scope: 'cell',
            cycle: target.cycle,
            x,
            y,
            cellTypeId: oldType.id,
            cellTypeName: oldType.name,
            eventData: { from: oldType.id, to: newType.id, reason },
          },
          exitHost
        );
      }

      // 2. Replace cell on grid, clear old cell notifications, reset state & visuals
      target.grid[idx] = toIndex;
      target.notifications = target.notifications.filter(
        (n) => !(n.scope === 'cell' && n.x === x && n.y === y)
      );
      this.initCellDefaults(target, idx, newType);

      // 3. Run On Enter on new cell type
      const newCompiled = this.compiledCellGraphs.get(newType.id);
      if (newCompiled) {
        executeGraphEntry(
          newCompiled,
          'event.enter',
          'out',
          {
            scope: 'cell',
            cycle: target.cycle,
            x,
            y,
            cellTypeId: newType.id,
            cellTypeName: newType.name,
            eventData: { from: oldType.id, to: newType.id, reason },
          },
          exitHost
        );
      }
      return true;
    } finally {
      this.transformDepth--;
    }
  }

  // ── Stats & Dry-Run Cycle Preview ────────────────────────────────────────

  public getStats(): SimulationStats {
    if (this.cachedStats && this.cachedStatsVersion === this.stateVersion) {
      return this.cachedStats;
    }

    const cellCounts: Record<CellTypeId, number> = {};
    for (const ct of this.cellTypes) {
      cellCounts[ct.id] = 0;
    }
    for (let i = 0; i < this.state.grid.length; i++) {
      const ct = this.cellTypes[this.state.grid[i]];
      if (ct) cellCounts[ct.id]++;
    }

    // Clone current state and run 1 virtual 4-phase cycle for accurate HUD preview
    const virtualState = this.cloneState(this.state);
    const { breakdown } = this.executeStepOnState(virtualState, true);

    const projectedDelta: Record<GlobalVarId, number> = {};
    for (const v of this.manifest.globalState.variables) {
      if (v.type === 'number') {
        const before = Number(this.state.globalValues[v.id] ?? 0);
        const after = Number(virtualState.globalValues[v.id] ?? 0);
        projectedDelta[v.id] = after - before;
      }
    }

    this.cachedStats = {
      cycle: this.state.cycle,
      globalValues: { ...this.state.globalValues },
      globalCaps: { ...this.state.globalCaps },
      projectedDelta,
      projectedBreakdown: breakdown,
      cellCounts,
    };
    this.cachedStatsVersion = this.stateVersion;
    return this.cachedStats;
  }

  // ── Serialization (v4) ───────────────────────────────────────────────────

  public serialize(): SerializedSimulationState {
    const gridIds: CellTypeId[] = new Array(this.state.grid.length);
    for (let i = 0; i < this.state.grid.length; i++) {
      gridIds[i] = this.cellTypes[this.state.grid[i]]?.id ?? this.manifest.defaultCellTypeId;
    }

    const cellStates: Record<string, Record<string, RuntimeValue>> = {};
    for (const [idx, st] of this.state.cellStates.entries()) {
      if (Object.keys(st).length > 0) {
        cellStates[String(idx)] = { ...st };
      }
    }

    const cellVisuals: Record<string, CellVisualState> = {};
    for (const [idx, vis] of this.state.cellVisuals.entries()) {
      cellVisuals[String(idx)] = { ...vis };
    }

    const supplies: Record<SupplyId, number[]> = {};
    for (const [sid, buf] of this.state.supplies.entries()) {
      supplies[sid] = Array.from(buf);
    }

    return {
      version: 4,
      rulesetId: this.manifest.id,
      width: this.width,
      height: this.height,
      cycle: this.state.cycle,
      seed: this.seed,
      setupValues: { ...this.setupValues },
      grid: gridIds,
      cellStates,
      cellVisuals,
      globalValues: { ...this.state.globalValues },
      globalCaps: { ...this.state.globalCaps },
      supplies,
      notifications: this.state.notifications.map((n) => ({ ...n })),
    };
  }

  public deserialize(snapshot: SerializedSimulationState): void {
    if (snapshot.version !== 4) {
      throw new Error(`Unsupported save version ${String(snapshot.version)}`);
    }

    this.width = snapshot.width;
    this.height = snapshot.height;
    this.seed = snapshot.seed;
    this.setupValues = { ...snapshot.setupValues };
    this.rng = createSeededRng(`${this.seed}:sim:${snapshot.cycle}`);
    this.pendingContinuation = null;

    const fresh = this.createEmptyState(this.width, this.height);
    fresh.cycle = snapshot.cycle;

    const defaultIdx = this.cellIndexById.get(this.manifest.defaultCellTypeId) ?? 0;
    for (let i = 0; i < fresh.grid.length; i++) {
      const id = snapshot.grid[i];
      const idx = this.cellIndexById.get(id) ?? defaultIdx;
      fresh.grid[i] = idx;
      this.initCellDefaults(fresh, i, this.cellTypes[idx]);
    }

    for (const [idxStr, st] of Object.entries(snapshot.cellStates ?? {})) {
      const idx = Number(idxStr);
      if (!Number.isNaN(idx) && idx >= 0 && idx < fresh.grid.length) {
        const existing = fresh.cellStates.get(idx) ?? {};
        fresh.cellStates.set(idx, { ...existing, ...st });
      }
    }

    for (const [idxStr, vis] of Object.entries(snapshot.cellVisuals ?? {})) {
      const idx = Number(idxStr);
      if (!Number.isNaN(idx) && idx >= 0 && idx < fresh.grid.length) {
        fresh.cellVisuals.set(idx, { ...vis });
      }
    }

    for (const v of this.manifest.globalState.variables) {
      if (snapshot.globalValues[v.id] !== undefined) {
        fresh.globalValues[v.id] = snapshot.globalValues[v.id];
      }
      if (v.hasCap && snapshot.globalCaps[v.id] !== undefined) {
        fresh.globalCaps[v.id] = snapshot.globalCaps[v.id];
      }
    }

    for (const s of this.manifest.supplies) {
      const arr = snapshot.supplies[s.id];
      const buf = fresh.supplies.get(s.id);
      if (arr && buf) {
        for (let i = 0; i < Math.min(arr.length, buf.length); i++) {
          buf[i] = arr[i];
        }
      }
    }

    fresh.notifications = (snapshot.notifications ?? []).map((n) => ({ ...n }));

    this.state = fresh;
    this.bumpVersion();
  }

  // ── Internal State & Host Helpers ────────────────────────────────────────

  private bumpVersion(): void {
    this.stateVersion++;
  }

  private createSupplyBufferMap(size: number): Map<SupplyId, Int16Array> {
    const map = new Map<SupplyId, Int16Array>();
    for (const s of this.manifest.supplies) {
      map.set(s.id, new Int16Array(size));
    }
    return map;
  }

  private flushSupplyStaging(
    target: CoreMutableState,
    staging: Map<SupplyId, Int16Array>
  ): void {
    for (const supply of this.manifest.supplies) {
      const src = staging.get(supply.id);
      const dst = target.supplies.get(supply.id);
      if (!src || !dst) continue;
      const cap = supply.maxAmount ?? 32000;
      for (let i = 0; i < dst.length; i++) {
        if (src[i] > 0) {
          dst[i] = Math.min(cap, dst[i] + src[i]);
        }
      }
    }
  }

  private createEmptyState(width: number, height: number): CoreMutableState {
    const size = width * height;
    const globalValues: Record<GlobalVarId, RuntimeValue> = {};
    const globalCaps: Record<GlobalVarId, number> = {};

    for (const v of this.manifest.globalState.variables) {
      globalValues[v.id] = v.initialValue;
      if (v.hasCap) {
        globalCaps[v.id] = v.initialMax ?? 0;
      }
    }

    return {
      grid: new Uint16Array(size),
      cellStates: new Map(),
      cellVisuals: new Map(),
      globalValues,
      globalCaps,
      supplies: this.createSupplyBufferMap(size),
      notifications: [],
      cycle: 0,
    };
  }

  private cloneState(src: CoreMutableState): CoreMutableState {
    const cellStates = new Map<number, Record<string, RuntimeValue>>();
    for (const [k, v] of src.cellStates.entries()) {
      cellStates.set(k, { ...v });
    }
    const cellVisuals = new Map<number, CellVisualState>();
    for (const [k, v] of src.cellVisuals.entries()) {
      cellVisuals.set(k, { ...v });
    }
    const supplies = new Map<SupplyId, Int16Array>();
    for (const [k, v] of src.supplies.entries()) {
      supplies.set(k, new Int16Array(v));
    }
    return {
      grid: new Uint16Array(src.grid),
      cellStates,
      cellVisuals,
      globalValues: { ...src.globalValues },
      globalCaps: { ...src.globalCaps },
      supplies,
      notifications: src.notifications.map((n) => ({ ...n })),
      cycle: src.cycle,
    };
  }

  private initCellDefaults(
    target: CoreMutableState,
    idx: number,
    ct: CellTypeManifest
  ): void {
    if (ct.stateSchema.length > 0) {
      const obj: Record<string, RuntimeValue> = {};
      for (const f of ct.stateSchema) {
        obj[f.key] = f.initialValue;
      }
      target.cellStates.set(idx, obj);
    } else {
      target.cellStates.delete(idx);
    }

    target.cellVisuals.set(idx, {
      spriteId: ct.defaultSpriteId,
      tintColor: null,
      opacity: ct.defaultOpacity ?? 1,
    });
  }

  // ── Access-Controlled State Accessors ────────────────────────────────────

  private canReadGlobal(varDef: GlobalVariableManifest, scope: GraphScope): boolean {
    if (scope === 'global') return true;
    return varDef.access !== 'private';
  }

  private canWriteGlobal(varDef: GlobalVariableManifest, scope: GraphScope): boolean {
    if (scope === 'global') return true;
    return varDef.access === 'public';
  }

  private readGlobalInternal(
    target: CoreMutableState,
    varId: GlobalVarId,
    scope: GraphScope
  ): RuntimeValue {
    const def = this.globalVarById.get(varId);
    if (!def || !this.canReadGlobal(def, scope)) return 0;
    return target.globalValues[varId] ?? def.initialValue;
  }

  private readGlobalCapInternal(
    target: CoreMutableState,
    varId: GlobalVarId,
    scope: GraphScope
  ): number {
    const def = this.globalVarById.get(varId);
    if (!def || !def.hasCap || !this.canReadGlobal(def, scope)) return 0;
    return target.globalCaps[varId] ?? 0;
  }

  private readCellStateInternal(
    target: CoreMutableState,
    x: number,
    y: number,
    key: string,
    scope: GraphScope
  ): RuntimeValue {
    const idx = y * this.width + x;
    const ct = this.cellTypes[target.grid[idx]];
    if (!ct) return 0;
    const fieldDef = this.stateFieldMapByCell.get(ct.id)?.get(key);
    if (scope === 'interface' && fieldDef && fieldDef.access === 'private') {
      return 0;
    }
    const obj = target.cellStates.get(idx);
    if (obj && obj[key] !== undefined) return obj[key];
    return fieldDef?.initialValue ?? 0;
  }

  private writeCellStateInternal(
    target: CoreMutableState,
    x: number,
    y: number,
    key: string,
    value: RuntimeValue,
    scope: GraphScope
  ): void {
    const idx = y * this.width + x;
    const ct = this.cellTypes[target.grid[idx]];
    if (!ct) return;
    const fieldDef = this.stateFieldMapByCell.get(ct.id)?.get(key);
    if (scope === 'interface' && fieldDef && fieldDef.access !== 'public') {
      return;
    }
    let obj = target.cellStates.get(idx);
    if (!obj) {
      obj = {};
      target.cellStates.set(idx, obj);
    }
    obj[key] = value;
  }

  private createHost(
    target: CoreMutableState,
    options: {
      immediateEmit: boolean;
      emitStaging?: Map<SupplyId, Int16Array>;
      immediateTransform: boolean;
      transformQueue?: PendingTransform[];
      breakdown?: Record<GlobalVarId, ResourceBreakdown>;
    }
  ): GraphVmHost {
    const self = this;

    const clampGlobalNumber = (def: GlobalVariableManifest, raw: number): number => {
      let val = raw;
      if (!def.allowNegative && val < 0) val = 0;
      if (def.hasCap) {
        const cap = target.globalCaps[def.id] ?? 0;
        if (val > cap) val = cap;
      }
      return val;
    };

    const depositSupplyAt = (
      tx: number,
      ty: number,
      supplyId: SupplyId,
      amount: number
    ) => {
      if (tx < 0 || ty < 0 || tx >= self.width || ty >= self.height) return;
      const supply = self.supplyById.get(supplyId);
      if (!supply) return;
      const idx = ty * self.width + tx;
      const cap = supply.maxAmount ?? 32000;
      if (options.immediateEmit || !options.emitStaging) {
        const buf = target.supplies.get(supplyId);
        if (buf) buf[idx] = Math.min(cap, buf[idx] + amount);
      } else {
        const buf = options.emitStaging.get(supplyId);
        if (buf) buf[idx] = Math.min(cap, buf[idx] + amount);
      }
    };

    return {
      getSetupParam: (paramId) => self.setupValues[paramId] ?? 0,
      random: () => self.rng(),

      getGlobal: (varId, scope) => self.readGlobalInternal(target, varId, scope),
      getGlobalCap: (varId, scope) => self.readGlobalCapInternal(target, varId, scope),
      getGlobalVarName: (varId) => self.globalVarById.get(varId)?.name ?? varId,

      setGlobal: (varId, value, scope) => {
        const def = self.globalVarById.get(varId);
        if (!def || !self.canWriteGlobal(def, scope)) return;
        if (def.type === 'number') {
          const prev = Number(target.globalValues[varId] ?? 0);
          const next = clampGlobalNumber(def, Number(value));
          target.globalValues[varId] = next;
          if (options.breakdown?.[varId]) {
            const diff = next - prev;
            if (diff > 0) options.breakdown[varId].gained += diff;
            else if (diff < 0) options.breakdown[varId].consumed += -diff;
          }
        } else {
          target.globalValues[varId] = value;
        }
      },

      addGlobal: (varId, amount, scope) => {
        const def = self.globalVarById.get(varId);
        if (!def || def.type !== 'number' || !self.canWriteGlobal(def, scope)) return;
        const prev = Number(target.globalValues[varId] ?? 0);
        const next = clampGlobalNumber(def, prev + amount);
        target.globalValues[varId] = next;
        if (options.breakdown?.[varId]) {
          const diff = next - prev;
          if (diff > 0) options.breakdown[varId].gained += diff;
          else if (diff < 0) options.breakdown[varId].consumed += -diff;
        }
      },

      consumeGlobal: (varId, amount, scope) => {
        const def = self.globalVarById.get(varId);
        if (!def || def.type !== 'number' || !self.canWriteGlobal(def, scope)) return false;
        const cur = Number(target.globalValues[varId] ?? 0);
        if (cur < amount) return false;
        const next = clampGlobalNumber(def, cur - amount);
        target.globalValues[varId] = next;
        if (options.breakdown?.[varId]) {
          options.breakdown[varId].consumed += cur - next;
        }
        return true;
      },

      addGlobalCap: (varId, delta, scope) => {
        const def = self.globalVarById.get(varId);
        if (!def || !def.hasCap || !self.canWriteGlobal(def, scope)) return;
        const nextCap = Math.max(0, (target.globalCaps[varId] ?? 0) + delta);
        target.globalCaps[varId] = nextCap;
        if (def.type === 'number') {
          const cur = Number(target.globalValues[varId] ?? 0);
          if (cur > nextCap) {
            target.globalValues[varId] = nextCap;
            if (options.breakdown?.[varId]) {
              options.breakdown[varId].consumed += cur - nextCap;
            }
          }
        }
      },

      getCellState: (x, y, key, scope) =>
        self.readCellStateInternal(target, x, y, key, scope),

      setCellState: (x, y, key, value, scope) =>
        self.writeCellStateInternal(target, x, y, key, value, scope),

      addCellState: (x, y, key, amount, scope) => {
        const cur = Number(self.readCellStateInternal(target, x, y, key, scope));
        self.writeCellStateInternal(target, x, y, key, cur + amount, scope);
      },

      setCellSprite: (x, y, spriteId) => {
        const idx = y * self.width + x;
        const vis = target.cellVisuals.get(idx) ?? {
          spriteId: null,
          tintColor: null,
          opacity: 1,
        };
        vis.spriteId = spriteId;
        target.cellVisuals.set(idx, vis);
      },

      setCellColor: (x, y, color) => {
        const idx = y * self.width + x;
        const vis = target.cellVisuals.get(idx) ?? {
          spriteId: null,
          tintColor: null,
          opacity: 1,
        };
        vis.tintColor = color;
        target.cellVisuals.set(idx, vis);
      },

      setCellOpacity: (x, y, opacity) => {
        const idx = y * self.width + x;
        const vis = target.cellVisuals.get(idx) ?? {
          spriteId: null,
          tintColor: null,
          opacity: 1,
        };
        vis.opacity = Math.max(0, Math.min(1, opacity));
        target.cellVisuals.set(idx, vis);
      },

      transformCell: (x, y, toId, reason) => {
        if (options.immediateTransform || !options.transformQueue) {
          self.applyTransformInternal(target, x, y, toId, reason, options.breakdown);
        } else {
          const idx = y * self.width + x;
          const fromId = self.cellTypes[target.grid[idx]]?.id ?? '';
          // Replace any earlier queued transform for this exact tile
          const existingIdx = options.transformQueue.findIndex((t) => t.idx === idx);
          const item: PendingTransform = { idx, x, y, fromId, toId, reason };
          if (existingIdx >= 0) {
            options.transformQueue[existingIdx] = item;
          } else {
            options.transformQueue.push(item);
          }
        }
      },

      getSupply: (x, y, supplyId) => {
        const buf = target.supplies.get(supplyId);
        if (!buf) return 0;
        return buf[y * self.width + x] ?? 0;
      },

      emitSupply: (x, y, supplyId, amount, area: EmitArea, includeSelf) => {
        switch (area.shape) {
          case 'self':
            depositSupplyAt(x, y, supplyId, amount);
            return;
          case 'coords':
            depositSupplyAt(area.x, area.y, supplyId, amount);
            return;
          case 'relative':
            depositSupplyAt(x + area.dx, y + area.dy, supplyId, amount);
            return;
          case 'moore': {
            const r = Math.max(0, Math.round(area.radius));
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (!includeSelf && dx === 0 && dy === 0) continue;
                depositSupplyAt(x + dx, y + dy, supplyId, amount);
              }
            }
            return;
          }
          case 'vonNeumann': {
            const r = Math.max(0, Math.round(area.radius));
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) + Math.abs(dy) > r) continue;
                if (!includeSelf && dx === 0 && dy === 0) continue;
                depositSupplyAt(x + dx, y + dy, supplyId, amount);
              }
            }
            return;
          }
        }
      },

      consumeSupply: (x, y, supplyId, amount) => {
        const buf = target.supplies.get(supplyId);
        if (!buf) return false;
        const idx = y * self.width + x;
        if (buf[idx] < amount) return false;
        buf[idx] -= amount;
        return true;
      },

      reclaimCellState: (stateKey, amount, opts) => {
        let remaining = Math.max(0, Math.floor(amount));
        let reclaimed = 0;
        if (remaining <= 0) return 0;

        for (const [idx, st] of target.cellStates.entries()) {
          if (remaining <= 0) break;
          const val = st[stateKey];
          if (typeof val === 'number' && val > 0) {
            const take = Math.min(val, remaining);
            st[stateKey] = val - take;
            remaining -= take;
            reclaimed += take;

            if (opts?.resetVisualToDefault) {
              const ct = self.cellTypes[target.grid[idx]];
              if (ct) {
                target.cellVisuals.set(idx, {
                  spriteId: ct.defaultSpriteId,
                  tintColor: null,
                  opacity: ct.defaultOpacity ?? 1,
                });
              }
            }
            if (opts?.setStateOnAffected) {
              for (const [k, v] of Object.entries(opts.setStateOnAffected)) {
                st[k] = v;
              }
            }
          }
        }
        return reclaimed;
      },

      pushGlobalNotification: (severity: NotificationSeverity, title, message) => {
        target.notifications.push({
          id: `g_${target.cycle}_${++self.notifCounter}`,
          scope: 'global',
          severity,
          title,
          message,
          cycle: target.cycle,
        });
      },

      pushCellNotification: (x, y, severity: NotificationSeverity, title, message) => {
        const ct = self.cellTypes[target.grid[y * self.width + x]];
        target.notifications.push({
          id: `c_${target.cycle}_${x}_${y}_${++self.notifCounter}`,
          scope: 'cell',
          severity,
          title,
          message,
          cycle: target.cycle,
          x,
          y,
          cellTypeId: ct?.id,
        });
      },

      clearCellNotifications: (x, y) => {
        target.notifications = target.notifications.filter(
          (n) => !(n.scope === 'cell' && n.x === x && n.y === y)
        );
      },
    };
  }
}
