import {
  CellPickerOption,
  CellTypeManifest,
  ConfirmLine,
  createPixelSprite32,
  CURRENT_SCHEMA_VERSION,
  GraphEdge,
  GraphNode,
  InterfaceManifest,
  NodeGraph,
  RulesetManifest,
  SpriteAssetManifest,
} from '../../engine/sdk';

// ============================================================================
// Graph Builder Helper (clean, readable node graphs with tidy editor coords)
// ============================================================================

class GraphBuilder {
  public nodes: GraphNode[] = [];
  public edges: GraphEdge[] = [];
  private edgeSeq = 0;

  node(
    id: string,
    type: string,
    data?: Record<string, unknown>,
    position?: { x: number; y: number }
  ): string {
    this.nodes.push({ id, type, data, position });
    return id;
  }

  connect(
    fromNode: string,
    fromPort: string,
    toNode: string,
    toPort: string
  ): this {
    this.edges.push({
      id: `e_${++this.edgeSeq}`,
      fromNode,
      fromPort,
      toNode,
      toPort,
    });
    return this;
  }

  build(): NodeGraph {
    return { nodes: this.nodes, edges: this.edges };
  }
}

// ============================================================================
// 1. 32×32 PNG Pixel-Art Sprite Registry (Classic Colony)
// ============================================================================

function buildClassicSprites(): SpriteAssetManifest[] {
  return [
    createPixelSprite32(
      'terrain_empty',
      'Plains',
      {
        a: '#38414e',
        b: '#3f4958',
      },
      [
        '................',
        '................',
        '...a............',
        '................',
        '...........b....',
        '................',
        '................',
        '......b.........',
        '................',
        '............a...',
        '................',
        '..b.............',
        '................',
        '.........a......',
        '................',
        '................',
      ]
    ),
    createPixelSprite32(
      'terrain_water',
      'Water',
      {
        d: '#1b496b',
        m: '#23638f',
        l: '#4ea8de',
        h: '#90d5ff',
      },
      [
        'dddddddddddddddd',
        'ddmmmmmmddddmmmm',
        'dmmllmmddddmmllm',
        'ddmmmmmmddddmmmm',
        'dddddddddddddddd',
        'mmddddmmmmmmdddd',
        'mllhhmmllmmddmmm',
        'mmddddmmmmmmdddd',
        'dddddddddddddddd',
        'dddmmmmmmddddmmm',
        'ddmmllhhmmddmmll',
        'dddmmmmmmddddmmm',
        'dddddddddddddddd',
        'mmddmmmmmmdddddd',
        'mllmmllmmddddmmm',
        'dddddddddddddddd',
      ]
    ),
    createPixelSprite32(
      'terrain_forest',
      'Forest',
      {
        t: '#6b4423',
        d: '#1b4d33',
        m: '#267349',
        l: '#48a868',
      },
      [
        '................',
        '....ll..........',
        '...lmml....ll...',
        '..lmmmmd..lmml..',
        '..dmmmmd.lmmmmd.',
        '...dmmd..dmmmmd.',
        '..lmmmmd..dmmd..',
        '.lmmmmmmddmmmmd.',
        '.dmmmmmmmmmmmmd.',
        '...ddttddddttd..',
        '.....tt....tt...',
        '.....tt....tt...',
        '....dttd..dttd..',
        '................',
        '................',
        '................',
      ]
    ),
    createPixelSprite32(
      'terrain_mountain',
      'Mountain',
      {
        d: '#4b5563',
        m: '#6b7280',
        l: '#9ca3af',
        s: '#e5e7eb',
      },
      [
        '................',
        '................',
        '.......ss.......',
        '......ssss......',
        '.....ssllss.....',
        '.....lmllmd.....',
        '....lmmllmmd....',
        '...lmmmllmmmd...',
        '..lmmmd..lmmmd..',
        '..lmmd.ss.mmmd..',
        '.lmmm.slls.mmdd.',
        '.lmmmdlmllmmddd.',
        'lmmmmmllmmmmdddd',
        'dmmmmmmmmmmmdddd',
        'dddddddddddddddd',
        '................',
      ]
    ),
    createPixelSprite32(
      'farm_active',
      'Farm (Active)',
      {
        b: '#785028',
        d: '#a16207',
        g: '#eab308',
        h: '#fde047',
        e: '#4ade80',
      },
      [
        '................',
        '..bbbbbbbbbbbb..',
        '..bhhgghhgghhb..',
        '..bggddggddggb..',
        '..bbbbbbbbbbbb..',
        '..bhhgghhgghhb..',
        '..bggddggddggb..',
        '..bbbbbbbbbbbb..',
        '..bhhgghhgghhb..',
        '..bggddggddggb..',
        '..bbbbbbbbbbbb..',
        '..bhhgghhgghhb..',
        '..bggddggddggb..',
        '..bbbbbbbbbbbe..',
        '.............ee.',
        '................',
      ]
    ),
    createPixelSprite32(
      'farm_idle',
      'Farm (Idle)',
      {
        b: '#5c4632',
        d: '#786246',
        g: '#a89268',
        w: '#f59e0b',
      },
      [
        '................',
        '..bbbbbbbbbbbb..',
        '..bggddggddggb..',
        '..bddbbddbbddb..',
        '..bbbbbbbbbbbb..',
        '..bggddggddggb..',
        '..bddbbddbbddb..',
        '..bbbbbbbbbbbb..',
        '..bggddggddggb..',
        '..bddbbddbbddb..',
        '..bbbbbbbbbbbb..',
        '..bggddggddggb..',
        '..bddbbddbbddb..',
        '..bbbbbbbbbbbb..',
        '.............ww.',
        '.............ww.',
      ]
    ),
    createPixelSprite32(
      'sawmill_active',
      'Sawmill (Active)',
      {
        r: '#9a3412',
        w: '#c2783e',
        d: '#7c4a21',
        s: '#cbd5e1',
        h: '#f8fafc',
        e: '#4ade80',
      },
      [
        '................',
        '................',
        '.....rrrrrr.....',
        '...rrrrrrrrrr...',
        '..rrwwwwwwwwrr..',
        '..wwwwwwwwwwww..',
        '..wwddwwwwddww..',
        '..wwddssssddww..',
        '..wwwwshhswwww..',
        '..wwwwshhswwww..',
        '..ddddssssdddd..',
        '..dddddddddddd..',
        '....ww....ww....',
        '....dd....dd.ee.',
        '.............ee.',
        '................',
      ]
    ),
    createPixelSprite32(
      'sawmill_idle',
      'Sawmill (Idle)',
      {
        r: '#6e4332',
        w: '#8a6b52',
        d: '#594230',
        s: '#94a3b8',
        a: '#f59e0b',
      },
      [
        '................',
        '................',
        '.....rrrrrr.....',
        '...rrrrrrrrrr...',
        '..rrwwwwwwwwrr..',
        '..wwwwwwwwwwww..',
        '..wwddwwwwddww..',
        '..wwddssssddww..',
        '..wwwwsddswwww..',
        '..wwwwsddswwww..',
        '..ddddssssdddd..',
        '..dddddddddddd..',
        '....ww....ww....',
        '....dd....dd.aa.',
        '.............aa.',
        '................',
      ]
    ),
    createPixelSprite32(
      'quarry_active',
      'Quarry (Active)',
      {
        d: '#334155',
        m: '#64748b',
        l: '#94a3b8',
        h: '#e2e8f0',
        w: '#a16207',
        e: '#4ade80',
      },
      [
        '................',
        '....hhhhhh......',
        '...hllllllh.....',
        '..hllmmmmllh....',
        '..llmmddmmll....',
        '..lmddwwddml....',
        '..lmddwwddml....',
        '..lmmddddmml....',
        '..llmmmmmmll....',
        '...llllllll.....',
        '....dddddd......',
        '..lll....mmm....',
        '..lml....mdm.ee.',
        '..ddd....ddd.ee.',
        '................',
        '................',
      ]
    ),
    createPixelSprite32(
      'quarry_idle',
      'Quarry (Idle)',
      {
        d: '#2c3440',
        m: '#4e5968',
        l: '#717f90',
        w: '#785a3a',
        a: '#f59e0b',
      },
      [
        '................',
        '....llllll......',
        '...lmmmmmml.....',
        '..lmmddddmml....',
        '..mmddwwddmm....',
        '..mdddwwdddm....',
        '..mdddwwdddm....',
        '..mmddddddmm....',
        '..lmmmmmmmml....',
        '...llllllll.....',
        '....dddddd......',
        '..mmm....ddd....',
        '..mdm....ddd.aa.',
        '..ddd....ddd.aa.',
        '................',
        '................',
      ]
    ),
    createPixelSprite32(
      'house',
      'House',
      {
        r: '#dc2626',
        k: '#991b1b',
        w: '#e2e8f0',
        s: '#94a3b8',
        d: '#7c4a21',
        g: '#fde047',
      },
      [
        '................',
        '.......rr.......',
        '......rrrr......',
        '.....rrrrrr.....',
        '....rrrrrrrr....',
        '...rrrrrrrrrr...',
        '..krrrrrrrrrrk..',
        '..kwwwwwwwwwwk..',
        '...wggwwwwggw...',
        '...wggwwwwggw...',
        '...wwwwddwwww...',
        '...wwwwddwwww...',
        '...wwwwddwwww...',
        '...ssssssssss...',
        '................',
        '................',
      ]
    ),
    createPixelSprite32(
      'house_hungry',
      'House (Hungry)',
      {
        r: '#d97706',
        k: '#92400e',
        w: '#cbd5e1',
        s: '#64748b',
        d: '#5c3a1e',
        a: '#f59e0b',
      },
      [
        '................',
        '.......rr.......',
        '......rrrr......',
        '.....rrrrrr.....',
        '....rrrrrrrr....',
        '...rrrrrrrrrr...',
        '..krrrrrrrrrrk..',
        '..kwwwwwwwwwwk..',
        '...wsswwwwssw...',
        '...wsswwwwssw...',
        '...wwwwddwwww...',
        '...wwwwddwwww...',
        '...wwwwddwwww...',
        '...ssssssssssaa.',
        '.............aa.',
        '................',
      ]
    ),
    createPixelSprite32(
      'house_starving',
      'House (Starving)',
      {
        r: '#ef4444',
        k: '#7f1d1d',
        w: '#94a3b8',
        s: '#475569',
        d: '#451a03',
        x: '#f43f5e',
      },
      [
        '.............xx.',
        '.......rr....xx.',
        '......rrrr......',
        '.....rrrrrr.....',
        '....rrrrrrrr....',
        '...rrrrrrrrrr...',
        '..krrrrrrrrrrk..',
        '..kwwwwwwwwwwk..',
        '...wsswwwwssw...',
        '...wsswwwwssw...',
        '...wwwwddwwww...',
        '...wwwwddwwww...',
        '...wwwwddwwww...',
        '...ssssssssssxx.',
        '.............xx.',
        '................',
      ]
    ),
    createPixelSprite32(
      'warehouse',
      'Warehouse (Unset)',
      {
        r: '#475569',
        t: '#64748b',
        w: '#94a3b8',
        d: '#334155',
        c: '#b45309',
      },
      [
        '................',
        '................',
        '..tttttttttttt..',
        '.trrrrrrrrrrrrt.',
        '.twwwwwwwwwwwwt.',
        '.twddddddddddwt.',
        '.twdccccccccdwt.',
        '.twdcddddddcdwt.',
        '.twdcddddddcdwt.',
        '.twdccccccccdwt.',
        '.twddddddddddwt.',
        '.twddddddddddwt.',
        '.twwwwwwwwwwwwt.',
        '.dddddddddddddd.',
        '................',
        '................',
      ]
    ),
    createPixelSprite32(
      'warehouse_active',
      'Warehouse (Active)',
      {
        r: '#0284c7',
        t: '#38bdf8',
        w: '#cbd5e1',
        d: '#334155',
        c: '#eab308',
        e: '#4ade80',
      },
      [
        '................',
        '................',
        '..tttttttttttt..',
        '.trrrrrrrrrrrrt.',
        '.twwwwwwwwwwwwt.',
        '.twddddddddddwt.',
        '.twdccccccccdwt.',
        '.twdcddddddcdwt.',
        '.twdcddddddcdwt.',
        '.twdccccccccdwt.',
        '.twddddddddddwt.',
        '.twddddddddddwt.',
        '.twwwwwwwwwwwwt.',
        '.ddddddddddddde.',
        '.............ee.',
        '................',
      ]
    ),
  ];
}

// ============================================================================
// 2. Layer & Mask World Generator Graph
// ============================================================================

function buildWorldGeneratorGraph(): NodeGraph {
  const g = new GraphBuilder();

  g.node('density', 'gen.setupParam', { paramId: 'terrainDensity' }, { x: 40, y: 120 });
  g.node('base_empty', 'gen.fillLayer', { cellTypeId: 'empty' }, { x: 40, y: 360 });

  // Water coverage = 0.08 * terrainDensity
  g.node('water_cov', 'gen.math', { op: 'mul', b: 0.08 }, { x: 240, y: 40 });
  g.node('water_mask', 'gen.clusters', { clusterSize: 5, seedOffset: 11 }, { x: 440, y: 40 });
  g.node('water_layer', 'gen.paintLayer', { cellTypeId: 'water', threshold: 0.5 }, { x: 640, y: 40 });

  // Mountain coverage = 0.10 * terrainDensity
  g.node('mtn_cov', 'gen.math', { op: 'mul', b: 0.1 }, { x: 240, y: 160 });
  g.node('mtn_mask', 'gen.clusters', { clusterSize: 4, seedOffset: 23 }, { x: 440, y: 160 });
  g.node('mtn_layer', 'gen.paintLayer', { cellTypeId: 'mountain', threshold: 0.5 }, { x: 640, y: 160 });

  // Forest coverage = 0.14 * terrainDensity
  g.node('for_cov', 'gen.math', { op: 'mul', b: 0.14 }, { x: 240, y: 280 });
  g.node('for_mask', 'gen.clusters', { clusterSize: 6, seedOffset: 37 }, { x: 440, y: 280 });
  g.node('for_layer', 'gen.paintLayer', { cellTypeId: 'forest', threshold: 0.5 }, { x: 640, y: 280 });

  // Merge layers: Empty -> Forest -> Mountain -> Water (Water takes priority)
  g.node('merge_for', 'gen.mergeLayers', {}, { x: 860, y: 280 });
  g.node('merge_mtn', 'gen.mergeLayers', {}, { x: 1040, y: 180 });
  g.node('merge_wat', 'gen.mergeLayers', {}, { x: 1220, y: 100 });
  g.node('out', 'gen.output', {}, { x: 1420, y: 100 });

  g.connect('density', 'value', 'water_cov', 'a')
    .connect('water_cov', 'result', 'water_mask', 'coverage')
    .connect('water_mask', 'mask', 'water_layer', 'mask')
    .connect('density', 'value', 'mtn_cov', 'a')
    .connect('mtn_cov', 'result', 'mtn_mask', 'coverage')
    .connect('mtn_mask', 'mask', 'mtn_layer', 'mask')
    .connect('density', 'value', 'for_cov', 'a')
    .connect('for_cov', 'result', 'for_mask', 'coverage')
    .connect('for_mask', 'mask', 'for_layer', 'mask')
    .connect('base_empty', 'layer', 'merge_for', 'base')
    .connect('for_layer', 'layer', 'merge_for', 'overlay')
    .connect('merge_for', 'layer', 'merge_mtn', 'base')
    .connect('mtn_layer', 'layer', 'merge_mtn', 'overlay')
    .connect('merge_mtn', 'layer', 'merge_wat', 'base')
    .connect('water_layer', 'layer', 'merge_wat', 'overlay')
    .connect('merge_wat', 'layer', 'out', 'layer');

  return g.build();
}

// ============================================================================
// 3. Reusable Cell Graph Builders (Classic Colony)
// ============================================================================

function buildEmptyGraph(): NodeGraph {
  const g = new GraphBuilder();
  const options: CellPickerOption[] = [
    {
      cellId: 'farm',
      label: 'Farm',
      subtitle: 'Needs 1 Worker + Moisture → +3 Food',
      badge: '5 Money',
      requires: [{ varId: 'money', min: 5 }],
    },
    {
      cellId: 'house',
      label: 'House',
      subtitle: '+1 Pop Cap · −1 Food → +1 Money',
      badge: '6 Money · 4 Wood',
      requires: [
        { varId: 'money', min: 6 },
        { varId: 'wood', min: 4 },
      ],
    },
    {
      cellId: 'warehouse',
      label: 'Warehouse',
      subtitle: '+100 Cap for 1 chosen resource',
      badge: '10 Money · 8 Wood · 6 Stone',
      requires: [
        { varId: 'money', min: 10 },
        { varId: 'wood', min: 8 },
        { varId: 'stone', min: 6 },
      ],
    },
  ];

  g.node('click', 'event.click', {}, { x: 40, y: 120 });
  g.node(
    'pick',
    'ui.openInterface',
    {
      interfaceId: '@builtin/cell_picker',
      params: { title: 'Build on Plains', options },
    },
    { x: 260, y: 120 }
  );
  g.node(
    'switch',
    'flow.switchString',
    { cases: ['farm', 'house', 'warehouse'] },
    { x: 520, y: 120 }
  );

  // Branch 0: Farm (5 money)
  g.node('farm_pay', 'global.consume', { varId: 'money', amount: 5 }, { x: 780, y: 20 });
  g.node('farm_tr', 'cell.transform', { toId: 'farm', reason: 'build' }, { x: 1020, y: 20 });

  // Branch 1: House (6 money + 4 wood)
  g.node('house_m', 'global.get', { varId: 'money' }, { x: 640, y: 220 });
  g.node('house_w', 'global.get', { varId: 'wood' }, { x: 640, y: 290 });
  g.node('house_cm', 'logic.compare', { op: '>=', b: 6 }, { x: 780, y: 220 });
  g.node('house_cw', 'logic.compare', { op: '>=', b: 4 }, { x: 780, y: 290 });
  g.node('house_ok', 'logic.bool', { op: 'and' }, { x: 920, y: 250 });
  g.node('house_br', 'flow.branch', {}, { x: 1060, y: 140 });
  g.node('house_pay_m', 'global.consume', { varId: 'money', amount: 6 }, { x: 1240, y: 140 });
  g.node('house_pay_w', 'global.consume', { varId: 'wood', amount: 4 }, { x: 1440, y: 140 });
  g.node('house_tr', 'cell.transform', { toId: 'house', reason: 'build' }, { x: 1640, y: 140 });

  // Branch 2: Warehouse (10 money + 8 wood + 6 stone)
  g.node('wh_m', 'global.get', { varId: 'money' }, { x: 640, y: 400 });
  g.node('wh_w', 'global.get', { varId: 'wood' }, { x: 640, y: 460 });
  g.node('wh_s', 'global.get', { varId: 'stone' }, { x: 640, y: 520 });
  g.node('wh_cm', 'logic.compare', { op: '>=', b: 10 }, { x: 780, y: 400 });
  g.node('wh_cw', 'logic.compare', { op: '>=', b: 8 }, { x: 780, y: 460 });
  g.node('wh_cs', 'logic.compare', { op: '>=', b: 6 }, { x: 780, y: 520 });
  g.node('wh_and1', 'logic.bool', { op: 'and' }, { x: 920, y: 430 });
  g.node('wh_and2', 'logic.bool', { op: 'and' }, { x: 1060, y: 460 });
  g.node('wh_br', 'flow.branch', {}, { x: 1200, y: 360 });
  g.node('wh_pay_m', 'global.consume', { varId: 'money', amount: 10 }, { x: 1380, y: 360 });
  g.node('wh_pay_w', 'global.consume', { varId: 'wood', amount: 8 }, { x: 1560, y: 360 });
  g.node('wh_pay_s', 'global.consume', { varId: 'stone', amount: 6 }, { x: 1740, y: 360 });
  g.node('wh_tr', 'cell.transform', { toId: 'warehouse', reason: 'build' }, { x: 1920, y: 360 });

  g.connect('click', 'left', 'pick', 'in')
    .connect('pick', 'onResult', 'switch', 'in')
    .connect('pick', 'result', 'switch', 'value')
    // Farm
    .connect('switch', 'case_0', 'farm_pay', 'in')
    .connect('farm_pay', 'out', 'farm_tr', 'in')
    // House
    .connect('switch', 'case_1', 'house_br', 'in')
    .connect('house_m', 'value', 'house_cm', 'a')
    .connect('house_w', 'value', 'house_cw', 'a')
    .connect('house_cm', 'result', 'house_ok', 'a')
    .connect('house_cw', 'result', 'house_ok', 'b')
    .connect('house_ok', 'result', 'house_br', 'condition')
    .connect('house_br', 'true', 'house_pay_m', 'in')
    .connect('house_pay_m', 'out', 'house_pay_w', 'in')
    .connect('house_pay_w', 'out', 'house_tr', 'in')
    // Warehouse
    .connect('switch', 'case_2', 'wh_br', 'in')
    .connect('wh_m', 'value', 'wh_cm', 'a')
    .connect('wh_w', 'value', 'wh_cw', 'a')
    .connect('wh_s', 'value', 'wh_cs', 'a')
    .connect('wh_cm', 'result', 'wh_and1', 'a')
    .connect('wh_cw', 'result', 'wh_and1', 'b')
    .connect('wh_and1', 'result', 'wh_and2', 'a')
    .connect('wh_cs', 'result', 'wh_and2', 'b')
    .connect('wh_and2', 'result', 'wh_br', 'condition')
    .connect('wh_br', 'true', 'wh_pay_m', 'in')
    .connect('wh_pay_m', 'out', 'wh_pay_w', 'in')
    .connect('wh_pay_w', 'out', 'wh_pay_s', 'in')
    .connect('wh_pay_s', 'out', 'wh_tr', 'in');

  return g.build();
}

function buildResourceSiteGraph(
  title: string,
  targetId: string,
  targetLabel: string,
  subtitle: string,
  badge: string,
  costs: { varId: string; amount: number }[]
): NodeGraph {
  const g = new GraphBuilder();
  const options: CellPickerOption[] = [
    {
      cellId: targetId,
      label: targetLabel,
      subtitle,
      badge,
      requires: costs.map((c) => ({ varId: c.varId, min: c.amount })),
    },
  ];

  g.node('click', 'event.click', {}, { x: 40, y: 100 });
  g.node(
    'pick',
    'ui.openInterface',
    { interfaceId: '@builtin/cell_picker', params: { title, options } },
    { x: 260, y: 100 }
  );
  g.node('cmp_pick', 'logic.compare', { op: '==', b: targetId }, { x: 460, y: 220 });

  // Combine affordability checks
  let condNode = 'cmp_pick';
  costs.forEach((c, idx) => {
    g.node(`get_${idx}`, 'global.get', { varId: c.varId }, { x: 300, y: 300 + idx * 70 });
    g.node(`ge_${idx}`, 'logic.compare', { op: '>=', b: c.amount }, { x: 480, y: 300 + idx * 70 });
    g.node(`and_${idx}`, 'logic.bool', { op: 'and' }, { x: 640, y: 260 + idx * 70 });
    g.connect(`get_${idx}`, 'value', `ge_${idx}`, 'a')
      .connect(condNode, 'result', `and_${idx}`, 'a')
      .connect(`ge_${idx}`, 'result', `and_${idx}`, 'b');
    condNode = `and_${idx}`;
  });

  g.node('branch', 'flow.branch', {}, { x: 820, y: 100 });
  g.connect('click', 'left', 'pick', 'in')
    .connect('pick', 'result', 'cmp_pick', 'a')
    .connect('pick', 'onResult', 'branch', 'in')
    .connect(condNode, 'result', 'branch', 'condition');

  let prevExec = 'branch';
  let prevPort = 'true';
  costs.forEach((c, idx) => {
    const payId = `pay_${idx}`;
    g.node(payId, 'global.consume', { varId: c.varId, amount: c.amount }, { x: 1020 + idx * 200, y: 100 });
    g.connect(prevExec, prevPort, payId, 'in');
    prevExec = payId;
    prevPort = 'out';
  });

  g.node('tr', 'cell.transform', { toId: targetId, reason: 'build' }, { x: 1020 + costs.length * 200, y: 100 });
  g.connect(prevExec, prevPort, 'tr', 'in');

  return g.build();
}

function buildWaterGraph(): NodeGraph {
  const g = new GraphBuilder();
  g.node('cycle', 'event.cycle', {}, { x: 40, y: 80 });
  g.node(
    'emit',
    'supply.emit',
    {
      supplyId: 'moisture',
      amount: 2,
      area: { shape: 'moore', radius: 2 },
      includeSelf: true,
    },
    { x: 280, y: 80 }
  );
  g.connect('cycle', 'supply', 'emit', 'in');
  return g.build();
}

function buildWorkplaceGraph(config: {
  name: string;
  produceVarId: string;
  produceAmount: number;
  produceLabel: string;
  requiresMoisture: boolean;
  activeSpriteId: string;
  idleSpriteId: string;
  demolishToId: string;
  refunds: { varId: string; amount: number; label: string }[];
}): NodeGraph {
  const g = new GraphBuilder();

  // ── 1. On Click: Left -> Workplace panel, Right -> @builtin/confirm ──────
  g.node('click', 'event.click', {}, { x: 40, y: 60 });
  g.node(
    'open_panel',
    'ui.openInterface',
    {
      interfaceId: 'workplace',
      params: {
        showMoisture: config.requiresMoisture,
        activeSpriteId: config.activeSpriteId,
        idleSpriteId: config.idleSpriteId,
        activeStatus: `+${config.produceAmount} ${config.produceLabel}`,
      },
    },
    { x: 280, y: 20 }
  );

  const refundLines: ConfirmLine[] = [
    { text: 'Assigned worker returns to Population', tone: 'muted' },
    ...config.refunds.map((r) => ({
      text: `Refund: +${r.amount} ${r.label}`,
      tone: 'positive' as const,
    })),
  ];

  g.node(
    'open_demolish',
    'ui.openInterface',
    {
      interfaceId: '@builtin/confirm',
      params: {
        title: `Demolish ${config.name}?`,
        message: `Converts tile back to ${config.demolishToId}.`,
        lines: refundLines,
        confirmLabel: 'Demolish',
        cancelLabel: 'Cancel',
        danger: true,
      },
    },
    { x: 280, y: 140 }
  );
  g.node('cmp_confirm', 'logic.compare', { op: '==', b: true }, { x: 480, y: 210 });
  g.node('br_confirm', 'flow.branch', {}, { x: 640, y: 140 });
  g.node(
    'do_demolish',
    'cell.transform',
    { toId: config.demolishToId, reason: 'demolish' },
    { x: 840, y: 140 }
  );

  g.connect('click', 'left', 'open_panel', 'in')
    .connect('click', 'right', 'open_demolish', 'in')
    .connect('open_demolish', 'result', 'cmp_confirm', 'a')
    .connect('open_demolish', 'onResult', 'br_confirm', 'in')
    .connect('cmp_confirm', 'result', 'br_confirm', 'condition')
    .connect('br_confirm', 'true', 'do_demolish', 'in');

  // ── 2. On Cycle (Produce & React) ────────────────────────────────────────
  g.node('cycle', 'event.cycle', {}, { x: 40, y: 360 });
  g.node('get_worker', 'cell.getState', { key: 'worker' }, { x: 240, y: 480 });
  g.node('has_worker', 'logic.compare', { op: '>=', b: 1 }, { x: 420, y: 480 });

  let canWorkCond = 'has_worker';
  if (config.requiresMoisture) {
    g.node('get_moist', 'supply.get', { supplyId: 'moisture' }, { x: 240, y: 560 });
    g.node('has_moist', 'logic.compare', { op: '>=', b: 1 }, { x: 420, y: 560 });
    g.node('can_work', 'logic.bool', { op: 'and' }, { x: 580, y: 520 });
    g.connect('get_moist', 'amount', 'has_moist', 'a')
      .connect('has_worker', 'result', 'can_work', 'a')
      .connect('has_moist', 'result', 'can_work', 'b');
    canWorkCond = 'can_work';
  }
  g.connect('get_worker', 'value', 'has_worker', 'a');

  // Produce branch
  g.node('br_prod', 'flow.branch', {}, { x: 660, y: 320 });
  g.node(
    'add_res',
    'global.add',
    { varId: config.produceVarId, amount: config.produceAmount },
    { x: 860, y: 300 }
  );
  g.node('reset_idle', 'cell.setState', { key: 'idle', value: 0 }, { x: 1060, y: 300 });
  g.node(
    'set_status_ok',
    'cell.setState',
    { key: 'status', value: `+${config.produceAmount} ${config.produceLabel}` },
    { x: 1260, y: 300 }
  );
  g.node('set_spr_ok', 'cell.setSprite', { spriteId: config.activeSpriteId }, { x: 1460, y: 300 });

  g.connect('cycle', 'produce', 'br_prod', 'in')
    .connect(canWorkCond, 'result', 'br_prod', 'condition')
    .connect('br_prod', 'true', 'add_res', 'in')
    .connect('add_res', 'out', 'reset_idle', 'in')
    .connect('reset_idle', 'out', 'set_status_ok', 'in')
    .connect('set_status_ok', 'out', 'set_spr_ok', 'in');

  // React branch (check idle / missing moisture)
  g.node('br_react_work', 'flow.branch', {}, { x: 660, y: 460 });
  g.node('br_react_worker', 'flow.branch', {}, { x: 860, y: 460 });

  // No worker: increment idle, set idle sprite & status, notify if idle >= 2
  g.node('inc_idle', 'cell.addState', { key: 'idle', amount: 1 }, { x: 1060, y: 420 });
  g.node('set_spr_idle', 'cell.setSprite', { spriteId: config.idleSpriteId }, { x: 1260, y: 420 });
  g.node(
    'set_st_need_w',
    'cell.setState',
    { key: 'status', value: 'Needs worker' },
    { x: 1460, y: 420 }
  );
  g.node('get_idle', 'cell.getState', { key: 'idle' }, { x: 1460, y: 520 });
  g.node('cmp_idle2', 'logic.compare', { op: '>=', b: 2 }, { x: 1640, y: 520 });
  g.node('br_idle_notify', 'flow.branch', {}, { x: 1660, y: 420 });
  g.node(
    'notify_idle',
    'notify.cell',
    {
      severity: 'warning',
      title: `${config.name} idle`,
      message: `No worker assigned to ${config.name}`,
    },
    { x: 1860, y: 420 }
  );

  // Has worker, no moisture (for Farm)
  g.node('set_spr_dry', 'cell.setSprite', { spriteId: config.idleSpriteId }, { x: 1060, y: 560 });
  g.node(
    'set_st_dry',
    'cell.setState',
    { key: 'status', value: 'No Moisture' },
    { x: 1260, y: 560 }
  );

  g.connect('cycle', 'react', 'br_react_work', 'in')
    .connect(canWorkCond, 'result', 'br_react_work', 'condition')
    .connect('br_react_work', 'false', 'br_react_worker', 'in')
    .connect('has_worker', 'result', 'br_react_worker', 'condition')
    // No worker path
    .connect('br_react_worker', 'false', 'inc_idle', 'in')
    .connect('inc_idle', 'out', 'set_spr_idle', 'in')
    .connect('set_spr_idle', 'out', 'set_st_need_w', 'in')
    .connect('set_st_need_w', 'out', 'br_idle_notify', 'in')
    .connect('get_idle', 'value', 'cmp_idle2', 'a')
    .connect('cmp_idle2', 'result', 'br_idle_notify', 'condition')
    .connect('br_idle_notify', 'true', 'notify_idle', 'in')
    // Has worker but lacks moisture path
    .connect('br_react_worker', 'true', 'set_spr_dry', 'in')
    .connect('set_spr_dry', 'out', 'set_st_dry', 'in');

  // ── 3. On Exit: Return worker to population + demolish refunds ───────────
  g.node('exit', 'event.exit', {}, { x: 40, y: 720 });
  g.node('exit_w', 'cell.getState', { key: 'worker' }, { x: 220, y: 800 });
  g.node('return_w', 'global.add', { varId: 'population' }, { x: 420, y: 720 });
  g.node('cmp_dem', 'logic.compare', { op: '==', b: 'demolish' }, { x: 420, y: 820 });
  g.node('br_dem', 'flow.branch', {}, { x: 640, y: 720 });

  g.connect('exit', 'out', 'return_w', 'in')
    .connect('exit_w', 'value', 'return_w', 'amount')
    .connect('return_w', 'out', 'br_dem', 'in')
    .connect('exit', 'reason', 'cmp_dem', 'a')
    .connect('cmp_dem', 'result', 'br_dem', 'condition');

  let prevRefund = 'br_dem';
  let prevRefundPort = 'true';
  config.refunds.forEach((r, idx) => {
    const rid = `refund_${idx}`;
    g.node(rid, 'global.add', { varId: r.varId, amount: r.amount }, { x: 840 + idx * 200, y: 720 });
    g.connect(prevRefund, prevRefundPort, rid, 'in');
    prevRefund = rid;
    prevRefundPort = 'out';
  });

  return g.build();
}

function buildHouseGraph(): NodeGraph {
  const g = new GraphBuilder();

  // ── 1. On Enter: +1 Population Cap & +1 Population ───────────────────────
  g.node('enter', 'event.enter', {}, { x: 40, y: 40 });
  g.node('enter_cap', 'global.addCap', { varId: 'population', delta: 1 }, { x: 260, y: 40 });
  g.node('enter_pop', 'global.add', { varId: 'population', amount: 1 }, { x: 480, y: 40 });

  g.connect('enter', 'out', 'enter_cap', 'in').connect('enter_cap', 'out', 'enter_pop', 'in');

  // ── 2. On Click (Right): @builtin/confirm -> Demolish ────────────────────
  g.node('click', 'event.click', {}, { x: 40, y: 180 });
  g.node(
    'open_demolish',
    'ui.openInterface',
    {
      interfaceId: '@builtin/confirm',
      params: {
        title: 'Demolish House?',
        message: 'Removes housing and reclaims 1 Population.',
        lines: [
          { text: 'Population Cap: −1', tone: 'warning' },
          { text: 'Refund: +3 Money, +2 Wood', tone: 'positive' },
        ] as ConfirmLine[],
        warnings: ['If all population is assigned, 1 worker will be pulled from a workplace.'],
        confirmLabel: 'Demolish',
        cancelLabel: 'Cancel',
        danger: true,
      },
    },
    { x: 260, y: 180 }
  );
  g.node('cmp_dem_ok', 'logic.compare', { op: '==', b: true }, { x: 480, y: 240 });
  g.node('br_dem_ok', 'flow.branch', {}, { x: 660, y: 180 });
  g.node('do_dem', 'cell.transform', { toId: 'empty', reason: 'demolish' }, { x: 860, y: 180 });

  g.connect('click', 'right', 'open_demolish', 'in')
    .connect('open_demolish', 'result', 'cmp_dem_ok', 'a')
    .connect('open_demolish', 'onResult', 'br_dem_ok', 'in')
    .connect('cmp_dem_ok', 'result', 'br_dem_ok', 'condition')
    .connect('br_dem_ok', 'true', 'do_dem', 'in');

  // ── 3. On Cycle (React): Consume 1 Food -> +1 Money, else hunger/starve ──
  g.node('cycle', 'event.cycle', {}, { x: 40, y: 380 });
  g.node('eat_food', 'global.consume', { varId: 'food', amount: 1 }, { x: 260, y: 380 });

  // Fed path
  g.node('earn_money', 'global.add', { varId: 'money', amount: 1 }, { x: 480, y: 320 });
  g.node('reset_hunger', 'cell.setState', { key: 'hunger', value: 0 }, { x: 680, y: 320 });
  g.node('spr_fed', 'cell.setSprite', { spriteId: 'house' }, { x: 880, y: 320 });
  g.node('st_fed', 'cell.setState', { key: 'status', value: 'Fed (+1 Money)' }, { x: 1080, y: 320 });

  // Hungry path: if hunger >= 3 -> transform empty (starved), else hunger++
  g.node('get_h', 'cell.getState', { key: 'hunger' }, { x: 460, y: 520 });
  g.node('cmp_h3', 'logic.compare', { op: '>=', b: 3 }, { x: 640, y: 520 });
  g.node('br_starve', 'flow.branch', {}, { x: 480, y: 440 });
  g.node('do_starve', 'cell.transform', { toId: 'empty', reason: 'starved' }, { x: 700, y: 420 });

  // Increment hunger
  g.node('inc_h', 'cell.addState', { key: 'hunger', amount: 1 }, { x: 700, y: 520 });
  g.node('get_h2', 'cell.getState', { key: 'hunger' }, { x: 880, y: 600 });
  g.node('cmp_crit', 'logic.compare', { op: '>=', b: 3 }, { x: 1060, y: 600 });
  g.node('br_crit', 'flow.branch', {}, { x: 900, y: 500 });

  // Hunger == 3 (Critical)
  g.node('spr_starving', 'cell.setSprite', { spriteId: 'house_starving' }, { x: 1120, y: 440 });
  g.node('st_starving', 'cell.setState', { key: 'status', value: 'Starving (3/3)' }, { x: 1320, y: 440 });
  g.node(
    'notify_starve',
    'notify.cell',
    {
      severity: 'danger',
      title: 'House starving',
      message: 'Will collapse next cycle without Food (3/3)',
    },
    { x: 1520, y: 440 }
  );

  // Hunger 1 or 2 (Hungry)
  g.node('spr_hungry', 'cell.setSprite', { spriteId: 'house_hungry' }, { x: 1120, y: 560 });
  g.node('fmt_hungry', 'string.format', { template: 'Hungry ({a}/3)' }, { x: 1120, y: 660 });
  g.node('st_hungry', 'cell.setState', { key: 'status' }, { x: 1320, y: 560 });

  g.connect('cycle', 'react', 'eat_food', 'in')
    .connect('eat_food', 'out', 'earn_money', 'in')
    .connect('earn_money', 'out', 'reset_hunger', 'in')
    .connect('reset_hunger', 'out', 'spr_fed', 'in')
    .connect('spr_fed', 'out', 'st_fed', 'in')
    // Insufficient food
    .connect('eat_food', 'insufficient', 'br_starve', 'in')
    .connect('get_h', 'value', 'cmp_h3', 'a')
    .connect('cmp_h3', 'result', 'br_starve', 'condition')
    .connect('br_starve', 'true', 'do_starve', 'in')
    .connect('br_starve', 'false', 'inc_h', 'in')
    .connect('inc_h', 'out', 'br_crit', 'in')
    .connect('get_h2', 'value', 'cmp_crit', 'a')
    .connect('cmp_crit', 'result', 'br_crit', 'condition')
    // Critical
    .connect('br_crit', 'true', 'spr_starving', 'in')
    .connect('spr_starving', 'out', 'st_starving', 'in')
    .connect('st_starving', 'out', 'notify_starve', 'in')
    // Mild hunger
    .connect('br_crit', 'false', 'spr_hungry', 'in')
    .connect('spr_hungry', 'out', 'st_hungry', 'in')
    .connect('get_h2', 'value', 'fmt_hungry', 'a')
    .connect('fmt_hungry', 'result', 'st_hungry', 'value');

  // ── 4. On Exit: -1 Pop Cap, reclaim 1 pop/worker, demolish refund ────────
  g.node('exit', 'event.exit', {}, { x: 40, y: 780 });
  g.node('exit_seq', 'flow.sequence', {}, { x: 240, y: 780 });

  // Step 0: Try consuming 1 free population; if none free, reclaim 1 worker from a workplace
  g.node('take_pop', 'global.consume', { varId: 'population', amount: 1 }, { x: 460, y: 720 });
  g.node(
    'reclaim_w',
    'world.reclaimCellState',
    {
      stateKey: 'worker',
      amount: 1,
      resetVisualToDefault: true,
      setStateOnAffected: { status: 'Needs worker' },
    },
    { x: 680, y: 760 }
  );

  // Step 1: Reduce Population cap by 1
  g.node('sub_cap', 'global.addCap', { varId: 'population', delta: -1 }, { x: 460, y: 840 });

  // Step 2: If reason == demolish -> refund +3 money, +2 wood
  g.node('cmp_exit_dem', 'logic.compare', { op: '==', b: 'demolish' }, { x: 460, y: 980 });
  g.node('br_exit_dem', 'flow.branch', {}, { x: 660, y: 920 });
  g.node('ref_m', 'global.add', { varId: 'money', amount: 3 }, { x: 860, y: 920 });
  g.node('ref_w', 'global.add', { varId: 'wood', amount: 2 }, { x: 1060, y: 920 });

  g.connect('exit', 'out', 'exit_seq', 'in')
    .connect('exit_seq', 'then0', 'take_pop', 'in')
    .connect('take_pop', 'insufficient', 'reclaim_w', 'in')
    .connect('exit_seq', 'then1', 'sub_cap', 'in')
    .connect('exit_seq', 'then2', 'br_exit_dem', 'in')
    .connect('exit', 'reason', 'cmp_exit_dem', 'a')
    .connect('cmp_exit_dem', 'result', 'br_exit_dem', 'condition')
    .connect('br_exit_dem', 'true', 'ref_m', 'in')
    .connect('ref_m', 'out', 'ref_w', 'in');

  return g.build();
}

function buildWarehouseGraph(): NodeGraph {
  const g = new GraphBuilder();

  // Left click -> warehouse_panel; Right click -> @builtin/confirm
  g.node('click', 'event.click', {}, { x: 40, y: 80 });
  g.node(
    'open_wh',
    'ui.openInterface',
    { interfaceId: 'warehouse_panel', params: {} },
    { x: 260, y: 20 }
  );
  g.node(
    'open_dem',
    'ui.openInterface',
    {
      interfaceId: '@builtin/confirm',
      params: {
        title: 'Demolish Warehouse?',
        message: 'Removes any +100 storage cap bonus granted by this warehouse.',
        lines: [{ text: 'Refund: +5 Money, +4 Wood, +3 Stone', tone: 'positive' }] as ConfirmLine[],
        confirmLabel: 'Demolish',
        cancelLabel: 'Cancel',
        danger: true,
      },
    },
    { x: 260, y: 140 }
  );
  g.node('cmp_dem', 'logic.compare', { op: '==', b: true }, { x: 460, y: 200 });
  g.node('br_dem', 'flow.branch', {}, { x: 640, y: 140 });
  g.node('do_dem', 'cell.transform', { toId: 'empty', reason: 'demolish' }, { x: 840, y: 140 });

  g.connect('click', 'left', 'open_wh', 'in')
    .connect('click', 'right', 'open_dem', 'in')
    .connect('open_dem', 'result', 'cmp_dem', 'a')
    .connect('open_dem', 'onResult', 'br_dem', 'in')
    .connect('cmp_dem', 'result', 'br_dem', 'condition')
    .connect('br_dem', 'true', 'do_dem', 'in');

  // On Exit: remove +100 cap from stored resource if set, then demolish refund
  g.node('exit', 'event.exit', {}, { x: 40, y: 360 });
  g.node('exit_seq', 'flow.sequence', {}, { x: 240, y: 360 });

  g.node('get_sr', 'cell.getState', { key: 'storageResource' }, { x: 440, y: 300 });
  g.node('has_sr', 'logic.compare', { op: '!=', b: '' }, { x: 640, y: 300 });
  g.node('br_sr', 'flow.branch', {}, { x: 820, y: 300 });
  g.node('sub_sr_cap', 'global.addCap', { delta: -100 }, { x: 1040, y: 300 });

  g.node('cmp_exit_dem', 'logic.compare', { op: '==', b: 'demolish' }, { x: 440, y: 460 });
  g.node('br_exit_dem', 'flow.branch', {}, { x: 640, y: 440 });
  g.node('ref_m', 'global.add', { varId: 'money', amount: 5 }, { x: 840, y: 440 });
  g.node('ref_w', 'global.add', { varId: 'wood', amount: 4 }, { x: 1020, y: 440 });
  g.node('ref_s', 'global.add', { varId: 'stone', amount: 3 }, { x: 1200, y: 440 });

  g.connect('exit', 'out', 'exit_seq', 'in')
    .connect('exit_seq', 'then0', 'br_sr', 'in')
    .connect('get_sr', 'value', 'has_sr', 'a')
    .connect('has_sr', 'result', 'br_sr', 'condition')
    .connect('br_sr', 'true', 'sub_sr_cap', 'in')
    .connect('get_sr', 'value', 'sub_sr_cap', 'varId')
    .connect('exit_seq', 'then1', 'br_exit_dem', 'in')
    .connect('exit', 'reason', 'cmp_exit_dem', 'a')
    .connect('cmp_exit_dem', 'result', 'br_exit_dem', 'condition')
    .connect('br_exit_dem', 'true', 'ref_m', 'in')
    .connect('ref_m', 'out', 'ref_w', 'in')
    .connect('ref_w', 'out', 'ref_s', 'in');

  return g.build();
}

// ============================================================================
// 4. Custom Node-Powered Interfaces (Workplace & Warehouse)
// ============================================================================

function buildWorkplaceInterface(): InterfaceManifest {
  const g = new GraphBuilder();

  // Action: assign_worker
  g.node('ev_assign', 'event.uiAction', { actionId: 'assign_worker' }, { x: 40, y: 40 });
  g.node('take_pop', 'global.consume', { varId: 'population', amount: 1 }, { x: 260, y: 40 });
  g.node('set_w1', 'cell.setState', { key: 'worker', value: 1 }, { x: 480, y: 40 });
  g.node('set_idle0', 'cell.setState', { key: 'idle', value: 0 }, { x: 680, y: 40 });
  g.node('clr_notif', 'notify.clearCell', {}, { x: 880, y: 40 });

  // Immediately update sprite & status based on moisture requirement
  g.node('param_moist', 'get.uiParam', { key: 'showMoisture' }, { x: 880, y: 150 });
  g.node('get_moist', 'supply.get', { supplyId: 'moisture' }, { x: 880, y: 220 });
  g.node('no_moist', 'logic.compare', { op: '<', b: 1 }, { x: 1060, y: 220 });
  g.node('is_dry', 'logic.bool', { op: 'and' }, { x: 1220, y: 180 });
  g.node('br_dry', 'flow.branch', {}, { x: 1080, y: 40 });

  g.node('p_act_spr', 'get.uiParam', { key: 'activeSpriteId' }, { x: 1260, y: 10 });
  g.node('p_act_st', 'get.uiParam', { key: 'activeStatus' }, { x: 1460, y: 10 });
  g.node('set_spr_act', 'cell.setSprite', {}, { x: 1320, y: 80 });
  g.node('set_st_act', 'cell.setState', { key: 'status' }, { x: 1520, y: 80 });

  g.node('p_idle_spr_dry', 'get.uiParam', { key: 'idleSpriteId' }, { x: 1260, y: 250 });
  g.node('set_spr_dry', 'cell.setSprite', {}, { x: 1320, y: 180 });
  g.node('set_st_dry', 'cell.setState', { key: 'status', value: 'No Moisture' }, { x: 1520, y: 180 });

  g.connect('ev_assign', 'out', 'take_pop', 'in')
    .connect('take_pop', 'out', 'set_w1', 'in')
    .connect('set_w1', 'out', 'set_idle0', 'in')
    .connect('set_idle0', 'out', 'clr_notif', 'in')
    .connect('clr_notif', 'out', 'br_dry', 'in')
    .connect('param_moist', 'value', 'is_dry', 'a')
    .connect('get_moist', 'amount', 'no_moist', 'a')
    .connect('no_moist', 'result', 'is_dry', 'b')
    .connect('is_dry', 'result', 'br_dry', 'condition')
    .connect('br_dry', 'false', 'set_spr_act', 'in')
    .connect('p_act_spr', 'value', 'set_spr_act', 'spriteId')
    .connect('set_spr_act', 'out', 'set_st_act', 'in')
    .connect('p_act_st', 'value', 'set_st_act', 'value')
    .connect('br_dry', 'true', 'set_spr_dry', 'in')
    .connect('p_idle_spr_dry', 'value', 'set_spr_dry', 'spriteId')
    .connect('set_spr_dry', 'out', 'set_st_dry', 'in');

  // Action: remove_worker
  g.node('ev_remove', 'event.uiAction', { actionId: 'remove_worker' }, { x: 40, y: 360 });
  g.node('get_w', 'cell.getState', { key: 'worker' }, { x: 240, y: 440 });
  g.node('has_w', 'logic.compare', { op: '>=', b: 1 }, { x: 420, y: 440 });
  g.node('br_rem', 'flow.branch', {}, { x: 460, y: 360 });
  g.node('set_w0', 'cell.setState', { key: 'worker', value: 0 }, { x: 660, y: 360 });
  g.node('add_pop', 'global.add', { varId: 'population', amount: 1 }, { x: 860, y: 360 });
  g.node('p_idle_spr', 'get.uiParam', { key: 'idleSpriteId' }, { x: 1020, y: 440 });
  g.node('set_spr_idle', 'cell.setSprite', {}, { x: 1060, y: 360 });
  g.node('set_st_need', 'cell.setState', { key: 'status', value: 'Needs worker' }, { x: 1260, y: 360 });

  g.connect('ev_remove', 'out', 'br_rem', 'in')
    .connect('get_w', 'value', 'has_w', 'a')
    .connect('has_w', 'result', 'br_rem', 'condition')
    .connect('br_rem', 'true', 'set_w0', 'in')
    .connect('set_w0', 'out', 'add_pop', 'in')
    .connect('add_pop', 'out', 'set_spr_idle', 'in')
    .connect('p_idle_spr', 'value', 'set_spr_idle', 'spriteId')
    .connect('set_spr_idle', 'out', 'set_st_need', 'in');

  return {
    id: 'workplace',
    title: '{{cell.name}}',
    width: 248,
    role: 'popover',
    showSwatch: true,
    blocks: [
      {
        kind: 'stat',
        label: 'Status',
        value: '{{state.status}}',
        tone: 'accent',
      },
      {
        kind: 'stat',
        label: 'Moisture',
        value: '{{supply.moisture}}',
        tone: 'accent',
        visibleWhen: [{ source: 'param', key: 'showMoisture', op: '==', value: true }],
      },
      {
        kind: 'stat',
        label: 'Worker',
        value: '{{state.worker}} / 1',
      },
      {
        kind: 'stat',
        label: 'Idle cycles',
        value: '{{state.idle}}',
        tone: 'warning',
        visibleWhen: [
          { source: 'state', key: 'worker', op: '<', value: 1 },
          { source: 'state', key: 'idle', op: '>', value: 0 },
        ],
      },
      {
        kind: 'button',
        label: 'Assign Worker (Free: {{global.population}})',
        actionId: 'assign_worker',
        variant: 'primary',
        visibleWhen: [{ source: 'state', key: 'worker', op: '<', value: 1 }],
        disabledWhen: [{ source: 'global', key: 'population', op: '<', value: 1 }],
      },
      {
        kind: 'button',
        label: 'Remove Worker',
        actionId: 'remove_worker',
        variant: 'secondary',
        visibleWhen: [{ source: 'state', key: 'worker', op: '>=', value: 1 }],
      },
    ],
    graph: g.build(),
  };
}

function buildWarehouseInterface(): InterfaceManifest {
  const g = new GraphBuilder();

  // Action: select_storage (event.uiAction -> value = chosen globalVarId)
  g.node('ev_sel', 'event.uiAction', { actionId: 'select_storage' }, { x: 40, y: 120 });
  g.node('old_sr', 'cell.getState', { key: 'storageResource' }, { x: 240, y: 240 });
  g.node('is_same', 'logic.compare', { op: '==', b: '' }, { x: 440, y: 240 });
  g.node('br_same', 'flow.branch', {}, { x: 280, y: 120 });

  // Sequence: 0) remove old cap if set, 1) add new cap, 2) save state + sprite + status
  g.node('seq', 'flow.sequence', {}, { x: 480, y: 120 });

  g.node('has_old', 'logic.compare', { op: '!=', b: '' }, { x: 640, y: 260 });
  g.node('br_old', 'flow.branch', {}, { x: 700, y: 40 });
  g.node('sub_old', 'global.addCap', { delta: -100 }, { x: 920, y: 40 });

  g.node('add_new', 'global.addCap', { delta: 100 }, { x: 700, y: 140 });

  g.node('set_sr', 'cell.setState', { key: 'storageResource' }, { x: 700, y: 220 });
  g.node('var_name', 'get.globalVarName', {}, { x: 700, y: 340 });
  g.node('fmt_st', 'string.format', { template: '+100 {a} Cap' }, { x: 900, y: 340 });
  g.node('set_st', 'cell.setState', { key: 'status' }, { x: 920, y: 220 });
  g.node('set_spr', 'cell.setSprite', { spriteId: 'warehouse_active' }, { x: 1120, y: 220 });

  g.connect('ev_sel', 'out', 'br_same', 'in')
    .connect('ev_sel', 'value', 'is_same', 'a')
    .connect('old_sr', 'value', 'is_same', 'b')
    .connect('is_same', 'result', 'br_same', 'condition')
    .connect('br_same', 'false', 'seq', 'in')
    // then0: remove old cap
    .connect('seq', 'then0', 'br_old', 'in')
    .connect('old_sr', 'value', 'has_old', 'a')
    .connect('has_old', 'result', 'br_old', 'condition')
    .connect('br_old', 'true', 'sub_old', 'in')
    .connect('old_sr', 'value', 'sub_old', 'varId')
    // then1: add new cap
    .connect('seq', 'then1', 'add_new', 'in')
    .connect('ev_sel', 'value', 'add_new', 'varId')
    // then2: update storageResource, status, sprite
    .connect('seq', 'then2', 'set_sr', 'in')
    .connect('ev_sel', 'value', 'set_sr', 'value')
    .connect('set_sr', 'out', 'set_st', 'in')
    .connect('ev_sel', 'value', 'var_name', 'varId')
    .connect('var_name', 'name', 'fmt_st', 'a')
    .connect('fmt_st', 'result', 'set_st', 'value')
    .connect('set_st', 'out', 'set_spr', 'in');

  return {
    id: 'warehouse_panel',
    title: 'Warehouse',
    subtitle: 'Grants +100 storage cap to one resource',
    width: 256,
    role: 'popover',
    showSwatch: true,
    blocks: [
      {
        kind: 'stat',
        label: 'Active Bonus',
        value: '{{state.status}}',
        tone: 'accent',
      },
      {
        kind: 'selectList',
        label: 'Select Stored Resource',
        actionId: 'select_storage',
        source: 'globalVars',
        filterTag: 'storable',
        filterHasCap: true,
        selectedStateKey: 'storageResource',
      },
    ],
    graph: g.build(),
  };
}

// ============================================================================
// 5. Complete Classic Colony Ruleset Manifest (Schema v4)
// ============================================================================

export function createClassicColonyRuleset(): RulesetManifest {
  const sprites = buildClassicSprites();

  const cellTypes: CellTypeManifest[] = [
    {
      id: 'empty',
      name: 'Plains',
      description: 'Open ground suitable for Farms, Houses, and Warehouses.',
      defaultSpriteId: 'terrain_empty',
      defaultColor: '#2c3440',
      stateSchema: [],
      graph: buildEmptyGraph(),
    },
    {
      id: 'water',
      name: 'Water',
      description: 'Radiates Moisture (+2) to nearby tiles in radius 2.',
      defaultSpriteId: 'terrain_water',
      defaultColor: '#1d4f73',
      stateSchema: [],
      graph: buildWaterGraph(),
    },
    {
      id: 'forest',
      name: 'Forest',
      description: 'Dense timberland. Build a Sawmill here.',
      defaultSpriteId: 'terrain_forest',
      defaultColor: '#1d4430',
      stateSchema: [],
      graph: buildResourceSiteGraph(
        'Build on Forest',
        'sawmill',
        'Sawmill',
        'Needs 1 Worker → +3 Wood',
        '6 Money',
        [{ varId: 'money', amount: 6 }]
      ),
    },
    {
      id: 'mountain',
      name: 'Mountain',
      description: 'Rocky ridge. Build a Quarry here.',
      defaultSpriteId: 'terrain_mountain',
      defaultColor: '#3f4754',
      stateSchema: [],
      graph: buildResourceSiteGraph(
        'Build on Mountain',
        'quarry',
        'Quarry',
        'Needs 1 Worker → +2 Stone',
        '8 Money · 6 Wood',
        [
          { varId: 'money', amount: 8 },
          { varId: 'wood', amount: 6 },
        ]
      ),
    },
    {
      id: 'farm',
      name: 'Farm',
      description: 'Requires 1 Worker and Moisture to produce +3 Food per cycle.',
      defaultSpriteId: 'farm_idle',
      defaultColor: '#3c4328',
      stateSchema: [
        { key: 'worker', label: 'Worker', type: 'number', initialValue: 0, access: 'public' },
        { key: 'idle', label: 'Idle Cycles', type: 'number', initialValue: 0, access: 'public' },
        { key: 'status', label: 'Status', type: 'string', initialValue: 'Needs worker', access: 'public' },
      ],
      graph: buildWorkplaceGraph({
        name: 'Farm',
        produceVarId: 'food',
        produceAmount: 3,
        produceLabel: 'Food',
        requiresMoisture: true,
        activeSpriteId: 'farm_active',
        idleSpriteId: 'farm_idle',
        demolishToId: 'empty',
        refunds: [{ varId: 'money', amount: 2, label: 'Money' }],
      }),
    },
    {
      id: 'sawmill',
      name: 'Sawmill',
      description: 'Requires 1 Worker to produce +3 Wood per cycle.',
      defaultSpriteId: 'sawmill_idle',
      defaultColor: '#3d3326',
      substrateSpriteId: 'terrain_forest',
      stateSchema: [
        { key: 'worker', label: 'Worker', type: 'number', initialValue: 0, access: 'public' },
        { key: 'idle', label: 'Idle Cycles', type: 'number', initialValue: 0, access: 'public' },
        { key: 'status', label: 'Status', type: 'string', initialValue: 'Needs worker', access: 'public' },
      ],
      graph: buildWorkplaceGraph({
        name: 'Sawmill',
        produceVarId: 'wood',
        produceAmount: 3,
        produceLabel: 'Wood',
        requiresMoisture: false,
        activeSpriteId: 'sawmill_active',
        idleSpriteId: 'sawmill_idle',
        demolishToId: 'forest',
        refunds: [{ varId: 'money', amount: 3, label: 'Money' }],
      }),
    },
    {
      id: 'quarry',
      name: 'Quarry',
      description: 'Requires 1 Worker to produce +2 Stone per cycle.',
      defaultSpriteId: 'quarry_idle',
      defaultColor: '#363e4a',
      substrateSpriteId: 'terrain_mountain',
      stateSchema: [
        { key: 'worker', label: 'Worker', type: 'number', initialValue: 0, access: 'public' },
        { key: 'idle', label: 'Idle Cycles', type: 'number', initialValue: 0, access: 'public' },
        { key: 'status', label: 'Status', type: 'string', initialValue: 'Needs worker', access: 'public' },
      ],
      graph: buildWorkplaceGraph({
        name: 'Quarry',
        produceVarId: 'stone',
        produceAmount: 2,
        produceLabel: 'Stone',
        requiresMoisture: false,
        activeSpriteId: 'quarry_active',
        idleSpriteId: 'quarry_idle',
        demolishToId: 'mountain',
        refunds: [
          { varId: 'money', amount: 4, label: 'Money' },
          { varId: 'wood', amount: 3, label: 'Wood' },
        ],
      }),
    },
    {
      id: 'house',
      name: 'House',
      description: 'Grants +1 Population Cap. Consumes 1 Food for +1 Money each cycle.',
      defaultSpriteId: 'house',
      defaultColor: '#383034',
      priorityByState: 'hunger',
      stateSchema: [
        { key: 'hunger', label: 'Hunger', type: 'number', initialValue: 0, access: 'readonly' },
        { key: 'status', label: 'Status', type: 'string', initialValue: '−1 Food → +1 Money', access: 'readonly' },
      ],
      graph: buildHouseGraph(),
    },
    {
      id: 'warehouse',
      name: 'Warehouse',
      description: 'Adds +100 storage capacity to one chosen resource.',
      defaultSpriteId: 'warehouse',
      defaultColor: '#2e3846',
      stateSchema: [
        { key: 'storageResource', label: 'Stored', type: 'string', initialValue: '', access: 'public' },
        { key: 'status', label: 'Status', type: 'string', initialValue: 'Unset', access: 'public' },
      ],
      graph: buildWarehouseGraph(),
    },
  ];

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'classic-colony',
    name: 'Classic Colony',
    description:
      'Build Farms by Water, harvest Timber and Stone, shelter Workers in Houses, and expand storage with Warehouses.',
    author: 'Gridbound Core',
    defaultGridSize: { width: 14, height: 14 },
    defaultCellTypeId: 'empty',
    defaultHoverInterfaceId: '@builtin/inspector',
    setupOptions: [
      {
        id: 'terrainDensity',
        label: 'Terrain Density',
        description: 'Scales Water, Forest, and Mountain cluster coverage.',
        type: 'number',
        defaultValue: 1,
        min: 0.4,
        max: 1.6,
        step: 0.2,
      },
    ],
    sprites,
    globalState: {
      variables: [
        {
          id: 'money',
          name: 'Money',
          shortName: 'Gold',
          type: 'number',
          initialValue: 30,
          hasCap: false,
          allowNegative: false,
          access: 'public',
          color: '#f5b841',
        },
        {
          id: 'food',
          name: 'Food',
          type: 'number',
          initialValue: 12,
          hasCap: true,
          initialMax: 100,
          allowNegative: false,
          access: 'public',
          color: '#6ec46e',
          tags: ['storable'],
        },
        {
          id: 'wood',
          name: 'Wood',
          type: 'number',
          initialValue: 16,
          hasCap: true,
          initialMax: 100,
          allowNegative: false,
          access: 'public',
          color: '#c9884a',
          tags: ['storable'],
        },
        {
          id: 'stone',
          name: 'Stone',
          type: 'number',
          initialValue: 8,
          hasCap: true,
          initialMax: 100,
          allowNegative: false,
          access: 'public',
          color: '#9aa7b8',
          tags: ['storable'],
        },
        {
          id: 'population',
          name: 'Population',
          shortName: 'Pop',
          type: 'number',
          initialValue: 2,
          hasCap: true,
          initialMax: 2,
          allowNegative: false,
          access: 'public',
          color: '#67b8f0',
        },
      ],
      hud: [
        { variableId: 'money', label: 'Money', color: '#f5b841', showCap: false, showDelta: true },
        { variableId: 'food', label: 'Food', color: '#6ec46e', showCap: true, showDelta: true },
        { variableId: 'wood', label: 'Wood', color: '#c9884a', showCap: true, showDelta: true },
        { variableId: 'stone', label: 'Stone', color: '#9aa7b8', showCap: true, showDelta: true },
        { variableId: 'population', label: 'Pop', color: '#67b8f0', showCap: true, showDelta: false },
      ],
      graph: { nodes: [], edges: [] },
    },
    supplies: [
      {
        id: 'moisture',
        name: 'Moisture',
        description: 'Emitted by Water tiles in a 2-tile radius. Required by Farms.',
        color: '#38bdf8',
        maxExpected: 4,
        maxAmount: 99,
        decay: { kind: 'clear' },
        showInOverlay: true,
      },
    ],
    interfaces: [buildWorkplaceInterface(), buildWarehouseInterface()],
    worldGenerator: buildWorldGeneratorGraph(),
    cellTypes,
  };
}

export const CLASSIC_COLONY_RULESET: RulesetManifest = createClassicColonyRuleset();
