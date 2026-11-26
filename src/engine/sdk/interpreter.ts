import { t } from '../../i18n';
import {
  Action,
  CellInspection,
  CellNotificationDraft,
  CellStateData,
  CellStateValue,
  CellTickOutcome,
  CellTypeId,
  CellTypeManifest,
  ClickExecutionResult,
  CompareOp,
  Condition,
  DemolishInfo,
  ResourceDelta,
  ResourceId,
  ResolvedVisualIndicator,
  ResolvedVisualState,
  Rule,
  RulesetManifest,
  StatusBadge,
  StatusTone,
  SupplyEmission,
  SupplyId,
  UiClickAction,
} from './types';

export interface RuleEvalContext {
  x: number;
  y: number;
  cycle: number;
  seed: string;
  cellType: CellTypeManifest;
  state: CellStateData;
  supplies: Record<SupplyId, number>;
  resources: Record<ResourceId, number>;
  resourceCaps: Record<ResourceId, number | null>;
  manifest: RulesetManifest;
  countNeighbors: (
    x: number,
    y: number,
    cellTypeId: CellTypeId,
    radius: number,
    neighborhood: 'moore' | 'vonNeumann'
  ) => number;
}

export interface MutableRuleWorld {
  getResource: (id: ResourceId) => number;
  addResource: (id: ResourceId, delta: number) => void;
  consumeResource: (id: ResourceId, amount: number) => boolean;
  setCell: (x: number, y: number, cellTypeId: CellTypeId) => boolean;
  getCellStateAt: (x: number, y: number) => CellStateData;
  patchCellState: (x: number, y: number, patch: CellStateData) => void;
  reclaimFromCells: (stateKey: string, amount: number) => void;
  reconcileResourceCaps: () => void;
}

// ============================================================================
// Helpers: Comparison, Deterministic Chance, Names & Templates
// ============================================================================

function compareValues(
  left: CellStateValue | undefined,
  op: CompareOp,
  right: CellStateValue
): boolean {
  const lhs =
    left === undefined
      ? typeof right === 'number'
        ? 0
        : typeof right === 'boolean'
          ? false
          : ''
      : left;

  switch (op) {
    case 'eq':
      return lhs === right;
    case 'neq':
      return lhs !== right;
    case 'gt':
      return Number(lhs) > Number(right);
    case 'gte':
      return Number(lhs) >= Number(right);
    case 'lt':
      return Number(lhs) < Number(right);
    case 'lte':
      return Number(lhs) <= Number(right);
  }
}

function deterministicRoll(
  seed: string,
  cycle: number,
  x: number,
  y: number,
  salt: number
): number {
  const input = `${seed}:${cycle}:${x}:${y}:${salt}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function getResourceName(
  manifest: RulesetManifest,
  id: ResourceId
): string {
  return manifest.resources.find((r) => r.id === id)?.name ?? id;
}

export function getSupplyName(
  manifest: RulesetManifest,
  id: SupplyId
): string {
  return manifest.supplies.find((s) => s.id === id)?.name ?? id;
}

export function formatTemplate(
  template: string,
  ctx: Pick<RuleEvalContext, 'state' | 'supplies' | 'resources' | 'manifest'>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawExpr: string) => {
    const expr = rawExpr.trim();
    if (expr.startsWith('state.')) {
      const key = expr.slice(6);
      const val = ctx.state[key];
      return val === undefined ? '' : String(val);
    }
    if (expr.startsWith('supply.')) {
      const id = expr.slice(7);
      return String(ctx.supplies[id] ?? 0);
    }
    if (expr.startsWith('resource.')) {
      const id = expr.slice(9);
      return String(ctx.resources[id] ?? 0);
    }
    if (expr.startsWith('resourceName:')) {
      const stateKey = expr.slice(13);
      const resId = String(ctx.state[stateKey] ?? '');
      return resId ? getResourceName(ctx.manifest, resId) : '';
    }
    return '';
  });
}

// ============================================================================
// Condition Evaluation
// ============================================================================

export function evaluateCondition(
  cond: Condition,
  ctx: RuleEvalContext,
  salt = 0
): boolean {
  switch (cond.type) {
    case 'supply':
      return compareValues(ctx.supplies[cond.id] ?? 0, cond.op, cond.value);
    case 'resource':
      return compareValues(ctx.resources[cond.id] ?? 0, cond.op, cond.value);
    case 'state':
      return compareValues(ctx.state[cond.key], cond.op, cond.value);
    case 'neighbors': {
      const count = ctx.countNeighbors(
        ctx.x,
        ctx.y,
        cond.cell,
        cond.radius ?? 1,
        cond.neighborhood ?? 'moore'
      );
      return compareValues(count, cond.op, cond.value);
    }
    case 'chance':
      return (
        deterministicRoll(ctx.seed, ctx.cycle, ctx.x, ctx.y, salt) <
        cond.probability
      );
    case 'any':
      return cond.conditions.some((c, idx) =>
        evaluateCondition(c, ctx, salt * 31 + idx + 1)
      );
    case 'not':
      return !evaluateCondition(cond.condition, ctx, salt * 31 + 7);
  }
}

export function evaluateConditions(
  conds: readonly Condition[] | undefined,
  ctx: RuleEvalContext,
  saltBase = 0
): boolean {
  if (!conds || conds.length === 0) return true;
  for (let i = 0; i < conds.length; i++) {
    if (!evaluateCondition(conds[i], ctx, saltBase + i)) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Pure Phase-1 Cycle Rule Evaluator (used by step(), getStats(), inspectCell())
// ============================================================================

function applyStateAction(state: CellStateData, action: Action): void {
  if (action.type === 'setState') {
    state[action.key] = action.value;
  } else if (action.type === 'addState') {
    let next = Number(state[action.key] ?? 0) + action.amount;
    if (action.min !== undefined && next < action.min) next = action.min;
    if (action.max !== undefined && next > action.max) next = action.max;
    state[action.key] = next;
  }
}

export function evaluateCycleRules(
  cellType: CellTypeManifest,
  ctx: RuleEvalContext
): CellTickOutcome {
  const rules = cellType.onCycle;
  const workingState: CellStateData = { ...ctx.state };
  const simSupplies: Record<SupplyId, number> = { ...ctx.supplies };
  const simResources: Record<ResourceId, number> = { ...ctx.resources };

  const consumedSupplies: Record<SupplyId, number> = {};
  const consumedResources: ResourceDelta = {};
  const producedResources: ResourceDelta = {};
  const emissions: SupplyEmission[] = [];
  let nextTypeId: CellTypeId = cellType.id;
  let notification: CellNotificationDraft | null = null;
  let matchedLabel: string | undefined;
  let matchedTone: StatusTone | undefined;
  let firstFailedConditions: Condition[] | undefined;

  if (!rules || rules.length === 0) {
    return {
      nextTypeId,
      nextState: Object.keys(workingState).length > 0 ? workingState : null,
      consumedSupplies,
      consumedResources,
      producedResources,
      emissions,
      notification,
    };
  }

  const localCtx: RuleEvalContext = {
    ...ctx,
    state: workingState,
    supplies: simSupplies,
    resources: simResources,
  };

  const runActionList = (actions: readonly Action[]): boolean => {
    let transformed = false;
    for (const action of actions) {
      switch (action.type) {
        case 'addResource':
          if (action.amount !== 0) {
            producedResources[action.id] =
              (producedResources[action.id] ?? 0) + action.amount;
          }
          break;
        case 'consumeResource':
          if (action.amount > 0) {
            const avail = simResources[action.id] ?? 0;
            const actual = Math.min(avail, action.amount);
            if (actual > 0) {
              simResources[action.id] = avail - actual;
              consumedResources[action.id] =
                (consumedResources[action.id] ?? 0) + actual;
            }
          }
          break;
        case 'consumeSupply':
          if (action.amount > 0) {
            const avail = simSupplies[action.id] ?? 0;
            const actual = Math.min(avail, action.amount);
            if (actual > 0) {
              simSupplies[action.id] = avail - actual;
              consumedSupplies[action.id] =
                (consumedSupplies[action.id] ?? 0) + actual;
            }
          }
          break;
        case 'emitSupply':
          emissions.push({
            id: action.id,
            amount: action.amount,
            radius: action.radius,
            neighborhood: action.neighborhood,
            includeSelf: action.includeSelf ?? true,
          });
          break;
        case 'setState':
        case 'addState':
          applyStateAction(workingState, action);
          break;
        case 'transform':
          nextTypeId = action.to;
          transformed = true;
          break;
        case 'notify':
          notification = {
            severity: action.severity,
            title: formatTemplate(action.title, localCtx),
            message: formatTemplate(action.message, localCtx),
          };
          break;
        default:
          break;
      }
    }
    return transformed;
  };

  for (let rIdx = 0; rIdx < rules.length; rIdx++) {
    const rule = rules[rIdx];
    const conds = rule.when;
    const passed = evaluateConditions(conds, localCtx, rIdx * 100);

    if (passed) {
      const transformed = runActionList(rule.do);
      if (rule.label) {
        matchedLabel = formatTemplate(rule.label, localCtx);
        matchedTone = rule.tone ?? 'neutral';
      }
      if (transformed || rule.stop) {
        break;
      }
    } else {
      if (!firstFailedConditions && conds && conds.length > 0) {
        firstFailedConditions = conds.filter(
          (c, i) => !evaluateCondition(c, localCtx, rIdx * 100 + i)
        );
      }
      if (rule.else && rule.else.length > 0) {
        const transformed = runActionList(rule.else);
        if (transformed) break;
      }
    }
  }

  return {
    nextTypeId,
    nextState: Object.keys(workingState).length > 0 ? workingState : null,
    consumedSupplies,
    consumedResources,
    producedResources,
    emissions,
    notification,
    matchedLabel,
    matchedTone,
    firstFailedConditions,
  };
}

// ============================================================================
// Mutating World Rule Executor (onClick, onBuild, onDemolish, onLost, buttons)
// ============================================================================

function isUiClickAction(action: Action): action is UiClickAction {
  return (
    action.type === 'openBuildMenu' ||
    action.type === 'openPanel' ||
    action.type === 'openDemolishConfirm'
  );
}

export function executeWorldRules(
  rules: readonly Rule[] | undefined,
  ctx: RuleEvalContext,
  world: MutableRuleWorld
): ClickExecutionResult {
  if (!rules || rules.length === 0) {
    return { uiAction: null, mutated: false };
  }

  const workingState: CellStateData = { ...ctx.state };
  const liveResources: Record<ResourceId, number> = { ...ctx.resources };
  const localCtx: RuleEvalContext = {
    ...ctx,
    state: workingState,
    resources: liveResources,
  };

  let uiAction: UiClickAction | null = null;
  let mutated = false;

  const runActions = (actions: readonly Action[]): boolean => {
    let transformed = false;
    for (const action of actions) {
      if (isUiClickAction(action)) {
        uiAction = action;
        continue;
      }
      switch (action.type) {
        case 'addResource':
          if (action.amount !== 0) {
            world.addResource(action.id, action.amount);
            liveResources[action.id] = world.getResource(action.id);
            mutated = true;
          }
          break;
        case 'consumeResource':
          if (action.amount > 0) {
            if (world.consumeResource(action.id, action.amount)) {
              liveResources[action.id] = world.getResource(action.id);
              mutated = true;
            }
          }
          break;
        case 'setState':
        case 'addState':
          applyStateAction(workingState, action);
          world.patchCellState(ctx.x, ctx.y, {
            [action.key]: workingState[action.key],
          });
          world.reconcileResourceCaps();
          mutated = true;
          break;
        case 'transform':
          world.setCell(ctx.x, ctx.y, action.to);
          world.reconcileResourceCaps();
          mutated = true;
          transformed = true;
          break;
        case 'refundStateToResource': {
          const amount = Number(workingState[action.stateKey] ?? 0);
          if (amount > 0) {
            world.addResource(action.resourceId, amount);
            liveResources[action.resourceId] = world.getResource(
              action.resourceId
            );
            workingState[action.stateKey] = 0;
            mutated = true;
          }
          break;
        }
        case 'reclaimResource': {
          const totalNeed = Math.max(0, Math.floor(action.amount));
          for (let n = 0; n < totalNeed; n++) {
            if (world.getResource(action.resourceId) >= 1) {
              world.consumeResource(action.resourceId, 1);
            } else if (action.fallbackStateKey) {
              world.reclaimFromCells(action.fallbackStateKey, 1);
            }
          }
          liveResources[action.resourceId] = world.getResource(
            action.resourceId
          );
          mutated = true;
          break;
        }
        default:
          break;
      }
    }
    return transformed;
  };

  for (let rIdx = 0; rIdx < rules.length; rIdx++) {
    const rule = rules[rIdx];
    const passed = evaluateConditions(rule.when, localCtx, rIdx * 100);
    if (passed) {
      const transformed = runActions(rule.do);
      if (transformed || rule.stop) break;
    } else if (rule.else && rule.else.length > 0) {
      const transformed = runActions(rule.else);
      if (transformed) break;
    }
  }

  return { uiAction, mutated };
}

// ============================================================================
// Declarative Visual & Badge Resolvers
// ============================================================================

export function resolveCellVisual(
  cellType: CellTypeManifest,
  ctx: RuleEvalContext
): ResolvedVisualState {
  const vis = cellType.visual;
  let color = vis.color;
  let icon = vis.icon;
  let glyph = vis.glyph;
  let border: 'solid' | 'dashed' = vis.border ?? 'solid';
  let dim = vis.dim ?? false;

  if (vis.rules) {
    for (let i = 0; i < vis.rules.length; i++) {
      const rule = vis.rules[i];
      if (evaluateConditions(rule.when, ctx, i * 17)) {
        if (rule.color !== undefined) color = rule.color;
        if (rule.icon !== undefined) icon = rule.icon;
        if (rule.glyph !== undefined) glyph = rule.glyph;
        if (rule.border !== undefined) border = rule.border;
        if (rule.dim !== undefined) dim = rule.dim;
        break;
      }
    }
  }

  const indicators: ResolvedVisualIndicator[] = [];
  if (vis.indicators) {
    for (let i = 0; i < vis.indicators.length; i++) {
      const ind = vis.indicators[i];
      const active = evaluateConditions(ind.when, ctx, 500 + i * 17);
      if (ind.kind === 'dot') {
        if (active) {
          indicators.push({
            kind: 'dot',
            position: ind.position,
            filled: true,
            color: ind.color,
          });
        } else if (ind.inactiveColor) {
          indicators.push({
            kind: 'dot',
            position: ind.position,
            filled: false,
            color: ind.inactiveColor,
          });
        }
      } else if (ind.kind === 'bar' && active) {
        let barColor = ind.color ?? color;
        if (ind.colorFromResourceState) {
          const resId = String(ctx.state[ind.colorFromResourceState] ?? '');
          const resDef = ctx.manifest.resources.find((r) => r.id === resId);
          if (resDef) barColor = resDef.color;
        }
        indicators.push({ kind: 'bar', color: barColor });
      }
    }
  }

  return {
    color,
    icon,
    glyph,
    fullTile: vis.fullTile,
    svgPath: vis.svgPath,
    substrateColor: vis.substrateColor,
    border,
    dim,
    indicators,
  };
}

export function resolveCellBadge(
  cellType: CellTypeManifest,
  ctx: RuleEvalContext
): StatusBadge | null {
  if (!cellType.badges || cellType.badges.length === 0) return null;
  for (let i = 0; i < cellType.badges.length; i++) {
    const badge = cellType.badges[i];
    if (evaluateConditions(badge.when, ctx, 900 + i * 13)) {
      const text = formatTemplate(badge.text, ctx).trim();
      if (!text) return null;
      return {
        text,
        tone: badge.tone ?? 'neutral',
      };
    }
  }
  return null;
}

// ============================================================================
// Auto-Derived Hover Explanation, Build Preview, Demolish Info & Emissions
// ============================================================================

export function formatCycleDeltaSummary(
  outcome: CellTickOutcome,
  manifest: RulesetManifest
): string {
  const parts: string[] = [];
  for (const [resId, amt] of Object.entries(outcome.consumedResources)) {
    if (amt > 0) {
      parts.push(`−${amt} ${getResourceName(manifest, resId)}`);
    }
  }
  for (const [resId, amt] of Object.entries(outcome.producedResources)) {
    if (amt > 0) {
      parts.push(`+${amt} ${getResourceName(manifest, resId)}`);
    } else if (amt < 0) {
      parts.push(`−${Math.abs(amt)} ${getResourceName(manifest, resId)}`);
    }
  }
  for (const em of outcome.emissions) {
    parts.push(`+${em.amount} ${getSupplyName(manifest, em.id)}`);
  }
  return parts.join(' · ');
}

function describeFailedCondition(
  cond: Condition,
  manifest: RulesetManifest
): string {
  switch (cond.type) {
    case 'supply':
      return t('inspect.needSupply', {
        name: getSupplyName(manifest, cond.id),
      });
    case 'resource':
      return t('inspect.needResource', {
        name: getResourceName(manifest, cond.id),
      });
    case 'state':
      return t('inspect.needState', { key: cond.key });
    case 'neighbors': {
      const cellName =
        manifest.cellTypes.find((c) => c.id === cond.cell)?.name ?? cond.cell;
      return t('inspect.needNeighbor', { name: cellName });
    }
    default:
      return t('inspect.inactive');
  }
}

export function deriveCycleExplanation(
  cellType: CellTypeManifest,
  ctx: RuleEvalContext,
  outcome: CellTickOutcome
): Pick<CellInspection, 'transitionLabel' | 'transitionTone'> {
  if (outcome.matchedLabel) {
    return {
      transitionLabel: outcome.matchedLabel,
      transitionTone: outcome.matchedTone ?? 'neutral',
    };
  }

  if (outcome.nextTypeId !== cellType.id) {
    const nextDef = ctx.manifest.cellTypes.find(
      (c) => c.id === outcome.nextTypeId
    );
    return {
      transitionLabel: t('core.transitionTo', {
        name: nextDef?.name ?? outcome.nextTypeId,
      }),
      transitionTone: 'danger',
    };
  }

  const deltaSummary = formatCycleDeltaSummary(outcome, ctx.manifest);
  if (deltaSummary) {
    return {
      transitionLabel: deltaSummary,
      transitionTone: 'positive',
    };
  }

  if (outcome.firstFailedConditions && outcome.firstFailedConditions.length > 0) {
    const first = outcome.firstFailedConditions[0];
    return {
      transitionLabel: describeFailedCondition(first, ctx.manifest),
      transitionTone: 'danger',
    };
  }

  // Passive modifier summary (e.g. Warehouse)
  for (const mod of cellType.modifiers ?? []) {
    if (mod.type === 'capBonus' && mod.resourceFromState) {
      const resId = String(ctx.state[mod.resourceFromState] ?? '');
      if (!resId) {
        return {
          transitionLabel: t('inspect.selectResource'),
          transitionTone: 'warning',
        };
      }
      return {
        transitionLabel: `+${mod.amount} ${getResourceName(ctx.manifest, resId)}`,
        transitionTone: 'positive',
      };
    }
  }

  return {
    transitionLabel: cellType.shortRule ?? '',
    transitionTone: 'neutral',
  };
}

export function deriveBuildPreview(
  cellType: CellTypeManifest,
  ctx: RuleEvalContext
): StatusBadge | null {
  // Assume transferable panel slots (e.g. workers) are staffed when checking
  // whether local terrain/supplies/resources allow this building to operate.
  const previewState: CellStateData = { ...(cellType.initialState ?? {}) };
  for (const block of cellType.panel ?? []) {
    if (block.type === 'transfer') {
      const cur = Number(previewState[block.stateKey] ?? 0);
      const step = block.step ?? 1;
      if (cur < block.min + step && block.min + step <= block.max) {
        previewState[block.stateKey] = block.min + step;
      }
    }
  }

  const previewCtx: RuleEvalContext = {
    ...ctx,
    cellType,
    state: previewState,
  };

  if (cellType.onCycle && cellType.onCycle.length > 0) {
    const outcome = evaluateCycleRules(cellType, previewCtx);
    const deltaSummary = formatCycleDeltaSummary(outcome, ctx.manifest);
    if (deltaSummary) {
      return { text: deltaSummary, tone: 'positive' };
    }
    if (outcome.firstFailedConditions && outcome.firstFailedConditions.length > 0) {
      const cond = outcome.firstFailedConditions[0];
      return {
        text: describeFailedCondition(cond, ctx.manifest),
        tone: cond.type === 'resource' ? 'warning' : 'danger',
      };
    }
  }

  for (const mod of cellType.modifiers ?? []) {
    if (mod.type === 'capBonus') {
      if (mod.resource) {
        return {
          text: `+${mod.amount} ${getResourceName(ctx.manifest, mod.resource)}`,
          tone: 'positive',
        };
      }
      return {
        text: t('inspect.capBonusPreview', { amount: mod.amount }),
        tone: 'positive',
      };
    }
  }

  return cellType.shortRule
    ? { text: cellType.shortRule, tone: 'neutral' }
    : null;
}

export function deriveDemolishInfo(
  cellType: CellTypeManifest,
  ctx: RuleEvalContext
): DemolishInfo {
  const lines: DemolishInfo['lines'] = [];
  const warnings: string[] = [];

  for (const rule of cellType.onDemolish ?? []) {
    if (!evaluateConditions(rule.when, ctx)) continue;
    for (const action of rule.do) {
      if (action.type === 'addResource' && action.amount !== 0) {
        const sign = action.amount > 0 ? '+' : '−';
        lines.push({
          label: getResourceName(ctx.manifest, action.id),
          value: `${sign}${Math.abs(action.amount)}`,
          tone: action.amount > 0 ? 'positive' : 'danger',
        });
      } else if (action.type === 'refundStateToResource') {
        const amt = Number(ctx.state[action.stateKey] ?? 0);
        if (amt > 0) {
          lines.push({
            label: getResourceName(ctx.manifest, action.resourceId),
            value: `+${amt}`,
            tone: 'positive',
          });
        }
      } else if (action.type === 'reclaimResource') {
        const resName = getResourceName(ctx.manifest, action.resourceId);
        lines.push({
          label: resName,
          value: `−${action.amount}`,
          tone: 'danger',
        });
        const free = ctx.resources[action.resourceId] ?? 0;
        if (free < action.amount && action.fallbackStateKey) {
          warnings.push(
            t('demolish.reclaimWarning', {
              count: action.amount - free,
              key: action.fallbackStateKey,
            })
          );
        }
      }
    }
  }

  for (const mod of cellType.modifiers ?? []) {
    if (mod.type !== 'capBonus') continue;
    const resId =
      mod.resource ??
      (mod.resourceFromState
        ? String(ctx.state[mod.resourceFromState] ?? '')
        : '');
    if (!resId) continue;
    const curCap = ctx.resourceCaps[resId];
    if (curCap === null || curCap === undefined) continue;
    const nextCap = curCap - mod.amount;
    const curVal = ctx.resources[resId] ?? 0;
    if (curVal > nextCap) {
      warnings.push(
        t('demolish.capOverflowWarning', {
          excess: curVal - nextCap,
          resource: getResourceName(ctx.manifest, resId),
        })
      );
    }
  }

  return { lines, warnings };
}

export function extractStaticEmissions(
  cellType: CellTypeManifest
): SupplyEmission[] {
  const result: SupplyEmission[] = [];
  for (const rule of cellType.onCycle ?? []) {
    for (const action of rule.do) {
      if (action.type === 'emitSupply') {
        result.push({
          id: action.id,
          amount: action.amount,
          radius: action.radius,
          neighborhood: action.neighborhood,
          includeSelf: action.includeSelf ?? true,
        });
      }
    }
  }
  return result;
}

export function extractBuildResourceSummary(
  cellType: CellTypeManifest
): ResourceDelta {
  const delta: ResourceDelta = {};
  for (const rule of cellType.onBuild ?? []) {
    if (rule.when && rule.when.length > 0) continue;
    for (const action of rule.do) {
      if (action.type === 'addResource' && action.amount !== 0) {
        delta[action.id] = (delta[action.id] ?? 0) + action.amount;
      }
    }
  }
  return delta;
}
