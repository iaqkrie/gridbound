// ============================================================================
// Gridbound SDK — Core Schema v4 (0.1.0-alpha.2)
// Node-Native Engine Core, GlobalState Access Control, Unified Numeric Supplies,
// 32×32 PNG Sprite Registry, Layer/Mask World Generator & Universal Interfaces
// ============================================================================

export const APP_VERSION = '0.1.0-alpha.2';
export const CURRENT_SCHEMA_VERSION = 4 as const;

export type CellTypeId = string;
export type SupplyId = string;
export type GlobalVarId = string;
export type SpriteId = string;
export type InterfaceId = string;

export type AccessLevel = 'public' | 'readonly' | 'private';
export type ValueType = 'number' | 'boolean' | 'string';
export type RuntimeValue = number | boolean | string;

export type CompareOp = '==' | '!=' | '>' | '>=' | '<' | '<=';

// ============================================================================
// 1. Sprites & Runtime Cell Visuals (32×32 PNG)
// ============================================================================

export interface SpriteAssetManifest {
  id: SpriteId;
  name: string;
  width: 32;
  height: 32;
  dataUrl: string;
}

export interface CellVisualState {
  spriteId: SpriteId | null;
  tintColor: string | null;
  opacity: number;
}

// ============================================================================
// 2. Decay & Unified Numeric Supplies
// ============================================================================

export type DecayRule =
  | { kind: 'clear' }
  | { kind: 'none' }
  | { kind: 'linear'; amount: number }
  | {
      kind: 'percent';
      retainRatio: number;
      round?: 'floor' | 'ceil' | 'round';
      minStep?: number;
    };

export interface SupplyManifest {
  id: SupplyId;
  name: string;
  description?: string;
  color: string;
  maxExpected: number;
  maxAmount?: number;
  decay: DecayRule;
  showInOverlay?: boolean;
}

export type EmitArea =
  | { shape: 'self' }
  | { shape: 'moore'; radius: number }
  | { shape: 'vonNeumann'; radius: number }
  | { shape: 'coords'; x: number; y: number }
  | { shape: 'relative'; dx: number; dy: number };

// ============================================================================
// 3. Node Graph IR (Unified across Cell, Global, Interface & WorldGenerator)
// ============================================================================

export type GraphScope = 'cell' | 'global' | 'interface' | 'generator';

export type PortType =
  | 'exec'
  | 'number'
  | 'boolean'
  | 'string'
  | 'any'
  | 'mask'
  | 'layer';

export interface GraphNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
}

export interface NodeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============================================================================
// 4. GlobalState (Variables, Access Control, HUD Config & World Graph)
// ============================================================================

export interface GlobalVariableManifest {
  id: GlobalVarId;
  name: string;
  shortName?: string;
  description?: string;
  type: ValueType;
  initialValue: RuntimeValue;
  hasCap?: boolean;
  initialMax?: number;
  allowNegative?: boolean;
  decay?: DecayRule;
  access: AccessLevel;
  color?: string;
  tags?: string[];
}

export interface HudItemManifest {
  variableId: GlobalVarId;
  label?: string;
  color?: string;
  showCap?: boolean;
  showDelta?: boolean;
}

export interface GlobalStateManifest {
  variables: GlobalVariableManifest[];
  hud: HudItemManifest[];
  graph: NodeGraph;
}

// ============================================================================
// 5. Setup Options
// ============================================================================

export interface SetupOptionManifest {
  id: string;
  label: string;
  description?: string;
  type: 'number' | 'boolean' | 'select';
  defaultValue: RuntimeValue;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

// ============================================================================
// 6. Universal Interfaces (Built-in Templates + Custom Node-Driven Interfaces)
// ============================================================================

export type BuiltinInterfaceId =
  | '@builtin/cell_picker'
  | '@builtin/confirm'
  | '@builtin/inspector';

export type InterfaceRole = 'popover' | 'modal' | 'hover';

export interface UiCondition {
  source: 'state' | 'global' | 'globalCap' | 'supply' | 'param' | 'setup';
  key: string;
  op: CompareOp;
  value: RuntimeValue;
}

export interface UiButtonDef {
  label: string;
  actionId?: string;
  closeResult?: RuntimeValue;
  variant?: 'primary' | 'secondary' | 'danger';
  disabledWhen?: UiCondition[];
  visibleWhen?: UiCondition[];
}

export type InterfaceBlock =
  | {
      kind: 'text';
      text: string;
      tone?: 'default' | 'muted' | 'accent' | 'positive' | 'warning' | 'danger';
      visibleWhen?: UiCondition[];
    }
  | {
      kind: 'stat';
      label: string;
      value: string;
      tone?: 'default' | 'muted' | 'accent' | 'positive' | 'warning' | 'danger';
      visibleWhen?: UiCondition[];
    }
  | {
      kind: 'button';
      label: string;
      actionId?: string;
      closeResult?: RuntimeValue;
      variant?: 'primary' | 'secondary' | 'danger';
      disabledWhen?: UiCondition[];
      visibleWhen?: UiCondition[];
    }
  | {
      kind: 'buttonRow';
      buttons: UiButtonDef[];
      visibleWhen?: UiCondition[];
    }
  | {
      kind: 'selectList';
      label?: string;
      actionId: string;
      source: 'globalVars' | 'static';
      filterTag?: string;
      filterHasCap?: boolean;
      selectedStateKey?: string;
      options?: { value: string; label: string; subtitle?: string; color?: string }[];
      visibleWhen?: UiCondition[];
    }
  | {
      kind: 'cellStateList';
      excludeKeys?: string[];
      visibleWhen?: UiCondition[];
    }
  | {
      kind: 'supplyList';
      onlyPositive?: boolean;
      visibleWhen?: UiCondition[];
    };

export interface InterfaceManifest {
  id: InterfaceId;
  title: string;
  subtitle?: string;
  width?: number;
  role?: InterfaceRole;
  showSwatch?: boolean;
  blocks: InterfaceBlock[];
  graph?: NodeGraph;
}

// Payload shapes for built-in interfaces
export interface CellPickerOption {
  cellId: CellTypeId;
  label?: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: 'default' | 'positive' | 'warning' | 'danger';
  disabled?: boolean;
  /** Optional simple requirements checked dynamically against global vars */
  requires?: { varId: GlobalVarId; min: number }[];
}

export interface ConfirmLine {
  text: string;
  tone?: 'default' | 'muted' | 'positive' | 'warning' | 'danger';
}

export interface OpenInterfaceRequest {
  interfaceId: InterfaceId;
  cellX: number;
  cellY: number;
  params: Record<string, unknown>;
}

// ============================================================================
// 7. Cell Types & State Schema
// ============================================================================

export interface StateFieldManifest {
  key: string;
  label?: string;
  type: ValueType;
  initialValue: RuntimeValue;
  access: AccessLevel;
}

export interface CellTypeManifest {
  id: CellTypeId;
  name: string;
  description?: string;
  defaultSpriteId: SpriteId | null;
  defaultColor: string;
  defaultOpacity?: number;
  substrateSpriteId?: SpriteId | null;
  stateSchema: StateFieldManifest[];
  /** Higher state value executes earlier in Phase 4 (React) */
  priorityByState?: string;
  /** undefined = inherit ruleset.defaultHoverInterfaceId; null = disable hover card */
  hoverInterfaceId?: InterfaceId | null;
  graph: NodeGraph;
}

// ============================================================================
// 8. Top-Level Ruleset Manifest (Schema v4)
// ============================================================================

export interface RulesetManifest {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  id: string;
  name: string;
  description?: string;
  author?: string;
  defaultGridSize: { width: number; height: number };
  defaultCellTypeId: CellTypeId;
  defaultHoverInterfaceId?: InterfaceId | null;
  setupOptions?: SetupOptionManifest[];
  sprites: SpriteAssetManifest[];
  globalState: GlobalStateManifest;
  supplies: SupplyManifest[];
  interfaces: InterfaceManifest[];
  worldGenerator: NodeGraph;
  cellTypes: CellTypeManifest[];
}

// ============================================================================
// 9. Runtime Snapshots, Notifications, Stats & Saves
// ============================================================================

export type NotificationScope = 'global' | 'cell';
export type NotificationSeverity = 'info' | 'warning' | 'danger';

export interface GameNotification {
  id: string;
  scope: NotificationScope;
  severity: NotificationSeverity;
  title: string;
  message: string;
  cycle: number;
  x?: number;
  y?: number;
  cellTypeId?: CellTypeId;
}

export interface ResourceBreakdown {
  gained: number;
  consumed: number;
}

export interface SimulationStats {
  cycle: number;
  globalValues: Record<GlobalVarId, RuntimeValue>;
  globalCaps: Record<GlobalVarId, number>;
  projectedDelta: Record<GlobalVarId, number>;
  projectedBreakdown: Record<GlobalVarId, ResourceBreakdown>;
  cellCounts: Record<CellTypeId, number>;
}

export interface CellRuntimeSnapshot {
  x: number;
  y: number;
  cellType: CellTypeManifest;
  visual: CellVisualState;
  /** Filtered to public + readonly fields */
  visibleState: {
    key: string;
    label: string;
    type: ValueType;
    value: RuntimeValue;
    access: AccessLevel;
  }[];
  supplies: {
    id: SupplyId;
    name: string;
    color: string;
    amount: number;
  }[];
}

export interface SerializedSimulationState {
  version: 4;
  rulesetId: string;
  width: number;
  height: number;
  cycle: number;
  seed: string;
  setupValues: Record<string, RuntimeValue>;
  grid: CellTypeId[];
  cellStates: Record<string, Record<string, RuntimeValue>>;
  cellVisuals: Record<string, CellVisualState>;
  globalValues: Record<GlobalVarId, RuntimeValue>;
  globalCaps: Record<GlobalVarId, number>;
  supplies: Record<SupplyId, number[]>;
  notifications: GameNotification[];
}

export type SeededRng = () => number;

export interface GridCoordinate {
  x: number;
  y: number;
}

export type MouseButton = 'left' | 'right' | 'middle';

export type SupplyOverlayMode = 'off' | 'heatmap' | 'numbers';

export interface WorldSetupValues {
  width: number;
  height: number;
  seed: string;
  params: Record<string, RuntimeValue>;
}

