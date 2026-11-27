import {
  createPixelSprite32,
  CURRENT_SCHEMA_VERSION,
  encodeRgbaToPngDataUrl,
  GraphNode,
  NodeGraph,
  RulesetManifest,
} from '../../engine/sdk';

export function makeUniqueId(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'item';
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}_${n}`)) n++;
  return `${slug}_${n}`;
}

export function createStarterRuleset(existingIds: Iterable<string>): RulesetManifest {
  const id = makeUniqueId('custom_ruleset', existingIds);
  const plainsSprite = createPixelSprite32(
    'plains',
    'Plains',
    { a: '#3b4758', b: '#475569' },
    [
      '................',
      '................',
      '...a............',
      '................',
      '...........b....',
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
      '................',
    ]
  );

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    name: 'New Ruleset',
    description: 'Custom cellular strategy ruleset built in Gridbound Studio.',
    author: 'Author',
    defaultGridSize: { width: 12, height: 12 },
    defaultCellTypeId: 'empty',
    defaultHoverInterfaceId: '@builtin/inspector',
    setupOptions: [],
    sprites: [plainsSprite],
    globalState: {
      variables: [
        {
          id: 'energy',
          name: 'Energy',
          shortName: 'NRG',
          type: 'number',
          initialValue: 20,
          hasCap: false,
          allowNegative: false,
          access: 'public',
          color: '#38bdf8',
        },
      ],
      hud: [
        {
          variableId: 'energy',
          label: 'Energy',
          color: '#38bdf8',
          showCap: false,
          showDelta: true,
        },
      ],
      graph: { nodes: [], edges: [] },
    },
    supplies: [],
    interfaces: [],
    worldGenerator: {
      nodes: [
        {
          id: 'fill_base',
          type: 'gen.fillLayer',
          data: { cellTypeId: 'empty' },
          position: { x: 80, y: 120 },
        },
        {
          id: 'world_out',
          type: 'gen.output',
          data: {},
          position: { x: 380, y: 120 },
        },
      ],
      edges: [
        {
          id: 'e_init_1',
          fromNode: 'fill_base',
          fromPort: 'layer',
          toNode: 'world_out',
          toPort: 'layer',
        },
      ],
    },
    cellTypes: [
      {
        id: 'empty',
        name: 'Empty',
        description: 'Default starting tile.',
        defaultSpriteId: 'plains',
        defaultColor: '#2c3440',
        stateSchema: [],
        graph: {
          nodes: [
            {
              id: 'ev_click',
              type: 'event.click',
              data: {},
              position: { x: 80, y: 120 },
            },
          ],
          edges: [],
        },
      },
    ],
  };
}

export function cloneRulesetAsCustom(
  source: RulesetManifest,
  existingIds: Iterable<string>
): RulesetManifest {
  const copy = JSON.parse(JSON.stringify(source)) as RulesetManifest;
  copy.id = makeUniqueId(`${source.id}_custom`, existingIds);
  copy.name = `${source.name} (Copy)`;
  return copy;
}

/**
 * Computes a clean left-to-right layered topology layout for any NodeGraph.
 */
export function autoLayoutGraph(graph: NodeGraph): NodeGraph {
  if (graph.nodes.length === 0) return graph;

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of graph.nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of graph.edges) {
    if (incoming.has(e.toNode) && outgoing.has(e.fromNode)) {
      incoming.get(e.toNode)!.push(e.fromNode);
      outgoing.get(e.fromNode)!.push(e.toNode);
    }
  }

  // Assign column depth via longest-path BFS with cycle guard
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const n of graph.nodes) {
    if ((incoming.get(n.id)?.length ?? 0) === 0 || n.type.startsWith('event.')) {
      depth.set(n.id, 0);
      queue.push(n.id);
    }
  }
  // Fallback for disconnected cycles
  for (const n of graph.nodes) {
    if (!depth.has(n.id)) {
      depth.set(n.id, 0);
      queue.push(n.id);
    }
  }

  const visitCount = new Map<string, number>();
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const curDepth = depth.get(cur) ?? 0;
    for (const next of outgoing.get(cur) ?? []) {
      const visits = (visitCount.get(next) ?? 0) + 1;
      if (visits > graph.nodes.length + 2) continue;
      visitCount.set(next, visits);
      const prevDepth = depth.get(next) ?? 0;
      if (curDepth + 1 > prevDepth) {
        depth.set(next, curDepth + 1);
        queue.push(next);
      }
    }
  }

  const columns = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) {
    const col = depth.get(n.id) ?? 0;
    const list = columns.get(col) ?? [];
    list.push(n);
    columns.set(col, list);
  }

  const posMap = new Map<string, { x: number; y: number }>();
  const COL_W = 260;
  const ROW_H = 148;
  for (const [col, colNodes] of columns.entries()) {
    colNodes.forEach((node, rowIdx) => {
      posMap.set(node.id, {
        x: 48 + col * COL_W,
        y: 48 + rowIdx * ROW_H,
      });
    });
  }

  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      ...n,
      position: posMap.get(n.id) ?? n.position ?? { x: 48, y: 48 },
    })),
  };
}

/**
 * Decodes any PNG/image dataUrl into a 32×32 RGBA Uint8ClampedArray using offscreen canvas.
 */
export function decodeDataUrlToRgba32(
  dataUrl: string
): Promise<Uint8ClampedArray> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(new Uint8ClampedArray(32 * 32 * 4));
        return;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 32, 32);
      ctx.drawImage(img, 0, 0, 32, 32);
      resolve(ctx.getImageData(0, 0, 32, 32).data);
    };
    img.onerror = () => {
      resolve(new Uint8ClampedArray(32 * 32 * 4));
    };
    img.src = dataUrl;
  });
}

/**
 * Loads an uploaded image File, resizes nearest-neighbor to 32×32, and encodes as valid PNG dataUrl.
 */
export function importImageFileAsPng32(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = async () => {
      const srcUrl = String(reader.result ?? '');
      if (!srcUrl) {
        reject(new Error('Empty image data'));
        return;
      }
      const rgba = await decodeDataUrlToRgba32(srcUrl);
      resolve(encodeRgbaToPngDataUrl(new Uint8Array(rgba.buffer), 32, 32));
    };
    reader.readAsDataURL(file);
  });
}
