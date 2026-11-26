import {
  GeneratorStep,
  GridMutator,
  SeededRng,
  WorldSetupValues,
} from './types';

const CARDINAL_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function resolveDensityMultiplier(
  setup: WorldSetupValues,
  densityParam?: string
): number {
  if (!densityParam) return 1;
  const raw = setup.params[densityParam];
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 1;
}

function buildShuffledSectors(
  count: number,
  width: number,
  height: number,
  rng: SeededRng
): { cols: number; rows: number; order: number[] } {
  const cols = Math.max(
    1,
    Math.round(Math.sqrt(count * (width / Math.max(1, height))))
  );
  const rows = Math.max(1, Math.ceil(count / cols));
  const order: number[] = [];
  for (let s = 0; s < cols * rows; s++) {
    order.push(s);
  }
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return { cols, rows, order };
}

function runClustersStep(
  grid: GridMutator,
  setup: WorldSetupValues,
  step: Extract<GeneratorStep, { type: 'clusters' }>,
  rng: SeededRng
): void {
  const area = grid.width * grid.height;
  const baseScale = area / 768;
  const densityMult = resolveDensityMultiplier(setup, step.densityParam);
  const minClusters = step.minClusters ?? 1;
  const clusterCount = Math.max(
    minClusters,
    Math.round(step.clustersPer768 * baseScale * densityMult)
  );

  const { cols, rows, order } = buildShuffledSectors(
    clusterCount,
    grid.width,
    grid.height,
    rng
  );
  const sectorW = grid.width / cols;
  const sectorH = grid.height / rows;
  const onlyOnEmpty = step.onlyOnEmpty ?? false;

  for (let c = 0; c < clusterCount; c++) {
    const sector = order[c % order.length];
    const sc = sector % cols;
    const sr = Math.floor(sector / cols);

    const minX = Math.floor(sc * sectorW);
    const maxX = Math.max(
      minX,
      Math.min(grid.width - 1, Math.ceil((sc + 1) * sectorW) - 1)
    );
    const minY = Math.floor(sr * sectorH);
    const maxY = Math.max(
      minY,
      Math.min(grid.height - 1, Math.ceil((sr + 1) * sectorH) - 1)
    );

    let x = minX + Math.floor(rng() * (maxX - minX + 1));
    let y = minY + Math.floor(rng() * (maxY - minY + 1));

    const targetSize =
      step.minSize +
      Math.floor(rng() * Math.max(1, step.maxSize - step.minSize + 1));

    const visited = new Set<number>();
    let placed = 0;
    const maxAttempts = targetSize * 4;

    for (
      let attempt = 0;
      attempt < maxAttempts && placed < targetSize;
      attempt++
    ) {
      const key = y * grid.width + x;
      if (!visited.has(key)) {
        visited.add(key);
        if (!onlyOnEmpty || grid.getCell(x, y) === grid.defaultCellTypeId) {
          grid.setCell(x, y, step.cell);
          placed++;
        }
      }

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
          (!onlyOnEmpty || grid.getCell(nx, ny) === grid.defaultCellTypeId)
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

function runScatterStep(
  grid: GridMutator,
  setup: WorldSetupValues,
  step: Extract<GeneratorStep, { type: 'scatter' }>,
  rng: SeededRng
): void {
  const area = grid.width * grid.height;
  const baseScale = area / 768;
  const densityMult = resolveDensityMultiplier(setup, step.densityParam);
  const count = Math.max(
    step.minCount ?? 0,
    Math.round(step.countPer768 * baseScale * densityMult)
  );
  if (count <= 0) return;

  const { cols, rows, order } = buildShuffledSectors(
    count,
    grid.width,
    grid.height,
    rng
  );
  const sectorW = grid.width / cols;
  const sectorH = grid.height / rows;
  const onlyOnEmpty = step.onlyOnEmpty ?? true;

  for (let i = 0; i < count; i++) {
    const sector = order[i % order.length];
    const sc = sector % cols;
    const sr = Math.floor(sector / cols);

    const minX = Math.floor(sc * sectorW);
    const maxX = Math.max(
      minX,
      Math.min(grid.width - 1, Math.ceil((sc + 1) * sectorW) - 1)
    );
    const minY = Math.floor(sr * sectorH);
    const maxY = Math.max(
      minY,
      Math.min(grid.height - 1, Math.ceil((sr + 1) * sectorH) - 1)
    );

    for (let tries = 0; tries < 6; tries++) {
      const x = minX + Math.floor(rng() * (maxX - minX + 1));
      const y = minY + Math.floor(rng() * (maxY - minY + 1));
      if (!onlyOnEmpty || grid.getCell(x, y) === grid.defaultCellTypeId) {
        grid.setCell(x, y, step.cell);
        break;
      }
    }
  }
}

function runPlaceNearStep(
  grid: GridMutator,
  step: Extract<GeneratorStep, { type: 'placeNear' }>,
  rng: SeededRng
): void {
  const r = Math.max(1, step.radius ?? 1);
  const neighborhood = step.neighborhood ?? 'vonNeumann';
  const onlyOnEmpty = step.onlyOnEmpty ?? true;
  const candidates: { x: number; y: number }[] = [];
  const seen = new Set<number>();

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.getCell(x, y) !== step.nearCell) continue;

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (neighborhood === 'vonNeumann' && Math.abs(dx) + Math.abs(dy) > r) {
            continue;
          }
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) {
            continue;
          }
          const key = ny * grid.width + nx;
          if (seen.has(key)) continue;
          if (onlyOnEmpty && grid.getCell(nx, ny) !== grid.defaultCellTypeId) {
            continue;
          }
          seen.add(key);
          candidates.push({ x: nx, y: ny });
        }
      }
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }

  let placed = 0;
  for (const coord of candidates) {
    if (step.maxCount !== undefined && placed >= step.maxCount) break;
    if (rng() <= step.chance) {
      grid.setCell(coord.x, coord.y, step.cell);
      placed++;
    }
  }
}

/**
 * Executes an ordered declarative world generator pipeline deterministically.
 */
export function runWorldGeneratorPipeline(
  steps: readonly GeneratorStep[],
  grid: GridMutator,
  setup: WorldSetupValues,
  rng: SeededRng
): void {
  for (const step of steps) {
    switch (step.type) {
      case 'fill':
        for (let y = 0; y < grid.height; y++) {
          for (let x = 0; x < grid.width; x++) {
            grid.setCell(x, y, step.cell);
          }
        }
        break;
      case 'clusters':
        runClustersStep(grid, setup, step, rng);
        break;
      case 'scatter':
        runScatterStep(grid, setup, step, rng);
        break;
      case 'placeNear':
        runPlaceNearStep(grid, step, rng);
        break;
    }
  }
}
