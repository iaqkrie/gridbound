import { CellTypeId, WorldGeneratorFn } from '../types';

export interface ClusterPassConfig {
  cellTypeId: CellTypeId;
  /** Average cluster count for a 32x24 (768 tile) reference map */
  clustersPer768: number;
  minClusters?: number;
  minSize: number;
  maxSize: number;
  onlyOnEmpty?: boolean;
}

export interface ClustersGeneratorParams {
  passes: ClusterPassConfig[];
  /** Optional setup param ID whose numeric value scales cluster density */
  densityParamId?: string;
}

const CARDINAL_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Builtin modular world generator: scatters organic random-walk clusters
 * scaled proportionally to map area using a deterministic seeded RNG.
 */
export const clustersWorldGenerator: WorldGeneratorFn<ClustersGeneratorParams> = (
  grid,
  setup,
  params,
  rng
) => {
  const area = grid.width * grid.height;
  const baseScale = area / 768;

  let densityMult = 1;
  if (params.densityParamId) {
    const raw = setup.params[params.densityParamId];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      densityMult = raw;
    } else if (typeof raw === 'string') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        densityMult = parsed;
      }
    }
  }

  for (const pass of params.passes ?? []) {
    const minClusters = pass.minClusters ?? 1;
    const clusterCount = Math.max(
      minClusters,
      Math.round(pass.clustersPer768 * baseScale * densityMult)
    );

    // Stratify cluster origins across sectors so terrain distributes evenly across the map
    const cols = Math.max(
      1,
      Math.round(Math.sqrt(clusterCount * (grid.width / Math.max(1, grid.height))))
    );
    const rows = Math.max(1, Math.ceil(clusterCount / cols));
    const sectorOrder: number[] = [];
    for (let s = 0; s < cols * rows; s++) {
      sectorOrder.push(s);
    }
    for (let i = sectorOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = sectorOrder[i];
      sectorOrder[i] = sectorOrder[j];
      sectorOrder[j] = tmp;
    }

    const sectorW = grid.width / cols;
    const sectorH = grid.height / rows;

    for (let c = 0; c < clusterCount; c++) {
      const sector = sectorOrder[c % sectorOrder.length];
      const sc = sector % cols;
      const sr = Math.floor(sector / cols);

      const minX = Math.floor(sc * sectorW);
      const maxX = Math.max(minX, Math.min(grid.width - 1, Math.ceil((sc + 1) * sectorW) - 1));
      const minY = Math.floor(sr * sectorH);
      const maxY = Math.max(minY, Math.min(grid.height - 1, Math.ceil((sr + 1) * sectorH) - 1));

      let x = minX + Math.floor(rng() * (maxX - minX + 1));
      let y = minY + Math.floor(rng() * (maxY - minY + 1));

      const targetSize =
        pass.minSize +
        Math.floor(rng() * Math.max(1, pass.maxSize - pass.minSize + 1));

      const visited = new Set<number>();
      let placed = 0;
      const maxAttempts = targetSize * 4;

      for (let attempt = 0; attempt < maxAttempts && placed < targetSize; attempt++) {
        const key = y * grid.width + x;
        if (!visited.has(key)) {
          visited.add(key);
          if (!pass.onlyOnEmpty || grid.getCell(x, y) === 'empty') {
            grid.setCell(x, y, pass.cellTypeId);
            placed++;
          }
        }

        // Prefer stepping to an unvisited in-bounds neighbor
        const startDir = Math.floor(rng() * CARDINAL_DIRS.length);
        let moved = false;
        for (let d = 0; d < CARDINAL_DIRS.length; d++) {
          const [dx, dy] = CARDINAL_DIRS[(startDir + d) % CARDINAL_DIRS.length];
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx >= 0 &&
            nx < grid.width &&
            ny >= 0 &&
            ny < grid.height &&
            !visited.has(ny * grid.width + nx) &&
            (!pass.onlyOnEmpty || grid.getCell(nx, ny) === 'empty')
          ) {
            x = nx;
            y = ny;
            moved = true;
            break;
          }
        }
        if (!moved) {
          const [dx, dy] = CARDINAL_DIRS[startDir];
          x = Math.max(0, Math.min(grid.width - 1, x + dx));
          y = Math.max(0, Math.min(grid.height - 1, y + dy));
        }
      }
    }
  }
};
