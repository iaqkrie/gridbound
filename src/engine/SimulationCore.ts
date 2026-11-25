import { t } from '../i18n';
import {
  AffordabilityCheck,
  BoundaryMode,
  CellClickAction,
  CellInspection,
  CellNotification,
  CellStateData,
  CellTypeId,
  CompiledRuleset,
  DemolishInfo,
  GridCoordinate,
  GridMutator,
  MouseButton,
  ResolvedCellType,
  ResourceDelta,
  ResourceId,
  ResourceProjectionBreakdown,
  RulesetManifest,
  SerializedSimulationState,
  SimulationStats,
  StepResult,
  SupplyEmission,
  SupplyId,
  SupplyManifest,
  WorldApi,
  WorldCellSnapshot,
  WorldSetupValues,
  applyDecayRule,
  createSeededRng,
  generateRandomSeed,
} from './sdk';

function addDelta(target: ResourceDelta, delta: ResourceDelta | undefined): void {
  if (!delta) return;
  for (const [resId, amount] of Object.entries(delta)) {
    if (!amount) continue;
    target[resId] = (target[resId] ?? 0) + amount;
  }
}

/**
 * Pure Ruleset-Agnostic Cellular Strategy Engine Core.
 *
 * The core has ZERO hardcoded knowledge of specific mechanics like population,
 * workers, hunger, or storage. Global resources are strictly 'unlimited' or
 * 'capped', and all custom cell logic lives in modular TS behaviors & TSX panels.
 *
 * 3-Phase Buffer Cycle Pipeline:
 *   Phase 1 — Consume, React & Transition
 *   Phase 2 — Decay (spatial supplies & optional decaying global resources)
 *   Phase 3 — Produce (spatial emissions & next-cycle global resources)
 */
export class SimulationCore {
  public readonly compiled: CompiledRuleset;
  public readonly manifest: RulesetManifest;
  public readonly width: number;
  public readonly height: number;
  public readonly boundaryMode: BoundaryMode;
  public readonly seed: string;

  private currentGrid: Uint8Array;
  private nextGrid: Uint8Array;
  private cellStates: (CellStateData | null)[];
  private nextCellStates: (CellStateData | null)[];
  private emitFlags: Uint8Array;
  private supplyBuffers: Map<SupplyId, Int16Array>;
  private supplyDefsById: Map<SupplyId, SupplyManifest>;
  private cellTypeByIndex: ResolvedCellType[];
  private cellIndexById: Map<CellTypeId, number>;
  private defaultCellIndex: number;
  private resources: Record<ResourceId, number>;
  private notifications: CellNotification[] = [];
  private cycleCount = 0;

  constructor(
    compiled: CompiledRuleset,
    width?: number,
    height?: number,
    seed?: string
  ) {
    this.compiled = compiled;
    this.manifest = compiled.manifest;
    this.width = width ?? compiled.manifest.defaultGridSize.width;
    this.height = height ?? compiled.manifest.defaultGridSize.height;
    this.boundaryMode = compiled.manifest.boundaryMode;
    this.seed = seed?.trim() || generateRandomSeed();

    this.cellTypeByIndex = [...compiled.cellTypes];
    this.cellIndexById = new Map();
    this.cellTypeByIndex.forEach((def, idx) => {
      this.cellIndexById.set(def.id, idx);
    });

    const defIdx = this.cellIndexById.get(compiled.manifest.defaultCellTypeId);
    if (defIdx === undefined) {
      throw new Error(
        `Unknown defaultCellTypeId: ${compiled.manifest.defaultCellTypeId}`
      );
    }
    this.defaultCellIndex = defIdx;

    const total = this.width * this.height;
    this.currentGrid = new Uint8Array(total);
    this.nextGrid = new Uint8Array(total);
    this.cellStates = new Array(total).fill(null);
    this.nextCellStates = new Array(total).fill(null);
    this.emitFlags = new Uint8Array(total);
    this.currentGrid.fill(this.defaultCellIndex);

    this.resources = {};
    for (const res of compiled.manifest.resources) {
      this.resources[res.id] = res.initialValue;
    }

    this.supplyBuffers = new Map();
    this.supplyDefsById = new Map();
    for (const supply of compiled.manifest.supplies) {
      this.supplyBuffers.set(supply.id, new Int16Array(total));
      this.supplyDefsById.set(supply.id, supply);
    }
  }

  public static createNewGame(
    compiled: CompiledRuleset,
    setup?: Partial<WorldSetupValues>
  ): SimulationCore {
    const manifest = compiled.manifest;
    const width = setup?.width ?? manifest.defaultGridSize.width;
    const height = setup?.height ?? manifest.defaultGridSize.height;
    const seed = setup?.seed?.trim() || generateRandomSeed();

    const defaultParams: Record<string, string | number | boolean> = {};
    for (const param of manifest.setupOptions?.params ?? []) {
      defaultParams[param.id] = param.defaultValue;
    }
    const mergedParams = { ...defaultParams, ...(setup?.params ?? {}) };

    const core = new SimulationCore(compiled, width, height, seed);
    core.generateNewMap({
      width,
      height,
      seed,
      params: mergedParams,
    });

    const initialCycles = manifest.initialCycles ?? 1;
    for (let i = 0; i < initialCycles; i++) {
      core.step();
    }
    return core;
  }

  public static deserialize(
    compiled: CompiledRuleset,
    snapshot: SerializedSimulationState
  ): SimulationCore {
    const core = new SimulationCore(compiled, snapshot.width, snapshot.height);
    const total = core.width * core.height;

    for (let i = 0; i < total && i < snapshot.grid.length; i++) {
      const idx = snapshot.grid[i];
      core.currentGrid[i] =
        idx >= 0 && idx < core.cellTypeByIndex.length
          ? idx
          : core.defaultCellIndex;

      const savedState = snapshot.cellStates?.[i];
      if (savedState && typeof savedState === 'object') {
        core.cellStates[i] = { ...savedState };
      } else {
        core.cellStates[i] = core.createCellInitialState(
          core.cellTypeByIndex[core.currentGrid[i]]
        );
      }
    }

    core.cycleCount = snapshot.cycle;

    for (const res of compiled.manifest.resources) {
      const savedVal = snapshot.resources[res.id];
      core.resources[res.id] =
        typeof savedVal === 'number' ? savedVal : res.initialValue;
    }

    for (const supply of compiled.manifest.supplies) {
      const buffer = core.supplyBuffers.get(supply.id);
      const savedArr = snapshot.supplies?.[supply.id];
      if (!buffer || !savedArr) continue;
      for (let i = 0; i < total && i < savedArr.length; i++) {
        buffer[i] = savedArr[i];
      }
    }

    core.notifications = Array.isArray(snapshot.notifications)
      ? snapshot.notifications.map((n) => ({ ...n }))
      : [];

    core.reconcileResourceCaps();
    return core;
  }

  public serialize(): SerializedSimulationState {
    const supplies: Record<SupplyId, number[]> = {};
    for (const [supplyId, buffer] of this.supplyBuffers.entries()) {
      supplies[supplyId] = Array.from(buffer);
    }

    return {
      rulesetId: this.manifest.id,
      width: this.width,
      height: this.height,
      cycle: this.cycleCount,
      resources: { ...this.resources },
      grid: Array.from(this.currentGrid),
      cellStates: this.cellStates.map((st) => (st ? { ...st } : null)),
      supplies,
      notifications: this.notifications.map((n) => ({ ...n })),
    };
  }

  private createCellInitialState(def: ResolvedCellType): CellStateData | null {
    const fromBehavior = def.behavior?.module.createInitialState
      ? def.behavior.module.createInitialState(def.behavior.params)
      : null;
    if (!def.initialState && !fromBehavior) return null;
    return {
      ...(fromBehavior ?? {}),
      ...(def.initialState ?? {}),
    };
  }

  public get cycle(): number {
    return this.cycleCount;
  }

  public getNotifications(): CellNotification[] {
    return [...this.notifications];
  }

  public dismissNotification(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id);
  }

  public clearNotificationsAt(x: number, y: number): void {
    this.notifications = this.notifications.filter(
      (n) => !(n.x === x && n.y === y)
    );
  }

  public getResources(): Record<ResourceId, number> {
    return { ...this.resources };
  }

  public getResource(id: ResourceId): number {
    return this.resources[id] ?? 0;
  }

  public getResourceCaps(): Record<ResourceId, number | null> {
    const caps: Record<ResourceId, number | null> = {};
    for (const res of this.manifest.resources) {
      caps[res.id] = res.kind === 'capped' ? res.initialMax : null;
    }

    const total = this.currentGrid.length;
    for (let i = 0; i < total; i++) {
      const def = this.cellTypeByIndex[this.currentGrid[i]];

      if (def.capBonus) {
        for (const [resId, extra] of Object.entries(def.capBonus)) {
          if (!extra) continue;
          if (caps[resId] !== null && caps[resId] !== undefined) {
            caps[resId] = (caps[resId] as number) + extra;
          }
        }
      }

      const dynamicCapFn = def.behavior?.module.getCapBonus;
      if (dynamicCapFn && def.behavior) {
        const bonus = dynamicCapFn(this.cellStates[i] ?? {}, def.behavior.params);
        if (bonus) {
          for (const [resId, extra] of Object.entries(bonus)) {
            if (!extra) continue;
            if (caps[resId] !== null && caps[resId] !== undefined) {
              caps[resId] = (caps[resId] as number) + extra;
            }
          }
        }
      }
    }

    return caps;
  }

  public getResourceCap(id: ResourceId): number | null {
    return this.getResourceCaps()[id] ?? null;
  }

  public reconcileResourceCaps(): void {
    const caps = this.getResourceCaps();
    for (const [resId, maxVal] of Object.entries(caps)) {
      if (maxVal === null) continue;
      const current = this.resources[resId] ?? 0;
      if (current > maxVal) {
        this.resources[resId] = maxVal;
      }
    }
  }

  public addResource(id: ResourceId, delta: number): void {
    if (!delta) return;
    const cap = this.getResourceCap(id);
    let next = (this.resources[id] ?? 0) + delta;
    if (cap !== null && next > cap) {
      next = cap;
    }
    this.resources[id] = next;
  }

  public consumeResource(id: ResourceId, amount: number): boolean {
    if (amount <= 0) return true;
    const have = this.resources[id] ?? 0;
    if (have < amount) return false;
    this.resources[id] = have - amount;
    return true;
  }

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  public resolveCoordinate(x: number, y: number): GridCoordinate | null {
    if (this.boundaryMode === 'toroidal') {
      const rx = ((x % this.width) + this.width) % this.width;
      const ry = ((y % this.height) + this.height) % this.height;
      return { x: rx, y: ry };
    }
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return { x, y };
  }

  public getCellTypeAt(x: number, y: number): ResolvedCellType {
    const idx = this.currentGrid[y * this.width + x];
    return this.cellTypeByIndex[idx];
  }

  public getCellStateAt(x: number, y: number): CellStateData {
    if (!this.inBounds(x, y)) return {};
    const st = this.cellStates[y * this.width + x];
    return st ? { ...st } : {};
  }

  public patchCellState(x: number, y: number, patch: CellStateData): void {
    if (!this.inBounds(x, y)) return;
    const idx = y * this.width + x;
    const current = this.cellStates[idx] ?? {};
    this.cellStates[idx] = { ...current, ...patch };
  }

  public getCellTypeById(id: CellTypeId): ResolvedCellType | undefined {
    const idx = this.cellIndexById.get(id);
    return idx !== undefined ? this.cellTypeByIndex[idx] : undefined;
  }

  public getCellIndexBuffer(): Uint8Array {
    return this.currentGrid;
  }

  public getCellTypes(): readonly ResolvedCellType[] {
    return this.cellTypeByIndex;
  }

  public getSupplyBuffer(supplyId: SupplyId): Int16Array | undefined {
    return this.supplyBuffers.get(supplyId);
  }

  public getSupplyAt(x: number, y: number, supplyId: SupplyId): number {
    const buffer = this.supplyBuffers.get(supplyId);
    if (!buffer || !this.inBounds(x, y)) return 0;
    return buffer[y * this.width + x];
  }

  public setSupplyAt(
    x: number,
    y: number,
    supplyId: SupplyId,
    amount: number
  ): void {
    const buffer = this.supplyBuffers.get(supplyId);
    if (!buffer || !this.inBounds(x, y)) return;
    buffer[y * this.width + x] = Math.max(0, Math.floor(amount));
  }

  public getLocalSupplies(x: number, y: number): Record<SupplyId, number> {
    const idx = y * this.width + x;
    const result: Record<SupplyId, number> = {};
    for (const [supplyId, buffer] of this.supplyBuffers.entries()) {
      result[supplyId] = buffer[idx];
    }
    return result;
  }

  public setCell(x: number, y: number, cellTypeId: CellTypeId): boolean {
    if (!this.inBounds(x, y)) return false;
    const typeIdx = this.cellIndexById.get(cellTypeId);
    if (typeIdx === undefined) return false;

    const flatIdx = y * this.width + x;
    const def = this.cellTypeByIndex[typeIdx];
    this.currentGrid[flatIdx] = typeIdx;
    this.cellStates[flatIdx] = this.createCellInitialState(def);
    return true;
  }

  public findCells(
    predicate: (cell: WorldCellSnapshot) => boolean
  ): WorldCellSnapshot[] {
    const matches: WorldCellSnapshot[] = [];
    const w = this.width;
    const total = this.currentGrid.length;
    for (let i = 0; i < total; i++) {
      const x = i % w;
      const y = (i - x) / w;
      const snap: WorldCellSnapshot = {
        x,
        y,
        cellTypeId: this.cellTypeByIndex[this.currentGrid[i]].id,
        state: this.cellStates[i] ? { ...this.cellStates[i]! } : {},
      };
      if (predicate(snap)) {
        matches.push(snap);
      }
    }
    return matches;
  }

  public getWorldApi(): WorldApi {
    return {
      width: this.width,
      height: this.height,
      cycle: this.cycleCount,
      manifest: this.manifest,
      getResource: (id) => this.getResource(id),
      getResourceCap: (id) => this.getResourceCap(id),
      getResources: () => this.getResources(),
      getResourceCaps: () => this.getResourceCaps(),
      addResource: (id, delta) => this.addResource(id, delta),
      consumeResource: (id, amount) => this.consumeResource(id, amount),
      getCellTypeIdAt: (x, y) => this.getCellTypeAt(x, y).id,
      getCellStateAt: (x, y) => this.getCellStateAt(x, y),
      patchCellState: (x, y, patch) => this.patchCellState(x, y, patch),
      getLocalSupplies: (x, y) => this.getLocalSupplies(x, y),
      clearNotificationsAt: (x, y) => this.clearNotificationsAt(x, y),
      reconcileResourceCaps: () => this.reconcileResourceCaps(),
      findCells: (pred) => this.findCells(pred),
    };
  }

  public generateNewMap(setup?: WorldSetupValues): void {
    this.currentGrid.fill(this.defaultCellIndex);
    this.cellStates.fill(null);
    this.notifications = [];
    this.cycleCount = 0;

    for (const buffer of this.supplyBuffers.values()) {
      buffer.fill(0);
    }

    for (const res of this.manifest.resources) {
      this.resources[res.id] = res.initialValue;
    }

    const mutator: GridMutator = {
      width: this.width,
      height: this.height,
      clear: () => {
        this.currentGrid.fill(this.defaultCellIndex);
        this.cellStates.fill(null);
      },
      getCell: (x, y) => {
        if (!this.inBounds(x, y)) return this.manifest.defaultCellTypeId;
        return this.getCellTypeAt(x, y).id;
      },
      setCell: (x, y, cellTypeId) => {
        this.setCell(x, y, cellTypeId);
      },
    };

    const resolvedSetup: WorldSetupValues = setup ?? {
      width: this.width,
      height: this.height,
      seed: this.seed,
      params: {},
    };
    const rng = createSeededRng(resolvedSetup.seed);
    this.compiled.generator.fn(
      mutator,
      resolvedSetup,
      this.compiled.generator.params,
      rng
    );
  }

  public canAfford(cellTypeId: CellTypeId): AffordabilityCheck {
    const def = this.getCellTypeById(cellTypeId);
    if (!def || !def.buildCost) {
      return { ok: true, missing: [] };
    }

    const missing: AffordabilityCheck['missing'] = [];
    for (const [resId, cost] of Object.entries(def.buildCost)) {
      if (cost <= 0) continue;
      const have = this.resources[resId] ?? 0;
      if (have < cost) {
        const resDef = this.manifest.resources.find((r) => r.id === resId);
        missing.push({
          resourceId: resId,
          resourceName: resDef?.name ?? resId,
          need: cost,
          have,
        });
      }
    }

    return { ok: missing.length === 0, missing };
  }

  private applyResourceDelta(
    delta: ResourceDelta | undefined,
    caps?: Record<ResourceId, number | null>
  ): void {
    if (!delta) return;
    const effectiveCaps = caps ?? this.getResourceCaps();
    for (const [resId, amount] of Object.entries(delta)) {
      if (!amount) continue;
      let next = (this.resources[resId] ?? 0) + amount;
      const cap = effectiveCaps[resId];
      if (cap !== null && cap !== undefined && next > cap) {
        next = cap;
      }
      this.resources[resId] = next;
    }
  }

  public buildCell(
    x: number,
    y: number,
    cellTypeId: CellTypeId
  ): { ok: boolean; reason?: string } {
    if (!this.inBounds(x, y)) return { ok: false, reason: t('core.outOfBounds') };
    const def = this.getCellTypeById(cellTypeId);
    if (!def) return { ok: false, reason: t('core.unknownCell') };

    const check = this.canAfford(cellTypeId);
    if (!check.ok) {
      return {
        ok: false,
        reason: t('core.insufficient', {
          list: check.missing.map((m) => m.resourceName).join(', '),
        }),
      };
    }

    if (def.buildCost) {
      for (const [resId, cost] of Object.entries(def.buildCost)) {
        this.resources[resId] = (this.resources[resId] ?? 0) - cost;
      }
    }

    this.setCell(x, y, cellTypeId);
    this.applyResourceDelta(def.onBuildEffect);

    if (def.behavior?.module.onBuild) {
      def.behavior.module.onBuild(
        {
          x,
          y,
          cellType: def,
          state: this.getCellStateAt(x, y),
          world: this.getWorldApi(),
        },
        def.behavior.params
      );
    }

    return { ok: true };
  }

  public demolishCell(
    x: number,
    y: number
  ): { ok: boolean; delta: ResourceDelta } {
    if (!this.inBounds(x, y)) {
      return { ok: false, delta: {} };
    }
    const current = this.getCellTypeAt(x, y);
    if (
      !current.onDemolishEffect &&
      !current.behavior?.module.onDemolish &&
      current.onClick.right.kind !== 'openDemolishConfirm'
    ) {
      return { ok: false, delta: {} };
    }

    const prevState = this.getCellStateAt(x, y);
    const delta = { ...(current.onDemolishEffect ?? {}) };
    const targetCellId = current.demolishTo ?? this.manifest.defaultCellTypeId;

    this.setCell(x, y, targetCellId);

    if (current.behavior?.module.onDemolish) {
      current.behavior.module.onDemolish(
        {
          x,
          y,
          cellType: current,
          state: prevState,
          world: this.getWorldApi(),
        },
        current.behavior.params
      );
    }

    this.reconcileResourceCaps();
    this.applyResourceDelta(delta);
    this.clearNotificationsAt(x, y);

    return { ok: true, delta };
  }

  public getDemolishInfo(x: number, y: number): DemolishInfo {
    if (!this.inBounds(x, y)) return {};
    const cellType = this.getCellTypeAt(x, y);
    if (!cellType.behavior?.module.getDemolishInfo) return {};

    return cellType.behavior.module.getDemolishInfo(
      {
        x,
        y,
        cellType,
        state: this.getCellStateAt(x, y),
        supplies: this.getLocalSupplies(x, y),
        resources: this.getResources(),
        resourceCaps: this.getResourceCaps(),
        manifest: this.manifest,
      },
      cellType.behavior.params
    );
  }

  private applyEmission(
    x: number,
    y: number,
    emission: SupplyEmission,
    producedTotals?: Record<SupplyId, number>
  ): void {
    const buffer = this.supplyBuffers.get(emission.supplyId);
    const def = this.supplyDefsById.get(emission.supplyId);
    if (!buffer || !def) return;

    const w = this.width;
    const h = this.height;
    const isToroidal = this.boundaryMode === 'toroidal';
    const r = emission.radius;
    const amount = emission.amount;
    const maxCap = def.maxAmount;

    const deposit = (idx: number) => {
      const prev = buffer[idx];
      const next =
        maxCap !== undefined ? Math.min(maxCap, prev + amount) : prev + amount;
      buffer[idx] = next;
      if (producedTotals && next > prev) {
        producedTotals[emission.supplyId] =
          (producedTotals[emission.supplyId] ?? 0) + (next - prev);
      }
    };

    if (emission.neighborhood === 'self') {
      deposit(y * w + x);
      return;
    }

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!emission.includeSelf && dx === 0 && dy === 0) continue;
        if (
          emission.neighborhood === 'vonNeumann' &&
          Math.abs(dx) + Math.abs(dy) > r
        ) {
          continue;
        }

        let tx = x + dx;
        let ty = y + dy;

        if (isToroidal) {
          tx = ((tx % w) + w) % w;
          ty = ((ty % h) + h) % h;
        } else if (tx < 0 || tx >= w || ty < 0 || ty >= h) {
          continue;
        }

        deposit(ty * w + tx);
      }
    }
  }

  private getPrioritizedNonDefaultIndices(): number[] {
    const indices: number[] = [];
    const total = this.currentGrid.length;
    for (let i = 0; i < total; i++) {
      if (this.currentGrid[i] !== this.defaultCellIndex) {
        indices.push(i);
      }
    }

    indices.sort((a, b) => {
      const defA = this.cellTypeByIndex[this.currentGrid[a]];
      const defB = this.cellTypeByIndex[this.currentGrid[b]];
      const prioA = defA.behavior?.module.getConsumePriority
        ? defA.behavior.module.getConsumePriority(
            this.cellStates[a] ?? {},
            defA.behavior.params
          )
        : 0;
      const prioB = defB.behavior?.module.getConsumePriority
        ? defB.behavior.module.getConsumePriority(
            this.cellStates[b] ?? {},
            defB.behavior.params
          )
        : 0;
      if (prioB !== prioA) return prioB - prioA;
      return a - b;
    });

    return indices;
  }

  private fillLocalSupplies(
    flatIdx: number,
    supplyEntries: [SupplyId, Int16Array][],
    out: Record<SupplyId, number>
  ): void {
    for (let s = 0; s < supplyEntries.length; s++) {
      out[supplyEntries[s][0]] = supplyEntries[s][1][flatIdx];
    }
  }

  private evaluateCellTick(
    x: number,
    y: number,
    cellType: ResolvedCellType,
    state: CellStateData,
    localSupplies: Record<SupplyId, number>,
    availableResources: Record<ResourceId, number>,
    resourceCaps: Record<ResourceId, number | null>
  ) {
    if (!cellType.behavior?.module.onCycle) {
      return {
        nextTypeId: cellType.id,
        canEmit: cellType.emissions.length > 0,
      };
    }
    return cellType.behavior.module.onCycle(
      {
        x,
        y,
        cellType,
        state,
        supplies: localSupplies,
        resources: availableResources,
        resourceCaps,
        manifest: this.manifest,
      },
      cellType.behavior.params
    );
  }

  public step(): StepResult {
    const w = this.width;
    const h = this.height;
    const total = w * h;
    const supplyEntries = Array.from(this.supplyBuffers.entries());
    const localSupplies: Record<SupplyId, number> = {};

    const producedResourcesDelta: ResourceDelta = {};
    const consumedResourcesDelta: ResourceDelta = {};
    const consumedTotals: Record<SupplyId, number> = {};
    const producedTotals: Record<SupplyId, number> = {};
    const nextNotifications: CellNotification[] = [];
    const lostCells: {
      x: number;
      y: number;
      cellType: ResolvedCellType;
      state: CellStateData;
    }[] = [];

    for (const supply of this.manifest.supplies) {
      consumedTotals[supply.id] = 0;
      producedTotals[supply.id] = 0;
    }

    this.emitFlags.fill(0);
    this.nextGrid.fill(this.defaultCellIndex);
    this.nextCellStates.fill(null);

    const nextCycleNumber = this.cycleCount + 1;
    const availableResources: Record<ResourceId, number> = {
      ...this.resources,
    };
    const initialCaps = this.getResourceCaps();

    // ------------------------------------------------------------------
    // PHASE 1: Consume, React & Transition
    // ------------------------------------------------------------------
    const evalIndices = this.getPrioritizedNonDefaultIndices();
    const evaluatedFlags = new Uint8Array(total);

    for (let k = 0; k < evalIndices.length; k++) {
      const i = evalIndices[k];
      evaluatedFlags[i] = 1;
      const x = i % w;
      const y = (i - x) / w;

      this.fillLocalSupplies(i, supplyEntries, localSupplies);

      const currentType = this.cellTypeByIndex[this.currentGrid[i]];
      const currentState = this.cellStates[i] ?? {};
      const outcome = this.evaluateCellTick(
        x,
        y,
        currentType,
        currentState,
        localSupplies,
        availableResources,
        initialCaps
      );

      if (outcome.consumed) {
        for (const [supplyId, reqAmount] of Object.entries(outcome.consumed)) {
          if (reqAmount <= 0) continue;
          const buf = this.supplyBuffers.get(supplyId);
          if (!buf) continue;
          const actual = Math.min(buf[i], reqAmount);
          if (actual > 0) {
            buf[i] -= actual;
            consumedTotals[supplyId] =
              (consumedTotals[supplyId] ?? 0) + actual;
          }
        }
      }

      if (outcome.consumedResources) {
        for (const [resId, reqAmount] of Object.entries(
          outcome.consumedResources
        )) {
          if (reqAmount <= 0) continue;
          const currentAvail = availableResources[resId] ?? 0;
          const actual = Math.min(currentAvail, reqAmount);
          if (actual > 0) {
            availableResources[resId] = currentAvail - actual;
            consumedResourcesDelta[resId] =
              (consumedResourcesDelta[resId] ?? 0) + actual;
          }
        }
      }

      const nextIdx = this.cellIndexById.get(outcome.nextTypeId);
      const resolvedNextIdx =
        nextIdx !== undefined ? nextIdx : this.currentGrid[i];
      this.nextGrid[i] = resolvedNextIdx;

      if (resolvedNextIdx !== this.currentGrid[i]) {
        this.emitFlags[i] = 0;
        const nextDef = this.cellTypeByIndex[resolvedNextIdx];
        this.nextCellStates[i] = this.createCellInitialState(nextDef);
        lostCells.push({
          x,
          y,
          cellType: currentType,
          state: { ...currentState },
        });
      } else {
        if (outcome.nextState !== undefined) {
          this.nextCellStates[i] = outcome.nextState
            ? { ...outcome.nextState }
            : null;
        } else {
          this.nextCellStates[i] = this.cellStates[i]
            ? { ...this.cellStates[i] }
            : null;
        }

        if (outcome.canEmit) {
          this.emitFlags[i] = 1;
        }

        addDelta(producedResourcesDelta, outcome.producedResources);
      }

      if (outcome.notification) {
        nextNotifications.push({
          id: `notif-${nextCycleNumber}-${x}-${y}-${currentType.id}`,
          x,
          y,
          cellTypeId: currentType.id,
          cycle: nextCycleNumber,
          ...outcome.notification,
        });
      }
    }

    // Evaluate default (empty) cells only if default type has an onCycle behavior
    const defaultDef = this.cellTypeByIndex[this.defaultCellIndex];
    if (defaultDef.behavior?.module.onCycle) {
      for (let i = 0; i < total; i++) {
        if (evaluatedFlags[i] === 1) continue;
        const x = i % w;
        const y = (i - x) / w;
        this.fillLocalSupplies(i, supplyEntries, localSupplies);
        const outcome = this.evaluateCellTick(
          x,
          y,
          defaultDef,
          {},
          localSupplies,
          availableResources,
          initialCaps
        );
        const nextIdx = this.cellIndexById.get(outcome.nextTypeId);
        if (nextIdx !== undefined && nextIdx !== this.defaultCellIndex) {
          this.nextGrid[i] = nextIdx;
          const nextDef = this.cellTypeByIndex[nextIdx];
          this.nextCellStates[i] = this.createCellInitialState(nextDef);
        }
      }
    }

    // Swap grids first so caps reflect surviving cells
    const prevGrid = this.currentGrid;
    this.currentGrid = this.nextGrid;
    this.nextGrid = prevGrid;

    const prevStates = this.cellStates;
    this.cellStates = this.nextCellStates;
    this.nextCellStates = prevStates;

    for (const [resId, used] of Object.entries(consumedResourcesDelta)) {
      if (used) {
        this.resources[resId] = (this.resources[resId] ?? 0) - used;
      }
    }

    // Invoke modular onTickLost hooks (e.g. House population reclamation)
    if (lostCells.length > 0) {
      const world = this.getWorldApi();
      for (const lost of lostCells) {
        if (lost.cellType.behavior?.module.onTickLost) {
          lost.cellType.behavior.module.onTickLost(
            {
              x: lost.x,
              y: lost.y,
              cellType: lost.cellType,
              state: lost.state,
              world,
            },
            lost.cellType.behavior.params
          );
        }
      }
    }

    this.reconcileResourceCaps();

    // ------------------------------------------------------------------
    // PHASE 2: Decay unconsumed supply remainders & optional decaying resources
    // ------------------------------------------------------------------
    for (const [supplyId, buffer] of this.supplyBuffers.entries()) {
      const def = this.supplyDefsById.get(supplyId);
      if (!def) continue;
      const rule = def.decay;
      for (let i = 0; i < total; i++) {
        const val = buffer[i];
        if (val <= 0) continue;
        buffer[i] = applyDecayRule(val, rule);
      }
    }

    for (const res of this.manifest.resources) {
      if (!res.decay) continue;
      const currentVal = this.resources[res.id] ?? 0;
      if (currentVal > 0) {
        this.resources[res.id] = applyDecayRule(currentVal, res.decay);
      }
    }

    // ------------------------------------------------------------------
    // PHASE 3: Produce fresh spatial supplies & next-cycle global resources
    // ------------------------------------------------------------------
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        const idx = rowOffset + x;
        if (this.emitFlags[idx] === 0) continue;

        const cellType = this.cellTypeByIndex[this.currentGrid[idx]];
        const emissions = cellType.emissions;
        for (let e = 0; e < emissions.length; e++) {
          this.applyEmission(x, y, emissions[e], producedTotals);
        }
      }
    }

    this.applyResourceDelta(producedResourcesDelta, this.getResourceCaps());

    this.cycleCount = nextCycleNumber;
    this.notifications = nextNotifications;

    return {
      cycle: this.cycleCount,
      producedResourcesDelta,
      consumedResourcesDelta,
      lostCellsCount: lostCells.length,
      consumedTotals,
      producedTotals,
      notifications: [...this.notifications],
    };
  }

  public handleCellClick(
    x: number,
    y: number,
    button: MouseButton
  ): CellClickAction {
    if (!this.inBounds(x, y)) return { kind: 'none' };
    const cellType = this.getCellTypeAt(x, y);
    const action =
      button === 'left'
        ? cellType.onClick.left
        : button === 'right'
          ? cellType.onClick.right
          : { kind: 'none' as const };

    if (action.kind === 'setCell') {
      this.setCell(x, y, action.cellTypeId);
    }

    return action;
  }

  public getEmissionPreviewCoords(
    x: number,
    y: number,
    cellTypeId: CellTypeId
  ): GridCoordinate[] {
    if (!this.inBounds(x, y)) return [];
    const cellType = this.getCellTypeById(cellTypeId);
    if (!cellType || cellType.emissions.length === 0) return [];

    const seen = new Set<number>();
    const coords: GridCoordinate[] = [];

    for (const emission of cellType.emissions) {
      const r = emission.radius;
      if (emission.neighborhood === 'self') {
        const key = y * this.width + x;
        if (!seen.has(key)) {
          seen.add(key);
          coords.push({ x, y });
        }
        continue;
      }

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (!emission.includeSelf && dx === 0 && dy === 0) continue;
          if (
            emission.neighborhood === 'vonNeumann' &&
            Math.abs(dx) + Math.abs(dy) > r
          ) {
            continue;
          }
          const resolved = this.resolveCoordinate(x + dx, y + dy);
          if (!resolved) continue;
          const key = resolved.y * this.width + resolved.x;
          if (!seen.has(key)) {
            seen.add(key);
            coords.push(resolved);
          }
        }
      }
    }

    return coords;
  }

  public isCellActiveAt(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    const cellType = this.getCellTypeAt(x, y);
    if (!cellType.behavior?.module.isActive) return true;
    return cellType.behavior.module.isActive(
      {
        x,
        y,
        cellType,
        state: this.getCellStateAt(x, y),
        supplies: this.getLocalSupplies(x, y),
        resources: this.getResources(),
        resourceCaps: this.getResourceCaps(),
        manifest: this.manifest,
      },
      cellType.behavior.params
    );
  }

  private getProjectedResourcesForCell(
    targetFlatIdx: number,
    resourceCaps: Record<ResourceId, number | null>
  ): Record<ResourceId, number> {
    const simResources: Record<ResourceId, number> = { ...this.resources };
    if (this.currentGrid[targetFlatIdx] === this.defaultCellIndex) {
      return simResources;
    }

    const supplyEntries = Array.from(this.supplyBuffers.entries());
    const localSupplies: Record<SupplyId, number> = {};
    const evalIndices = this.getPrioritizedNonDefaultIndices();
    const w = this.width;

    for (let k = 0; k < evalIndices.length; k++) {
      const i = evalIndices[k];
      if (i === targetFlatIdx) break;

      const x = i % w;
      const y = (i - x) / w;
      this.fillLocalSupplies(i, supplyEntries, localSupplies);
      const cellType = this.cellTypeByIndex[this.currentGrid[i]];
      const outcome = this.evaluateCellTick(
        x,
        y,
        cellType,
        this.cellStates[i] ?? {},
        localSupplies,
        simResources,
        resourceCaps
      );

      if (outcome.consumedResources) {
        for (const [resId, req] of Object.entries(outcome.consumedResources)) {
          if (req <= 0) continue;
          const avail = simResources[resId] ?? 0;
          simResources[resId] = Math.max(0, avail - Math.min(avail, req));
        }
      }
    }

    return simResources;
  }

  public inspectCell(x: number, y: number): CellInspection | null {
    if (!this.inBounds(x, y)) return null;
    const flatIdx = y * this.width + x;
    const cellType = this.getCellTypeAt(x, y);
    const state = this.getCellStateAt(x, y);
    const supplies = this.getLocalSupplies(x, y);
    const resourceCaps = this.getResourceCaps();
    const availResources = this.getProjectedResourcesForCell(
      flatIdx,
      resourceCaps
    );

    const statusBadge = cellType.behavior?.module.getStatusBadge
      ? cellType.behavior.module.getStatusBadge(
          {
            x,
            y,
            cellType,
            state,
            supplies,
            resources: this.getResources(),
            resourceCaps,
            manifest: this.manifest,
          },
          cellType.behavior.params
        )
      : null;

    if (cellType.behavior?.module.explainCycle) {
      const explanation = cellType.behavior.module.explainCycle(
        {
          x,
          y,
          cellType,
          state,
          supplies,
          resources: availResources,
          resourceCaps,
          manifest: this.manifest,
        },
        cellType.behavior.params
      );
      const nextCellType =
        this.getCellTypeById(explanation.nextTypeId) ?? cellType;
      return {
        x,
        y,
        cellType,
        state,
        supplies,
        nextCellType,
        willChange: nextCellType.id !== cellType.id,
        transitionLabel: explanation.label,
        transitionTone: explanation.tone,
        statusBadge,
      };
    }

    const outcome = this.evaluateCellTick(
      x,
      y,
      cellType,
      state,
      supplies,
      availResources,
      resourceCaps
    );
    const nextCellType = this.getCellTypeById(outcome.nextTypeId) ?? cellType;
    const willChange = nextCellType.id !== cellType.id;

    return {
      x,
      y,
      cellType,
      state,
      supplies,
      nextCellType,
      willChange,
      transitionLabel: willChange
        ? t('core.transitionTo', { name: nextCellType.name })
        : cellType.shortRule || '',
      transitionTone: willChange ? 'positive' : 'neutral',
      statusBadge,
    };
  }

  public getStats(): SimulationStats {
    const counts: Record<CellTypeId, number> = {};
    for (const def of this.cellTypeByIndex) {
      counts[def.id] = 0;
    }

    const projectedBreakdown: Record<ResourceId, ResourceProjectionBreakdown> =
      {};
    const projectedDelta: ResourceDelta = {};
    for (const res of this.manifest.resources) {
      projectedBreakdown[res.id] = { gained: 0, consumed: 0, net: 0 };
      projectedDelta[res.id] = 0;
    }

    const total = this.currentGrid.length;
    for (let i = 0; i < total; i++) {
      const cellType = this.cellTypeByIndex[this.currentGrid[i]];
      counts[cellType.id] += 1;
    }

    const supplyEntries = Array.from(this.supplyBuffers.entries());
    const localSupplies: Record<SupplyId, number> = {};
    const simResources: Record<ResourceId, number> = { ...this.resources };
    const resourceCaps = this.getResourceCaps();
    const evalIndices = this.getPrioritizedNonDefaultIndices();
    const w = this.width;
    let atRiskCount = 0;

    for (let k = 0; k < evalIndices.length; k++) {
      const i = evalIndices[k];
      const x = i % w;
      const y = (i - x) / w;
      const cellType = this.cellTypeByIndex[this.currentGrid[i]];
      this.fillLocalSupplies(i, supplyEntries, localSupplies);

      const state = this.cellStates[i] ?? {};
      const outcome = this.evaluateCellTick(
        x,
        y,
        cellType,
        state,
        localSupplies,
        simResources,
        resourceCaps
      );

      if (outcome.consumedResources) {
        for (const [resId, req] of Object.entries(outcome.consumedResources)) {
          if (req <= 0) continue;
          const avail = simResources[resId] ?? 0;
          const actual = Math.min(avail, req);
          if (actual > 0) {
            simResources[resId] = avail - actual;
            if (projectedBreakdown[resId]) {
              projectedBreakdown[resId].consumed += actual;
            }
          }
        }
      }

      if (outcome.nextTypeId === cellType.id && outcome.producedResources) {
        for (const [resId, amount] of Object.entries(
          outcome.producedResources
        )) {
          if (!amount || !projectedBreakdown[resId]) continue;
          if (amount > 0) projectedBreakdown[resId].gained += amount;
          else projectedBreakdown[resId].consumed += Math.abs(amount);
        }
      }

      if (outcome.nextTypeId !== cellType.id) {
        atRiskCount += 1;
      }
    }

    for (const res of this.manifest.resources) {
      const b = projectedBreakdown[res.id];
      b.net = b.gained - b.consumed;
      projectedDelta[res.id] = b.net;
    }

    return {
      cycle: this.cycleCount,
      counts,
      totalCells: total,
      resources: { ...this.resources },
      resourceCaps: this.getResourceCaps(),
      projectedDelta,
      projectedBreakdown,
      atRiskCount,
    };
  }
}
