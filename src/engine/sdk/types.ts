import type { ComponentType } from 'react';
import type { SoundKind } from '../../utils/sound';

// ============================================================================
// Primitive Identifiers & Shared Types
// ============================================================================

export type SupplyId = string;
export type CellTypeId = string;
export type ResourceId = string;

export type BoundaryMode = 'toroidal' | 'bounded';
export type NeighborhoodType = 'moore' | 'vonNeumann' | 'self';
export type MouseButton = 'left' | 'right' | 'middle';
export type SupplyOverlayMode = 'off' | 'heatmap' | 'numbers';

export type ResourceDelta = Record<ResourceId, number>;
export type CellStateValue = number | string | boolean;
export type CellStateData = Record<string, CellStateValue>;
export type StatusTone = 'neutral' | 'positive' | 'warning' | 'danger';

export interface StatusBadge {
  text: string;
  tone: StatusTone;
}

export interface GridCoordinate {
  x: number;
  y: number;
}

/**
 * Reference to a TS/TSX module resolved in package modules first, then SDK builtins.
 * Supports either a shorthand string `"builtin:workerPanel"` or `{ ref, params }`.
 */
export type ModuleRef<TParams = Record<string, unknown>> =
  | string
  | {
      ref: string;
      params?: TParams;
    };

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
      /** Minimum decay step when value > 0 (prevents getting stuck at 1) */
      minStep?: number;
    };

// ============================================================================
// Global Resources — Strictly 2 kinds: 'unlimited' | 'capped'
// ============================================================================

interface BaseResourceManifest {
  id: ResourceId;
  name: string;
  shortName?: string;
  description: string;
  color: string;
  initialValue: number;
  /** Optional tags used by modules (e.g. ['storable'] for Warehouse) */
  tags?: string[];
  /** Optional Phase 2 decay rule */
  decay?: DecayRule;
}

export interface UnlimitedResourceManifest extends BaseResourceManifest {
  kind: 'unlimited';
}

export interface CappedResourceManifest extends BaseResourceManifest {
  kind: 'capped';
  /** Base maximum capacity before dynamic cell cap bonuses */
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
  description: string;
  color: string;
  /** Reference value for 100% heatmap intensity */
  maxExpected: number;
  /** Optional hard stacking cap per tile after Phase 3 production */
  maxAmount?: number;
  /** Phase 2 decay applied to remaining unconsumed supply on each tile */
  decay: DecayRule;
}

export interface SupplyEmission {
  supplyId: SupplyId;
  amount: number;
  radius: number;
  neighborhood: NeighborhoodType;
  includeSelf: boolean;
}

// ============================================================================
// New-Game Setup Options & World Generator
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

export interface GridMutator {
  readonly width: number;
  readonly height: number;
  clear: () => void;
  getCell: (x: number, y: number) => CellTypeId;
  setCell: (x: number, y: number, cellTypeId: CellTypeId) => void;
}

export type SeededRng = () => number;

export type WorldGeneratorFn<TParams = Record<string, unknown>> = (
  grid: GridMutator,
  setup: WorldSetupValues,
  params: TParams,
  rng: SeededRng
) => void;

// ============================================================================
// Cell Manifest (JSON-serializable cell definition)
// ============================================================================

export type CellGlyph =
  | 'solid'
  | 'farm'
  | 'house'
  | 'water'
  | 'forest'
  | 'mountain'
  | 'sawmill'
  | 'quarry'
  | 'warehouse'
  | 'empty';

export interface CellVisualManifest {
  color: string;
  glyph?: CellGlyph;
  /** Optional custom SVG path in a 24x24 viewBox rendered via Canvas Path2D */
  svgPath?: string;
  /** Optional background substrate color tint */
  substrateColor?: string;
}

export type CellClickAction =
  | { kind: 'none' }
  | { kind: 'setCell'; cellTypeId: CellTypeId }
  | { kind: 'openBuildMenu'; options: CellTypeId[] }
  | { kind: 'openPanel' }
  | { kind: 'openDemolishConfirm' };

export interface CellTypeManifest {
  id: CellTypeId;
  name: string;
  description: string;
  shortRule: string;
  visual: CellVisualManifest;
  initialState?: CellStateData;
  emissions?: SupplyEmission[];
  /** Positive resource amounts deducted on construction */
  buildCost?: ResourceDelta;
  /** Immediate global resource delta applied on construction */
  onBuildEffect?: ResourceDelta;
  /** Global resource delta applied on manual demolition */
  onDemolishEffect?: ResourceDelta;
  /** Cell type restored on manual demolition (defaults to manifest.defaultCellTypeId) */
  demolishTo?: CellTypeId;
  /** Static resource max-capacity bonus while this cell exists (e.g. House +1 population max) */
  capBonus?: ResourceDelta;
  onClick?: {
    left?: CellClickAction;
    right?: CellClickAction;
  };
  /** Optional TS behavior module ref (+ optional params) */
  behavior?: ModuleRef;
  /** Optional TSX panel module ref (+ optional params), rendered on openPanel */
  panel?: ModuleRef;
}

// ============================================================================
// Top-Level Ruleset Manifest (ruleset.json)
// ============================================================================

export interface RulesetManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  author?: string;
  boundaryMode: BoundaryMode;
  defaultOverlayMode: SupplyOverlayMode;
  defaultGridSize: { width: number; height: number };
  defaultCellTypeId: CellTypeId;
  /** Number of cycles executed automatically on new game start (default 1) */
  initialCycles?: number;
  setupOptions?: SetupOptionsManifest;
  worldGenerator: ModuleRef;
  resources: ResourceManifest[];
  supplies: SupplyManifest[];
  cellTypes: CellTypeManifest[];
}

// ============================================================================
// Notifications & Cycle Outcomes
// ============================================================================

export type NotificationSeverity = 'warning' | 'danger';

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
  /** Updated per-cell state persisted if cell stays the same type */
  nextState?: CellStateData | null;
  /** Spatial supplies physically subtracted from this cell's tile buffer in Phase 1 */
  consumed?: Record<SupplyId, number>;
  /** Positive global resource amounts consumed from the shared pool in Phase 1 */
  consumedResources?: ResourceDelta;
  /** Global resources produced in Phase 3 for the next cycle */
  producedResources?: ResourceDelta;
  /** Whether this cell's spatial emissions fire in Phase 3 */
  canEmit?: boolean;
  /** Optional notification emitted by this cell */
  notification?: CellNotificationDraft | null;
}

export interface TransitionExplanation {
  nextTypeId: CellTypeId;
  label: string;
  tone: StatusTone;
}

export interface DemolishInfo {
  lines?: { label: string; value: string; tone?: StatusTone }[];
  warnings?: string[];
}

// ============================================================================
// World API (Pure engine surface exposed to TS behaviors & TSX panels)
// ============================================================================

export interface WorldCellSnapshot {
  x: number;
  y: number;
  cellTypeId: CellTypeId;
  state: CellStateData;
}

export interface WorldApi {
  readonly width: number;
  readonly height: number;
  readonly cycle: number;
  readonly manifest: RulesetManifest;
  getResource: (id: ResourceId) => number;
  getResourceCap: (id: ResourceId) => number | null;
  getResources: () => Record<ResourceId, number>;
  getResourceCaps: () => Record<ResourceId, number | null>;
  addResource: (id: ResourceId, delta: number) => void;
  consumeResource: (id: ResourceId, amount: number) => boolean;
  getCellTypeIdAt: (x: number, y: number) => CellTypeId;
  getCellStateAt: (x: number, y: number) => CellStateData;
  patchCellState: (x: number, y: number, patch: CellStateData) => void;
  getLocalSupplies: (x: number, y: number) => Record<SupplyId, number>;
  clearNotificationsAt: (x: number, y: number) => void;
  reconcileResourceCaps: () => void;
  findCells: (
    predicate: (cell: WorldCellSnapshot) => boolean
  ) => WorldCellSnapshot[];
}

// ============================================================================
// TS Behavior & TSX Panel Module Contracts (Only 2 Context Shapes)
// ============================================================================

/**
 * Read-only snapshot passed to evaluation/inspection hooks.
 * During `onCycle` and `explainCycle`, `resources` reflects the live remaining pool.
 */
export interface CellContext {
  x: number;
  y: number;
  cellType: ResolvedCellType;
  state: CellStateData;
  supplies: Record<SupplyId, number>;
  resources: Record<ResourceId, number>;
  resourceCaps: Record<ResourceId, number | null>;
  manifest: RulesetManifest;
}

/**
 * Mutating context passed to lifecycle hooks (`onBuild`, `onDemolish`, `onTickLost`).
 */
export interface CellLifecycleContext {
  x: number;
  y: number;
  cellType: ResolvedCellType;
  state: CellStateData;
  world: WorldApi;
}

export interface CellBehaviorModule<TParams = Record<string, unknown>> {
  createInitialState?: (params: TParams) => CellStateData;
  getConsumePriority?: (state: CellStateData, params: TParams) => number;
  getCapBonus?: (state: CellStateData, params: TParams) => ResourceDelta | null;
  isActive?: (ctx: CellContext, params: TParams) => boolean;
  onCycle?: (ctx: CellContext, params: TParams) => CellTickOutcome;
  onBuild?: (ctx: CellLifecycleContext, params: TParams) => void;
  onDemolish?: (ctx: CellLifecycleContext, params: TParams) => void;
  onTickLost?: (ctx: CellLifecycleContext, params: TParams) => void;
  getStatusBadge?: (ctx: CellContext, params: TParams) => StatusBadge | null;
  getBuildPreview?: (ctx: CellContext, params: TParams) => StatusBadge | null;
  explainCycle?: (ctx: CellContext, params: TParams) => TransitionExplanation;
  getDemolishInfo?: (ctx: CellContext, params: TParams) => DemolishInfo;
}

export interface CellPanelProps<TParams = Record<string, unknown>> {
  x: number;
  y: number;
  cellType: ResolvedCellType;
  cellState: CellStateData;
  localSupplies: Record<SupplyId, number>;
  world: WorldApi;
  params: TParams;
  onMutated: (sound?: SoundKind) => void;
  onClose: () => void;
}

export type CellPanelComponent<TParams = Record<string, unknown>> =
  ComponentType<CellPanelProps<TParams>>;

// ============================================================================
// Ruleset Package & Compiled Runtime Types
// ============================================================================

export interface RulesetModuleMap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generators?: Record<string, WorldGeneratorFn<any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  behaviors?: Record<string, CellBehaviorModule<any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  panels?: Record<string, CellPanelComponent<any>>;
}

export interface RulesetPackage {
  manifest: RulesetManifest;
  modules?: RulesetModuleMap;
}

export interface ResolvedCellType {
  id: CellTypeId;
  name: string;
  description: string;
  shortRule: string;
  visual: CellVisualManifest;
  emissions: SupplyEmission[];
  initialState?: CellStateData;
  buildCost?: ResourceDelta;
  onBuildEffect?: ResourceDelta;
  onDemolishEffect?: ResourceDelta;
  demolishTo?: CellTypeId;
  capBonus?: ResourceDelta;
  onClick: {
    left: CellClickAction;
    right: CellClickAction;
  };
  behavior?: {
    ref: string;
    module: CellBehaviorModule<Record<string, unknown>>;
    params: Record<string, unknown>;
  };
  panel?: {
    ref: string;
    component: CellPanelComponent<Record<string, unknown>>;
    params: Record<string, unknown>;
  };
}

export interface CompiledRuleset {
  manifest: RulesetManifest;
  generator: {
    ref: string;
    fn: WorldGeneratorFn<Record<string, unknown>>;
    params: Record<string, unknown>;
  };
  cellTypes: ResolvedCellType[];
}

// ============================================================================
// Inspection, Stats, Step & Serialization Contracts
// ============================================================================

export interface CellInspection {
  x: number;
  y: number;
  cellType: ResolvedCellType;
  state: CellStateData;
  supplies: Record<SupplyId, number>;
  nextCellType: ResolvedCellType;
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
