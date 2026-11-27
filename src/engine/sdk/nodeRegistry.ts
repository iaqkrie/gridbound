import { GraphScope, PortType } from './types';

export interface PortDef {
  id: string;
  label: string;
  type: PortType;
}

export type NodeCategory =
  | 'event'
  | 'flow'
  | 'value'
  | 'math'
  | 'logic'
  | 'string'
  | 'global'
  | 'cell'
  | 'supply'
  | 'world'
  | 'notify'
  | 'ui'
  | 'generator';

export interface NodeDefinition {
  type: string;
  label: string;
  category: NodeCategory;
  scopes: GraphScope[];
  pure?: boolean;
  inputs: PortDef[];
  outputs: PortDef[];
  defaultData?: Record<string, unknown>;
}

const ALL_LOGIC_SCOPES: GraphScope[] = ['cell', 'global', 'interface'];
const CELL_AND_UI_SCOPES: GraphScope[] = ['cell', 'interface'];

export const NODE_REGISTRY: Record<string, NodeDefinition> = {
  // ── Events ───────────────────────────────────────────────────────────────
  'event.click': {
    type: 'event.click',
    label: 'On Click',
    category: 'event',
    scopes: ['cell'],
    inputs: [],
    outputs: [
      { id: 'left', label: 'Left Click', type: 'exec' },
      { id: 'right', label: 'Right Click', type: 'exec' },
    ],
  },
  'event.cycle': {
    type: 'event.cycle',
    label: 'On Cycle',
    category: 'event',
    scopes: ['cell'],
    inputs: [],
    outputs: [
      { id: 'supply', label: 'Supply Phase', type: 'exec' },
      { id: 'produce', label: 'Produce Phase', type: 'exec' },
      { id: 'react', label: 'React Phase', type: 'exec' },
    ],
  },
  'event.enter': {
    type: 'event.enter',
    label: 'On Enter',
    category: 'event',
    scopes: ['cell'],
    inputs: [],
    outputs: [
      { id: 'out', label: 'Exec', type: 'exec' },
      { id: 'from', label: 'From', type: 'string' },
      { id: 'to', label: 'To', type: 'string' },
      { id: 'reason', label: 'Reason', type: 'string' },
    ],
  },
  'event.exit': {
    type: 'event.exit',
    label: 'On Exit',
    category: 'event',
    scopes: ['cell'],
    inputs: [],
    outputs: [
      { id: 'out', label: 'Exec', type: 'exec' },
      { id: 'from', label: 'From', type: 'string' },
      { id: 'to', label: 'To', type: 'string' },
      { id: 'reason', label: 'Reason', type: 'string' },
    ],
  },
  'event.worldStart': {
    type: 'event.worldStart',
    label: 'On World Start',
    category: 'event',
    scopes: ['global'],
    inputs: [],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
  },
  'event.worldCycle': {
    type: 'event.worldCycle',
    label: 'On World Cycle',
    category: 'event',
    scopes: ['global'],
    inputs: [],
    outputs: [
      { id: 'supply', label: 'Supply Phase', type: 'exec' },
      { id: 'produce', label: 'Produce Phase', type: 'exec' },
      { id: 'react', label: 'React Phase', type: 'exec' },
    ],
  },
  'event.uiAction': {
    type: 'event.uiAction',
    label: 'On UI Action',
    category: 'event',
    scopes: ['interface'],
    inputs: [],
    outputs: [
      { id: 'out', label: 'Exec', type: 'exec' },
      { id: 'value', label: 'Value', type: 'any' },
    ],
    defaultData: { actionId: 'action' },
  },

  // ── Flow Control ─────────────────────────────────────────────────────────
  'flow.branch': {
    type: 'flow.branch',
    label: 'Branch',
    category: 'flow',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'condition', label: 'Condition', type: 'boolean' },
    ],
    outputs: [
      { id: 'true', label: 'True', type: 'exec' },
      { id: 'false', label: 'False', type: 'exec' },
    ],
  },
  'flow.sequence': {
    type: 'flow.sequence',
    label: 'Sequence',
    category: 'flow',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [{ id: 'in', label: 'Exec', type: 'exec' }],
    outputs: [
      { id: 'then0', label: 'Then 0', type: 'exec' },
      { id: 'then1', label: 'Then 1', type: 'exec' },
      { id: 'then2', label: 'Then 2', type: 'exec' },
      { id: 'then3', label: 'Then 3', type: 'exec' },
    ],
  },
  'flow.switchString': {
    type: 'flow.switchString',
    label: 'Switch (String)',
    category: 'flow',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'value', label: 'Value', type: 'string' },
    ],
    outputs: [{ id: 'default', label: 'Default', type: 'exec' }],
    defaultData: { cases: [] },
  },
  'flow.chance': {
    type: 'flow.chance',
    label: 'Chance',
    category: 'flow',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'probability', label: 'Probability', type: 'number' },
    ],
    outputs: [
      { id: 'pass', label: 'Pass', type: 'exec' },
      { id: 'fail', label: 'Fail', type: 'exec' },
    ],
    defaultData: { probability: 0.5 },
  },

  // ── Constants & Context ──────────────────────────────────────────────────
  'const.value': {
    type: 'const.value',
    label: 'Constant',
    category: 'value',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [],
    outputs: [{ id: 'value', label: 'Value', type: 'any' }],
    defaultData: { value: 0 },
  },
  'get.setupParam': {
    type: 'get.setupParam',
    label: 'Get Setup Option',
    category: 'value',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [],
    outputs: [{ id: 'value', label: 'Value', type: 'any' }],
    defaultData: { paramId: '' },
  },
  'get.cycle': {
    type: 'get.cycle',
    label: 'Get Cycle',
    category: 'value',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [],
    outputs: [{ id: 'cycle', label: 'Cycle', type: 'number' }],
  },
  'get.cellPos': {
    type: 'get.cellPos',
    label: 'Get Cell Position',
    category: 'value',
    scopes: CELL_AND_UI_SCOPES,
    pure: true,
    inputs: [],
    outputs: [
      { id: 'x', label: 'X', type: 'number' },
      { id: 'y', label: 'Y', type: 'number' },
    ],
  },
  'get.cellType': {
    type: 'get.cellType',
    label: 'Get Cell Type',
    category: 'value',
    scopes: CELL_AND_UI_SCOPES,
    pure: true,
    inputs: [],
    outputs: [
      { id: 'id', label: 'ID', type: 'string' },
      { id: 'name', label: 'Name', type: 'string' },
    ],
  },
  'get.uiParam': {
    type: 'get.uiParam',
    label: 'Get UI Param',
    category: 'value',
    scopes: ['interface'],
    pure: true,
    inputs: [],
    outputs: [{ id: 'value', label: 'Value', type: 'any' }],
    defaultData: { key: '' },
  },
  'get.globalVarName': {
    type: 'get.globalVarName',
    label: 'Get Global Variable Name',
    category: 'value',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [{ id: 'varId', label: 'Var ID', type: 'string' }],
    outputs: [{ id: 'name', label: 'Name', type: 'string' }],
    defaultData: { varId: '' },
  },

  // ── Math, Logic & String ─────────────────────────────────────────────────
  'math.op': {
    type: 'math.op',
    label: 'Math',
    category: 'math',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [
      { id: 'a', label: 'A', type: 'number' },
      { id: 'b', label: 'B', type: 'number' },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
    defaultData: { op: 'add', a: 0, b: 0 },
  },
  'math.clamp': {
    type: 'math.clamp',
    label: 'Clamp',
    category: 'math',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [
      { id: 'value', label: 'Value', type: 'number' },
      { id: 'min', label: 'Min', type: 'number' },
      { id: 'max', label: 'Max', type: 'number' },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
    defaultData: { min: 0, max: 100 },
  },
  'math.round': {
    type: 'math.round',
    label: 'Round',
    category: 'math',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [{ id: 'value', label: 'Value', type: 'number' }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
    defaultData: { mode: 'floor' },
  },
  'logic.compare': {
    type: 'logic.compare',
    label: 'Compare',
    category: 'logic',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [
      { id: 'a', label: 'A', type: 'any' },
      { id: 'b', label: 'B', type: 'any' },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
    defaultData: { op: '==', b: 0 },
  },
  'logic.bool': {
    type: 'logic.bool',
    label: 'Boolean Op',
    category: 'logic',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [
      { id: 'a', label: 'A', type: 'boolean' },
      { id: 'b', label: 'B', type: 'boolean' },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
    defaultData: { op: 'and' },
  },
  'logic.select': {
    type: 'logic.select',
    label: 'Select',
    category: 'logic',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [
      { id: 'condition', label: 'Condition', type: 'boolean' },
      { id: 'ifTrue', label: 'If True', type: 'any' },
      { id: 'ifFalse', label: 'If False', type: 'any' },
    ],
    outputs: [{ id: 'value', label: 'Value', type: 'any' }],
  },
  'string.format': {
    type: 'string.format',
    label: 'Format String',
    category: 'string',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [
      { id: 'a', label: 'A', type: 'any' },
      { id: 'b', label: 'B', type: 'any' },
      { id: 'c', label: 'C', type: 'any' },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'string' }],
    defaultData: { template: '{a}' },
  },

  // ── GlobalState ──────────────────────────────────────────────────────────
  'global.get': {
    type: 'global.get',
    label: 'Get Global',
    category: 'global',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [{ id: 'varId', label: 'Var ID', type: 'string' }],
    outputs: [{ id: 'value', label: 'Value', type: 'any' }],
    defaultData: { varId: '' },
  },
  'global.getCap': {
    type: 'global.getCap',
    label: 'Get Global Cap',
    category: 'global',
    scopes: ALL_LOGIC_SCOPES,
    pure: true,
    inputs: [{ id: 'varId', label: 'Var ID', type: 'string' }],
    outputs: [{ id: 'cap', label: 'Cap', type: 'number' }],
    defaultData: { varId: '' },
  },
  'global.set': {
    type: 'global.set',
    label: 'Set Global',
    category: 'global',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'varId', label: 'Var ID', type: 'string' },
      { id: 'value', label: 'Value', type: 'any' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { varId: '', value: 0 },
  },
  'global.add': {
    type: 'global.add',
    label: 'Add Global',
    category: 'global',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'varId', label: 'Var ID', type: 'string' },
      { id: 'amount', label: 'Amount', type: 'number' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { varId: '', amount: 1 },
  },
  'global.consume': {
    type: 'global.consume',
    label: 'Consume Global',
    category: 'global',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'varId', label: 'Var ID', type: 'string' },
      { id: 'amount', label: 'Amount', type: 'number' },
    ],
    outputs: [
      { id: 'out', label: 'Consumed', type: 'exec' },
      { id: 'insufficient', label: 'Insufficient', type: 'exec' },
    ],
    defaultData: { varId: '', amount: 1 },
  },
  'global.addCap': {
    type: 'global.addCap',
    label: 'Add Global Cap',
    category: 'global',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'varId', label: 'Var ID', type: 'string' },
      { id: 'delta', label: 'Delta', type: 'number' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { varId: '', delta: 1 },
  },

  // ── Cell State, Visuals & Lifecycle ──────────────────────────────────────
  'cell.getState': {
    type: 'cell.getState',
    label: 'Get Cell State',
    category: 'cell',
    scopes: CELL_AND_UI_SCOPES,
    pure: true,
    inputs: [],
    outputs: [{ id: 'value', label: 'Value', type: 'any' }],
    defaultData: { key: '' },
  },
  'cell.setState': {
    type: 'cell.setState',
    label: 'Set Cell State',
    category: 'cell',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'value', label: 'Value', type: 'any' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { key: '', value: 0 },
  },
  'cell.addState': {
    type: 'cell.addState',
    label: 'Add Cell State',
    category: 'cell',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'amount', label: 'Amount', type: 'number' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { key: '', amount: 1 },
  },
  'cell.setSprite': {
    type: 'cell.setSprite',
    label: 'Set Sprite',
    category: 'cell',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'spriteId', label: 'Sprite ID', type: 'string' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { spriteId: null },
  },
  'cell.setColor': {
    type: 'cell.setColor',
    label: 'Set Color',
    category: 'cell',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'color', label: 'Color', type: 'string' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { color: null },
  },
  'cell.setOpacity': {
    type: 'cell.setOpacity',
    label: 'Set Opacity',
    category: 'cell',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'opacity', label: 'Opacity', type: 'number' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { opacity: 1 },
  },
  'cell.transform': {
    type: 'cell.transform',
    label: 'Transform Self',
    category: 'cell',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'toId', label: 'Target Cell ID', type: 'string' },
      { id: 'reason', label: 'Reason', type: 'string' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { toId: '', reason: '' },
  },

  // ── Supplies (Unified Numeric) ───────────────────────────────────────────
  'supply.get': {
    type: 'supply.get',
    label: 'Get Supply Here',
    category: 'supply',
    scopes: CELL_AND_UI_SCOPES,
    pure: true,
    inputs: [],
    outputs: [{ id: 'amount', label: 'Amount', type: 'number' }],
    defaultData: { supplyId: '' },
  },
  'supply.emit': {
    type: 'supply.emit',
    label: 'Emit Supply',
    category: 'supply',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'amount', label: 'Amount', type: 'number' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: {
      supplyId: '',
      amount: 1,
      area: { shape: 'moore', radius: 1 },
      includeSelf: true,
    },
  },
  'supply.consume': {
    type: 'supply.consume',
    label: 'Consume Supply',
    category: 'supply',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'amount', label: 'Amount', type: 'number' },
    ],
    outputs: [
      { id: 'out', label: 'Consumed', type: 'exec' },
      { id: 'insufficient', label: 'Insufficient', type: 'exec' },
    ],
    defaultData: { supplyId: '', amount: 1 },
  },

  // ── World Utilities ──────────────────────────────────────────────────────
  'world.reclaimCellState': {
    type: 'world.reclaimCellState',
    label: 'Reclaim Cell State',
    category: 'world',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'amount', label: 'Amount', type: 'number' },
    ],
    outputs: [
      { id: 'out', label: 'Exec', type: 'exec' },
      { id: 'reclaimed', label: 'Reclaimed', type: 'number' },
    ],
    defaultData: {
      stateKey: 'worker',
      amount: 1,
      resetVisualToDefault: false,
    },
  },

  // ── Notifications ────────────────────────────────────────────────────────
  'notify.global': {
    type: 'notify.global',
    label: 'Global Notification',
    category: 'notify',
    scopes: ALL_LOGIC_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'title', label: 'Title', type: 'string' },
      { id: 'message', label: 'Message', type: 'string' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { severity: 'info', title: '', message: '' },
  },
  'notify.cell': {
    type: 'notify.cell',
    label: 'Cell Notification',
    category: 'notify',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'title', label: 'Title', type: 'string' },
      { id: 'message', label: 'Message', type: 'string' },
    ],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
    defaultData: { severity: 'warning', title: '', message: '' },
  },
  'notify.clearCell': {
    type: 'notify.clearCell',
    label: 'Clear Cell Notifications',
    category: 'notify',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [{ id: 'in', label: 'Exec', type: 'exec' }],
    outputs: [{ id: 'out', label: 'Exec', type: 'exec' }],
  },

  // ── Universal Interfaces ─────────────────────────────────────────────────
  'ui.openInterface': {
    type: 'ui.openInterface',
    label: 'Open Interface',
    category: 'ui',
    scopes: CELL_AND_UI_SCOPES,
    inputs: [{ id: 'in', label: 'Exec', type: 'exec' }],
    outputs: [
      { id: 'onResult', label: 'On Result', type: 'exec' },
      { id: 'onCancel', label: 'On Cancel', type: 'exec' },
      { id: 'result', label: 'Result', type: 'any' },
    ],
    defaultData: { interfaceId: '', params: {} },
  },
  'ui.closeInterface': {
    type: 'ui.closeInterface',
    label: 'Close Interface',
    category: 'ui',
    scopes: ['interface'],
    inputs: [
      { id: 'in', label: 'Exec', type: 'exec' },
      { id: 'result', label: 'Result', type: 'any' },
    ],
    outputs: [],
    defaultData: {},
  },

  // ── World Generator (Layer & Mask Dataflow) ──────────────────────────────
  'gen.setupParam': {
    type: 'gen.setupParam',
    label: 'Setup Parameter',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [],
    outputs: [{ id: 'value', label: 'Value', type: 'any' }],
    defaultData: { paramId: '' },
  },
  'gen.mapSize': {
    type: 'gen.mapSize',
    label: 'Map Size',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [],
    outputs: [
      { id: 'width', label: 'Width', type: 'number' },
      { id: 'height', label: 'Height', type: 'number' },
    ],
  },
  'gen.constNumber': {
    type: 'gen.constNumber',
    label: 'Number',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [],
    outputs: [{ id: 'value', label: 'Value', type: 'number' }],
    defaultData: { value: 0 },
  },
  'gen.math': {
    type: 'gen.math',
    label: 'Math',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [
      { id: 'a', label: 'A', type: 'number' },
      { id: 'b', label: 'B', type: 'number' },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
    defaultData: { op: 'mul', a: 1, b: 1 },
  },
  'gen.noise': {
    type: 'gen.noise',
    label: 'Noise Mask',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [{ id: 'scale', label: 'Scale', type: 'number' }],
    outputs: [{ id: 'mask', label: 'Mask', type: 'mask' }],
    defaultData: { scale: 6, octaves: 2, seedOffset: 0 },
  },
  'gen.clusters': {
    type: 'gen.clusters',
    label: 'Cluster Mask',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [
      { id: 'coverage', label: 'Coverage', type: 'number' },
      { id: 'clusterSize', label: 'Cluster Size', type: 'number' },
    ],
    outputs: [{ id: 'mask', label: 'Mask', type: 'mask' }],
    defaultData: { targetCoverage: 0.12, clusterSize: 5, seedOffset: 0 },
  },
  'gen.scatter': {
    type: 'gen.scatter',
    label: 'Scatter Mask',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [{ id: 'density', label: 'Density', type: 'number' }],
    outputs: [{ id: 'mask', label: 'Mask', type: 'mask' }],
    defaultData: { density: 0.1, seedOffset: 0 },
  },
  'gen.distanceFromLayer': {
    type: 'gen.distanceFromLayer',
    label: 'Distance From Layer',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [{ id: 'layer', label: 'Layer', type: 'layer' }],
    outputs: [{ id: 'mask', label: 'Mask', type: 'mask' }],
    defaultData: { maxDistance: 5 },
  },
  'gen.threshold': {
    type: 'gen.threshold',
    label: 'Threshold Mask',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [
      { id: 'mask', label: 'Mask', type: 'mask' },
      { id: 'min', label: 'Min', type: 'number' },
      { id: 'max', label: 'Max', type: 'number' },
    ],
    outputs: [{ id: 'mask', label: 'Mask', type: 'mask' }],
    defaultData: { min: 0.5, max: 1.0 },
  },
  'gen.invert': {
    type: 'gen.invert',
    label: 'Invert Mask',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [{ id: 'mask', label: 'Mask', type: 'mask' }],
    outputs: [{ id: 'mask', label: 'Mask', type: 'mask' }],
  },
  'gen.maskCombine': {
    type: 'gen.maskCombine',
    label: 'Combine Masks',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [
      { id: 'a', label: 'Mask A', type: 'mask' },
      { id: 'b', label: 'Mask B', type: 'mask' },
    ],
    outputs: [{ id: 'mask', label: 'Mask', type: 'mask' }],
    defaultData: { op: 'mul' },
  },
  'gen.fillLayer': {
    type: 'gen.fillLayer',
    label: 'Fill Layer',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [],
    outputs: [{ id: 'layer', label: 'Layer', type: 'layer' }],
    defaultData: { cellTypeId: '' },
  },
  'gen.paintLayer': {
    type: 'gen.paintLayer',
    label: 'Paint Layer',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [
      { id: 'mask', label: 'Mask', type: 'mask' },
      { id: 'threshold', label: 'Threshold', type: 'number' },
    ],
    outputs: [{ id: 'layer', label: 'Layer', type: 'layer' }],
    defaultData: { cellTypeId: '', threshold: 0.5 },
  },
  'gen.mergeLayers': {
    type: 'gen.mergeLayers',
    label: 'Merge Layers',
    category: 'generator',
    scopes: ['generator'],
    pure: true,
    inputs: [
      { id: 'base', label: 'Base Layer', type: 'layer' },
      { id: 'overlay', label: 'Overlay Layer', type: 'layer' },
    ],
    outputs: [{ id: 'layer', label: 'Layer', type: 'layer' }],
  },
  'gen.output': {
    type: 'gen.output',
    label: 'World Output',
    category: 'generator',
    scopes: ['generator'],
    inputs: [{ id: 'layer', label: 'Layer', type: 'layer' }],
    outputs: [],
  },
};

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_REGISTRY[type];
}

export function getNodesForScope(scope: GraphScope): NodeDefinition[] {
  return Object.values(NODE_REGISTRY).filter((def) => def.scopes.includes(scope));
}
