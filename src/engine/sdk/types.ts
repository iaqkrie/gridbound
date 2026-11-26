import type { SoundKind } from '../../utils/sound';
import type { CellIcon } from './icons';

// ============================================================================
// Primitive Identifiers & Shared Types
// ============================================================================

export type SupplyId = string;
export type CellTypeId = string;
export type ResourceId = string;

export type NeighborhoodType = 'moore' | 'vonNeumann' | 'self';
export type MouseButton = 'left' | 'right' | 'middle';
export type SupplyOverlayMode = 'off' | 'heatmap' | 'numbers';

export type ResourceDelta = Record<ResourceId, number>;
export type CellStateValue = number | string | boolean;
export type CellStateData = Record<string, CellStateValue>;
export type StatusTone = 'neutral' | 'positive' | 'warning' | 'danger';
export type NotificationSeverity = 'warning' | 'danger';
export type CompareOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface StatusBadge {
  text: string;
  tone: StatusTone;
}

export interface GridCoordinate {
  x: number;
  y: number;
}

// ============================================================================
// Decay Rules (used by Supplies and optionally by Global Resources)
// ============================================================================

export type DecayRule =
  | { kind: 'clear' }
  | { kind: 'none' }
  | { kind: 'linear'; amount: number }
  | {
      kind: 'percent';
      /** Fraction retained each cycle, e.g. 0.5 keeps 50% */
      retainRatio: number;
      round?: 'floor' | 'ceil' | 'round';
      /** Minimum decay step when value > 0 */
      minStep?: number;
    };

// ============================================================================
// Global Resources — Strictly 2 kinds: 'unlimited' | 'capped'
// ============================================================================

interface BaseResourceManifest {
  id: ResourceId;
  name: string;
  shortName?: string;
  description?: string;
  color: string;
  initialValue: number;
  tags?: string[];
  decay?: DecayRule;
}

export interface UnlimitedResourceManifest extends BaseResourceManifest {
  kind: 'unlimited';
}

export interface CappedResourceManifest extends BaseResourceManifest {
  kind: 'capped';
  initialMax: number;
}

export type ResourceManifest =
  | UnlimitedResourceManifest
  | CappedResourceManifest;

// ============================================================================
// Spatial Supplies
// ============================================================================

export interface SupplyManifest {
  id: SupplyId;
  name: string;
  description?: string;
  color: string;
  maxExpected: number;
  maxAmount?: number;
  decay: DecayRule;
}

export interface SupplyEmission {
  id: SupplyId;
  amount: number;
  radius: number;
  neighborhood: NeighborhoodType;
  includeSelf?: boolean;
}

// ============================================================================
// Setup Options & Declarative World Generator Pipeline
// ============================================================================

export interface MapSizePreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

export type SetupParamManifest =
  | {
      id: string;
      label: string;
      type: 'select';
      defaultValue: string;
      options: { value: string; label: string }[];
    }
  | {
      id: string;
      label: string;
      type: 'number';
      defaultValue: number;
      min: number;
      max: number;
      step?: number;
    }
  | {
      id: string;
      label: string;
      type: 'boolean';
      defaultValue: boolean;
    };

export interface SetupOptionsManifest {
  mapSizes?: MapSizePreset[];
  allowSeed?: boolean;
  params?: SetupParamManifest[];
}

export interface WorldSetupValues {
  width: number;
  height: number;
  seed: string;
  params: Record<string, string | number | boolean>;
}

export type GeneratorStep =
  | {
      type: 'fill';
      cell: CellTypeId;
    }
  | {
      type: 'clusters';
      cell: CellTypeId;
      clustersPer768: number;
      minClusters?: number;
      minSize: number;
      maxSize: number;
      onlyOnEmpty?: boolean;
      densityParam?: string;
    }
  | {
      type: 'scatter';
      cell: CellTypeId;
      countPer768: number;
      minCount?: number;
      onlyOnEmpty?: boolean;
      densityParam?: string;
    }
  | {
      type: 'placeNear';
      cell: CellTypeId;
      nearCell: CellTypeId;
      radius?: number;
      neighborhood?: 'moore' | 'vonNeumann';
      chance: number;
      maxCount?: number;
      onlyOnEmpty?: boolean;
    };

export interface GridMutator {
  readonly width: number;
  readonly height: number;
  readonly defaultCellTypeId: CellTypeId;
  clear: () => void;
  getCell: (x: number, y: number) => CellTypeId;
  setCell: (x: number, y: number, cellTypeId: CellTypeId) => void;
}

export type SeededRng = () => number;

// ============================================================================
// Declarative Condition Primitives
// ============================================================================

export type Condition =
  | {
      type: 'supply';
      id: SupplyId;
      op: CompareOp;
      value: number;
    }
  | {
      type: 'resource';
      id: ResourceId;
      op: CompareOp;
      value: number;
    }
  | {
      type: 'state';
      key: string;
      op: CompareOp;
      value: CellStateValue;
    }
  | {
      type: 'neighbors';
      cell: CellTypeId;
      op: CompareOp;
      value: number;
      radius?: number;
      neighborhood?: 'moore' | 'vonNeumann';
    }
  | {
      type: 'chance';
      probability: number;
    }
  | {
      type: 'any';
      conditions: Condition[];
    }
  | {
      type: 'not';
      condition: Condition;
    };

// ============================================================================
// Declarative Action Primitives & Rules
// ============================================================================

export type UiClickAction =
  | { type: 'openBuildMenu'; options: CellTypeId[] }
  | { type: 'openPanel' }
  | { type: 'openDemolishConfirm' };

export type Action =
  | { type: 'addResource'; id: ResourceId; amount: number }
  | { type: 'consumeResource'; id: ResourceId; amount: number }
  | { type: 'consumeSupply'; id: SupplyId; amount: number }
  | {
      type: 'emitSupply';
      id: SupplyId;
      amount: number;
      radius: number;
      neighborhood: NeighborhoodType;
      includeSelf?: boolean;
    }
  | { type: 'setState'; key: string; value: CellStateValue }
  | {
      type: 'addState';
      key: string;
      amount: number;
      min?: number;
      max?: number;
    }
  | { type: 'transform'; to: CellTypeId }
  | {
      type: 'notify';
      severity: NotificationSeverity;
      title: string;
      message: string;
    }
  | {
      type: 'refundStateToResource';
      stateKey: string;
      resourceId: ResourceId;
    }
  | {
      type: 'reclaimResource';
      resourceId: ResourceId;
      amount: number;
      fallbackStateKey?: string;
    }
  | UiClickAction;

export interface Rule {
  when?: Condition[];
  do: Action[];
  else?: Action[];
  stop?: boolean;
  label?: string;
  tone?: StatusTone;
}

// ============================================================================
// Passive Cell Modifiers
// ============================================================================

export type CellModifier = {
  type: 'capBonus';
  resource?: ResourceId;
  resourceFromState?: string;
  amount: number;
};

// ============================================================================
// Declarative Visuals, Conditional Styles & Indicators
// ============================================================================

export type { CellIcon } from './icons';

export type ValidationSection =
  | 'general'
  | 'resources'
  | 'supplies'
  | 'generator'
  | 'cells';

export interface ValidationIssue {
  section: ValidationSection;
  cellId?: CellTypeId;
  path: string;
  message: string;
}

export interface VisualRule {
  when?: Condition[];
  color?: string;
  icon?: CellIcon;
  glyph?: string;
  border?: 'solid' | 'dashed';
  dim?: boolean;
}

export type VisualIndicator =
  | {
      kind: 'dot';
      position: 'bottomRight' | 'topLeft' | 'bottomLeft';
      when?: Condition[];
      color: string;
      inactiveColor?: string;
    }
  | {
      kind: 'bar';
      when?: Condition[];
      color?: string;
      colorFromResourceState?: string;
    };

export interface CellVisualManifest {
  color: string;
  icon?: CellIcon;
  /** Optional 1-2 character symbol or letter rendered centered on the cell */
  glyph?: string;
  /** Render full-tile fill (ideal for terrain) instead of inset frame (structures) */
  fullTile?: boolean;
  /** Optional custom SVG path in a 24x24 viewBox rendered via Canvas Path2D */
  svgPath?: string;
  /** Optional background substrate color tint */
  substrateColor?: string;
  border?: 'solid' | 'dashed';
  dim?: boolean;
  rules?: VisualRule[];
  indicators?: VisualIndicator[];
}

export interface ResolvedVisualState {
  color: string;
  icon?: CellIcon;
  glyph?: string;
  fullTile?: boolean;
  svgPath?: string;
  substrateColor?: string;
  border: 'solid' | 'dashed';
  dim: boolean;
  indicators: ResolvedVisualIndicator[];
}

export type ResolvedVisualIndicator =
  | {
      kind: 'dot';
      position: 'bottomRight' | 'topLeft' | 'bottomLeft';
      filled: boolean;
      color: string;
    }
  | {
      kind: 'bar';
      color: string;
    };

export interface CellBadgeRule {
  when?: Condition[];
  text: string;
  tone?: StatusTone;
}

// ============================================================================
// Declarative Cell UI Panel Blocks
// ============================================================================

export type PanelBlock =
  | {
      type: 'stat';
      label: string;
      /** Template string (e.g. "{{supply.moisture}}", "{{state.idle}} cycles") or "cycleOutput" */
      value: string;
      when?: Condition[];
      tone?: StatusTone;
      toneWhen?: { when: Condition[]; tone: StatusTone }[];
    }
  | {
      type: 'transfer';
      label: string;
      resource: ResourceId;
      stateKey: string;
      min: number;
      max: number;
      step?: number;
      assignLabel?: string;
      removeLabel?: string;
      resetKeys?: string[];
      clearNotifications?: boolean;
    }
  | {
      type: 'resourceSelect';
      label?: string;
      bonusText?: string;
      stateKey: string;
      kind?: 'capped' | 'unlimited';
      tag?: string;
    }
  | {
      type: 'actionButton';
      label: string;
      when?: Condition[];
      cost?: ResourceDelta;
      do: Action[];
      tone?: 'primary' | 'neutral' | 'danger';
      closeAfter?: boolean;
      sound?: SoundKind;
    };

// ============================================================================
// Cell Type & Top-Level Ruleset Manifest (Schema v2)
// ============================================================================

export interface CellTypeManifest {
  id: CellTypeId;
  name: string;
  description?: string;
  shortRule?: string;
  initialState?: CellStateData;
  buildCost?: ResourceDelta;
  demolishTo?: CellTypeId;
  priorityByState?: string;
  modifiers?: CellModifier[];
  visual: CellVisualManifest;
  badges?: CellBadgeRule[];
  onClick?: {
    left?: Rule[];
    right?: Rule[];
  };
  onBuild?: Rule[];
  onCycle?: Rule[];
  onDemolish?: Rule[];
  onLost?: Rule[];
  panel?: PanelBlock[];
}

export interface RulesetManifest {
  schemaVersion: 2;
  id: string;
  name: string;
  description?: string;
  author?: string;
  defaultGridSize: { width: number; height: number };
  defaultCellTypeId: CellTypeId;
  initialCycles?: number;
  setupOptions?: SetupOptionsManifest;
  worldGenerator: GeneratorStep[];
  resources: ResourceManifest[];
  supplies: SupplyManifest[];
  cellTypes: CellTypeManifest[];
}

export interface RulesetEntry {
  manifest: RulesetManifest;
  isCustom: boolean;
}

// ============================================================================
// Runtime Outcomes, Inspection, Stats & Serialization
// ============================================================================

export interface CellNotificationDraft {
  severity: NotificationSeverity;
  title: string;
  message: string;
}

export interface CellNotification extends CellNotificationDraft {
  id: string;
  x: number;
  y: number;
  cellTypeId: CellTypeId;
  cycle: number;
}

export interface CellTickOutcome {
  nextTypeId: CellTypeId;
  nextState: CellStateData | null;
  consumedSupplies: Record<SupplyId, number>;
  consumedResources: ResourceDelta;
  producedResources: ResourceDelta;
  emissions: SupplyEmission[];
  notification: CellNotificationDraft | null;
  matchedLabel?: string;
  matchedTone?: StatusTone;
  firstFailedConditions?: Condition[];
}

export interface ClickExecutionResult {
  uiAction: UiClickAction | null;
  mutated: boolean;
}

export interface DemolishInfo {
  lines: { label: string; value: string; tone?: StatusTone }[];
  warnings: string[];
}

export interface CellInspection {
  x: number;
  y: number;
  cellType: CellTypeManifest;
  state: CellStateData;
  supplies: Record<SupplyId, number>;
  nextCellType: CellTypeManifest;
  willChange: boolean;
  transitionLabel: string;
  transitionTone: StatusTone;
  statusBadge: StatusBadge | null;
}

export interface ResourceProjectionBreakdown {
  gained: number;
  consumed: number;
  net: number;
}

export interface SimulationStats {
  cycle: number;
  counts: Record<CellTypeId, number>;
  totalCells: number;
  resources: Record<ResourceId, number>;
  resourceCaps: Record<ResourceId, number | null>;
  projectedDelta: ResourceDelta;
  projectedBreakdown: Record<ResourceId, ResourceProjectionBreakdown>;
  atRiskCount: number;
}

export interface StepResult {
  cycle: number;
  producedResourcesDelta: ResourceDelta;
  consumedResourcesDelta: ResourceDelta;
  lostCellsCount: number;
  consumedTotals: Record<SupplyId, number>;
  producedTotals: Record<SupplyId, number>;
  notifications: CellNotification[];
}

export interface AffordabilityCheck {
  ok: boolean;
  missing: {
    resourceId: ResourceId;
    resourceName: string;
    need: number;
    have: number;
  }[];
}

export interface SerializedSimulationState {
  rulesetId: string;
  width: number;
  height: number;
  cycle: number;
  resources: Record<ResourceId, number>;
  grid: number[];
  cellStates: (CellStateData | null)[];
  supplies: Record<SupplyId, number[]>;
  notifications: CellNotification[];
}
