import { createSeededRng } from './decay';
import { CellTypeId, GraphNode, NodeGraph, RuntimeValue } from './types';

// ============================================================================
// Layer & Mask Node-Based World Generator (Schema v4)
// Operates on 2D Masks (Float32Array 0..1) and Cell Layers (Int16Array, -1 = transparent)
// ============================================================================

export interface GeneratorContext {
  width: number;
  height: number;
  seed: string;
  setupValues: Record<string, RuntimeValue>;
  cellIndexById: Map<CellTypeId, number>;
  defaultCellIndex: number;
}

type GenValue = number | Float32Array | Int16Array;

function hash2D(ix: number, iy: number, seedNum: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seedNum, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(x: number, y: number, seedNum: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);

  const v00 = hash2D(x0, y0, seedNum);
  const v10 = hash2D(x0 + 1, y0, seedNum);
  const v01 = hash2D(x0, y0 + 1, seedNum);
  const v11 = hash2D(x0 + 1, y0 + 1, seedNum);

  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fy;
}

function seedToNumber(seed: string, offset: number): number {
  let h = 2166136261 >>> 0;
  const full = `${seed}:${offset}`;
  for (let i = 0; i < full.length; i++) {
    h ^= full.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function numVal(v: GenValue | undefined, fallback = 0): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
}

function maskVal(v: GenValue | undefined, size: number): Float32Array {
  return v instanceof Float32Array ? v : new Float32Array(size);
}

function layerVal(v: GenValue | undefined, size: number): Int16Array {
  if (v instanceof Int16Array) return v;
  const empty = new Int16Array(size);
  empty.fill(-1);
  return empty;
}

export function runWorldGeneratorGraph(
  graph: NodeGraph,
  grid: Uint16Array,
  ctx: GeneratorContext
): void {
  const size = ctx.width * ctx.height;
  grid.fill(ctx.defaultCellIndex);

  const nodes = new Map<string, GraphNode>();
  const dataIn = new Map<string, { nodeId: string; port: string }>();

  let outputNode: GraphNode | undefined;
  for (const node of graph.nodes) {
    nodes.set(node.id, node);
    if (node.type === 'gen.output') {
      outputNode = node;
    }
  }
  for (const edge of graph.edges) {
    dataIn.set(`${edge.toNode}:${edge.toPort}`, {
      nodeId: edge.fromNode,
      port: edge.fromPort,
    });
  }

  if (!outputNode) return;

  const cache = new Map<string, GenValue>();

  const readInput = (
    nodeId: string,
    port: string,
    fallback: number | undefined,
    visiting: Set<string>
  ): GenValue | undefined => {
    const src = dataIn.get(`${nodeId}:${port}`);
    if (src) {
      return evalNode(src.nodeId, src.port, visiting);
    }
    const node = nodes.get(nodeId);
    const dataVal = node?.data?.[port];
    if (typeof dataVal === 'number') return dataVal;
    return fallback;
  };

  const evalNode = (
    nodeId: string,
    port: string,
    visiting: Set<string>
  ): GenValue => {
    const cacheKey = `${nodeId}:${port}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    if (visiting.has(cacheKey)) return 0;

    const node = nodes.get(nodeId);
    if (!node) return 0;

    visiting.add(cacheKey);
    const data = node.data ?? {};
    let result: GenValue = 0;

    switch (node.type) {
      case 'gen.setupParam': {
        const paramId = String(data.paramId ?? '');
        const raw = ctx.setupValues[paramId];
        result = typeof raw === 'number' ? raw : typeof raw === 'boolean' ? (raw ? 1 : 0) : 0;
        break;
      }

      case 'gen.mapSize': {
        result = port === 'height' ? ctx.height : ctx.width;
        break;
      }

      case 'gen.constNumber': {
        result = typeof data.value === 'number' ? data.value : 0;
        break;
      }

      case 'gen.math': {
        const a = numVal(readInput(nodeId, 'a', typeof data.a === 'number' ? data.a : 0, visiting));
        const b = numVal(readInput(nodeId, 'b', typeof data.b === 'number' ? data.b : 1, visiting));
        switch (data.op) {
          case 'add':
            result = a + b;
            break;
          case 'sub':
            result = a - b;
            break;
          case 'mul':
            result = a * b;
            break;
          case 'div':
            result = b === 0 ? 0 : a / b;
            break;
          case 'min':
            result = Math.min(a, b);
            break;
          case 'max':
            result = Math.max(a, b);
            break;
          default:
            result = a * b;
        }
        break;
      }

      case 'gen.noise': {
        const scale = Math.max(
          0.5,
          numVal(readInput(nodeId, 'scale', typeof data.scale === 'number' ? data.scale : 6, visiting), 6)
        );
        const octaves = Math.max(1, Math.min(5, Math.round(Number(data.octaves ?? 2))));
        const seedOffset = Number(data.seedOffset ?? 0);
        const seedNum = seedToNumber(ctx.seed, seedOffset);
        const mask = new Float32Array(size);

        for (let y = 0; y < ctx.height; y++) {
          for (let x = 0; x < ctx.width; x++) {
            let amp = 1;
            let freq = 1 / scale;
            let total = 0;
            let norm = 0;
            for (let o = 0; o < octaves; o++) {
              total += valueNoise2D(x * freq, y * freq, seedNum + o * 7919) * amp;
              norm += amp;
              amp *= 0.5;
              freq *= 2;
            }
            mask[y * ctx.width + x] = norm > 0 ? total / norm : 0;
          }
        }
        result = mask;
        break;
      }

      case 'gen.clusters': {
        const coverage = Math.max(
          0,
          Math.min(
            1,
            numVal(
              readInput(
                nodeId,
                'coverage',
                typeof data.targetCoverage === 'number' ? data.targetCoverage : 0.12,
                visiting
              ),
              0.12
            )
          )
        );
        const clusterSize = Math.max(
          1,
          Math.round(
            numVal(
              readInput(
                nodeId,
                'clusterSize',
                typeof data.clusterSize === 'number' ? data.clusterSize : 5,
                visiting
              ),
              5
            )
          )
        );
        const seedOffset = Number(data.seedOffset ?? 0);
        const rng = createSeededRng(`${ctx.seed}:cluster:${nodeId}:${seedOffset}`);
        const mask = new Float32Array(size);
        const targetCount = Math.round(size * coverage);
        let placed = 0;
        let attempts = 0;
        const maxAttempts = Math.max(60, targetCount * 8);

        while (placed < targetCount && attempts < maxAttempts) {
          attempts++;
          let cx = Math.floor(rng() * ctx.width);
          let cy = Math.floor(rng() * ctx.height);

          const blobSteps = Math.max(1, Math.round(clusterSize * (0.6 + rng() * 0.8)));
          for (let s = 0; s < blobSteps && placed < targetCount; s++) {
            const idx = cy * ctx.width + cx;
            if (mask[idx] === 0) {
              mask[idx] = 1;
              placed++;
            }
            const dir = Math.floor(rng() * 4);
            if (dir === 0 && cx > 0) cx--;
            else if (dir === 1 && cx < ctx.width - 1) cx++;
            else if (dir === 2 && cy > 0) cy--;
            else if (dir === 3 && cy < ctx.height - 1) cy++;
          }
        }
        result = mask;
        break;
      }

      case 'gen.scatter': {
        const density = Math.max(
          0,
          Math.min(
            1,
            numVal(
              readInput(
                nodeId,
                'density',
                typeof data.density === 'number' ? data.density : 0.1,
                visiting
              ),
              0.1
            )
          )
        );
        const seedOffset = Number(data.seedOffset ?? 0);
        const rng = createSeededRng(`${ctx.seed}:scatter:${nodeId}:${seedOffset}`);
        const mask = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          mask[i] = rng() < density ? 1 : 0;
        }
        result = mask;
        break;
      }

      case 'gen.distanceFromLayer': {
        const layer = layerVal(readInput(nodeId, 'layer', undefined, visiting), size);
        const maxDist = Math.max(1, Number(data.maxDistance ?? 5));
        const dist = new Int16Array(size);
        dist.fill(32767);
        const queue: number[] = [];

        for (let i = 0; i < size; i++) {
          if (layer[i] >= 0) {
            dist[i] = 0;
            queue.push(i);
          }
        }

        let head = 0;
        while (head < queue.length) {
          const cur = queue[head++];
          const curDist = dist[cur];
          if (curDist >= maxDist) continue;
          const cx = cur % ctx.width;
          const cy = Math.floor(cur / ctx.width);
          const neighbors = [
            [cx - 1, cy],
            [cx + 1, cy],
            [cx, cy - 1],
            [cx, cy + 1],
          ];
          for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= ctx.width || ny >= ctx.height) continue;
            const nIdx = ny * ctx.width + nx;
            if (dist[nIdx] > curDist + 1) {
              dist[nIdx] = curDist + 1;
              queue.push(nIdx);
            }
          }
        }

        const mask = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          const d = Math.min(maxDist, dist[i]);
          mask[i] = 1 - d / maxDist;
        }
        result = mask;
        break;
      }

      case 'gen.threshold': {
        const srcMask = maskVal(readInput(nodeId, 'mask', undefined, visiting), size);
        const min = numVal(readInput(nodeId, 'min', typeof data.min === 'number' ? data.min : 0.5, visiting), 0.5);
        const max = numVal(readInput(nodeId, 'max', typeof data.max === 'number' ? data.max : 1.0, visiting), 1.0);
        const out = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          const v = srcMask[i];
          out[i] = v >= min && v <= max ? 1 : 0;
        }
        result = out;
        break;
      }

      case 'gen.invert': {
        const srcMask = maskVal(readInput(nodeId, 'mask', undefined, visiting), size);
        const out = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          out[i] = 1 - Math.max(0, Math.min(1, srcMask[i]));
        }
        result = out;
        break;
      }

      case 'gen.maskCombine': {
        const a = maskVal(readInput(nodeId, 'a', undefined, visiting), size);
        const b = maskVal(readInput(nodeId, 'b', undefined, visiting), size);
        const op = String(data.op ?? 'mul');
        const out = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          let v: number;
          switch (op) {
            case 'add':
              v = a[i] + b[i];
              break;
            case 'sub':
              v = a[i] - b[i];
              break;
            case 'min':
              v = Math.min(a[i], b[i]);
              break;
            case 'max':
              v = Math.max(a[i], b[i]);
              break;
            default:
              v = a[i] * b[i];
          }
          out[i] = Math.max(0, Math.min(1, v));
        }
        result = out;
        break;
      }

      case 'gen.fillLayer': {
        const cellId = String(data.cellTypeId ?? '');
        const cellIdx = ctx.cellIndexById.get(cellId) ?? -1;
        const layer = new Int16Array(size);
        layer.fill(cellIdx);
        result = layer;
        break;
      }

      case 'gen.paintLayer': {
        const mask = maskVal(readInput(nodeId, 'mask', undefined, visiting), size);
        const threshold = numVal(
          readInput(nodeId, 'threshold', typeof data.threshold === 'number' ? data.threshold : 0.5, visiting),
          0.5
        );
        const cellId = String(data.cellTypeId ?? '');
        const cellIdx = ctx.cellIndexById.get(cellId) ?? -1;
        const layer = new Int16Array(size);
        layer.fill(-1);
        if (cellIdx >= 0) {
          for (let i = 0; i < size; i++) {
            if (mask[i] >= threshold) {
              layer[i] = cellIdx;
            }
          }
        }
        result = layer;
        break;
      }

      case 'gen.mergeLayers': {
        const base = layerVal(readInput(nodeId, 'base', undefined, visiting), size);
        const overlay = layerVal(readInput(nodeId, 'overlay', undefined, visiting), size);
        const out = new Int16Array(size);
        for (let i = 0; i < size; i++) {
          out[i] = overlay[i] >= 0 ? overlay[i] : base[i];
        }
        result = out;
        break;
      }

      default:
        result = 0;
    }

    visiting.delete(cacheKey);
    cache.set(cacheKey, result);
    return result;
  };

  const finalLayer = layerVal(
    readInput(outputNode.id, 'layer', undefined, new Set()),
    size
  );

  for (let i = 0; i < size; i++) {
    grid[i] = finalLayer[i] >= 0 ? finalLayer[i] : ctx.defaultCellIndex;
  }
}
