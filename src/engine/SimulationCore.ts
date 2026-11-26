import { t } from '../i18n';
import {
  Action,
  AffordabilityCheck,
  CellInspection,
  CellNotification,
  CellStateData,
  CellTypeId,
  CellTypeManifest,
  ClickExecutionResult,
  DemolishInfo,
  GridCoordinate,
  GridMutator,
  MouseButton,
  MutableRuleWorld,
  ResourceDelta,
  ResourceId,
  ResourceProjectionBreakdown,
  ResolvedVisualState,
  RuleEvalContext,
  RulesetManifest,
  SerializedSimulationState,
  SimulationStats,
  StatusBadge,
  StepResult,
  SupplyEmission,
  SupplyId,
  SupplyManifest,
  WorldSetupValues,
  applyDecayRule,
  createSeededRng,
  deriveBuildPreview,
  deriveCycleExplanation,
  deriveDemolishInfo,
  evaluateCycleRules,
  executeWorldRules,
  extractStaticEmissions,
  generateRandomSeed,
  resolveCellBadge,
  resolveCellVisual,
  runWorldGeneratorPipeline,
} from './sdk';

function addDelta(target: ResourceDelta, delta: ResourceDelta | undefined): void {
  if (!delta) return;
  for (const [resId, amount] of Object.entries(delta)) {
    if (!amount) continue;
    target[resId] = (target[resId] ?? 0) + amount;
  }
}

/**
 * Pure Ruleset-Agnostic Cellular Strategy Engine Core (Schema v2).
 *
 * Bounded grid, strictly 'unlimited' | 'capped' global resources, and a
 * declarative Rule/Condition/Action interpreter powering cell logic, clicks,
 * passive modifiers, visual overlays, panels, and world generation.
 *
 * 3-Phase Buffer Cycle Pipeline:
 *   Phase 1 — Consume, React & Transition
 *   Phase 2 — Decay (spatial supplies & optional decaying global resources)
 *   Phase 3 — Produce (spatial emissions & next-cycle global resources)
 */
export class SimulationCore {
  public readonly manifest: RulesetManifest;
  public readonly width: number;
  public readonly height: number;
  public readonly seed: string;

  private currentGrid: Uint8Array;
  private nextGrid: Uint8Array;
  private cellStates: (CellStateData | null)[];
  private nextCellStates: (CellStateData | null)[];
  private pendingEmissions: SupplyEmission[][];
  private supplyBuffers: Map<SupplyId, Int16Array>;
  private supplyDefsById: Map<SupplyId, SupplyManifest>;
  private cellTypeByIndex: CellTypeManifest[];
  private cellIndexById: Map<CellTypeId, number>;
  private defaultCellIndex: number;
  private resources: Record<ResourceId, number>;
  private notifications: CellNotification[] = [];
  private cycleCount = 0;

  constructor(
    manifest: RulesetManifest,
    width?: number,
    height?: number,
    seed?: string
  ) {
    this.manifest = manifest;
    this.width = width ?? manifest.defaultGridSize.width;
    this.height = height ?? manifest.defaultGridSize.height;
    this.seed = seed?.trim() || generateRandomSeed();

    this.cellTypeByIndex = [...manifest.cellTypes];
    this.cellIndexById = new Map();
    this.cellTypeByIndex.forEach((def, idx) => {
      this.cellIndexById.set(def.id, idx);
    });

    const defIdx = this.cellIndexById.get(manifest.defaultCellTypeId);
    if (defIdx === undefined) {
      throw new Error(
        `Unknown defaultCellTypeId: ${manifest.defaultCellTypeId}`
      );
    }
    this.defaultCellIndex = defIdx;

    const total = this.width * this.height;
    this.currentGrid = new Uint8Array(total);
    this.nextGrid = new Uint8Array(total);
    this.cellStates = new Array(total).fill(null);
    this.nextCellStates = new Array(total).fill(null);
    this.pendingEmissions = new Array(total);
    this.currentGrid.fill(this.defaultCellIndex);

    this.resources = {};
    for (const res of manifest.resources) {
      this.resources[res.id] = res.initialValue;
    }

    this.supplyBuffers = new Map();
    this.supplyDefsById = new Map();
    for (const supply of manifest.supplies) {
      this.supplyBuffers.set(supply.id, new Int16Array(total));
      this.supplyDefsById.set(supply.id, supply);
    }
  }

  public static createNewGame(
    manifest: RulesetManifest,
    setup?: Partial<WorldSetupValues>
  ): SimulationCore {
    const width = setup?.width ?? manifest.defaultGridSize.width;
    const height = setup?.height ?? manifest.defaultGridSize.height;
    const seed = setup?.seed?.trim() || generateRandomSeed();

    const defaultParams: Record<string, string | number | boolean> = {};
    for (const param of manifest.setupOptions?.params ?? []) {
      defaultParams[param.id] = param.defaultValue;
    }
    const mergedParams = { ...defaultParams, ...(setup?.params ?? {}) };

    const core = new SimulationCore(manifest, width, height, seed);
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
    manifest: RulesetManifest,
    snapshot: SerializedSimulationState
  ): SimulationCore {
    const core = new SimulationCore(manifest, snapshot.width, snapshot.height);
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

    for (const res of manifest.resources) {
      const savedVal = snapshot.resources[res.id];
      core.resources[res.id] =
        typeof savedVal === 'number' ? savedVal : res.initialValue;
    }

    for (const supply of manifest.supplies) {
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

  private createCellInitialState(def: CellTypeManifest): CellStateData | null {
    return def.initialState ? { ...def.initialState } : null;
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
      if (!def.modifiers || def.modifiers.length === 0) continue;
      const st = this.cellStates[i];

      for (const mod of def.modifiers) {
        if (mod.type !== 'capBonus' || !mod.amount) continue;
        const resId =
          mod.resource ??
          (mod.resourceFromState
            ? String(st?.[mod.resourceFromState] ?? '')
            : '');
        if (!resId) continue;
        if (caps[resId] !== null && caps[resId] !== undefined) {
          caps[resId] = (caps[resId] as number) + mod.amount;
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

  public getCellTypeAt(x: number, y: number): CellTypeManifest {
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

  public getCellTypeById(id: CellTypeId): CellTypeManifest | undefined {
    const idx = this.cellIndexById.get(id);
    return idx !== undefined ? this.cellTypeByIndex[idx] : undefined;
  }

  public getCellIndexBuffer(): Uint8Array {
    return this.currentGrid;
  }

  public getCellTypes(): readonly CellTypeManifest[] {
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

  public countNeighbors(
    x: number,
    y: number,
    cellTypeId: CellTypeId,
    radius = 1,
    neighborhood: 'moore' | 'vonNeumann' = 'moore'
  ): number {
    const targetIdx = this.cellIndexById.get(cellTypeId);
    if (targetIdx === undefined) return 0;
    let count = 0;
    const w = this.width;
    const h = this.height;

    for (let dy = -radius; dy <= radius; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (neighborhood === 'vonNeumann' && Math.abs(dx) + Math.abs(dy) > radius) {
          continue;
        }
        const nx = x + dx;
        if (nx < 0 || nx >= w) continue;
        if (this.currentGrid[ny * w + nx] === targetIdx) {
          count++;
        }
      }
    }
    return count;
  }

  private reclaimFromCells(stateKey: string, amount: number): void {
    let remaining = Math.max(0, Math.floor(amount));
    if (remaining === 0) return;

    for (let i = this.currentGrid.length - 1; i >= 0 && remaining > 0; i--) {
      const st = this.cellStates[i];
      if (!st) continue;
      const cur = Number(st[stateKey] ?? 0);
      if (cur <= 0) continue;
      const take = Math.min(cur, remaining);
      st[stateKey] = cur - take;
      remaining -= take;
    }
  }

  private createMutableWorld(): MutableRuleWorld {
    return {
      getResource: (id) => this.getResource(id),
      addResource: (id, delta) => this.addResource(id, delta),
      consumeResource: (id, amount) => this.consumeResource(id, amount),
      setCell: (x, y, cellTypeId) => this.setCell(x, y, cellTypeId),
      getCellStateAt: (x, y) => this.getCellStateAt(x, y),
      patchCellState: (x, y, patch) => this.patchCellState(x, y, patch),
      reclaimFromCells: (stateKey, amount) =>
        this.reclaimFromCells(stateKey, amount),
      reconcileResourceCaps: () => this.reconcileResourceCaps(),
    };
  }

  public createEvalContext(
    x: number,
    y: number,
    overrides?: Partial<RuleEvalContext>
  ): RuleEvalContext {
    const cellType = overrides?.cellType ?? this.getCellTypeAt(x, y);
    return {
      x,
      y,
      cycle: this.cycleCount,
      seed: this.seed,
      cellType,
      state: overrides?.state ?? this.getCellStateAt(x, y),
      supplies: overrides?.supplies ?? this.getLocalSupplies(x, y),
      resources: overrides?.resources ?? this.getResources(),
      resourceCaps: overrides?.resourceCaps ?? this.getResourceCaps(),
      manifest: this.manifest,
      countNeighbors: (cx, cy, cid, r, nb) =>
        this.countNeighbors(cx, cy, cid, r, nb),
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
      defaultCellTypeId: this.manifest.defaultCellTypeId,
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
    runWorldGeneratorPipeline(
      this.manifest.worldGenerator,
      mutator,
      resolvedSetup,
      rng
    );
  }

  public canAffordCost(cost: ResourceDelta | undefined): AffordabilityCheck {
    if (!cost) return { ok: true, missing: [] };

    const missing: AffordabilityCheck['missing'] = [];
    for (const [resId, need] of Object.entries(cost)) {
      if (need <= 0) continue;
      const have = this.resources[resId] ?? 0;
      if (have < need) {
        const resDef = this.manifest.resources.find((r) => r.id === resId);
        missing.push({
          resourceId: resId,
          resourceName: resDef?.name ?? resId,
          need,
          have,
        });
      }
    }

    return { ok: missing.length === 0, missing };
  }

  public canAfford(cellTypeId: CellTypeId): AffordabilityCheck {
    const def = this.getCellTypeById(cellTypeId);
    return this.canAffordCost(def?.buildCost);
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

    if (def.onBuild && def.onBuild.length > 0) {
      const ctx = this.createEvalContext(x, y, { cellType: def });
      executeWorldRules(def.onBuild, ctx, this.createMutableWorld());
    }

    this.reconcileResourceCaps();
    return { ok: true };
  }

  public demolishCell(x: number, y: number): { ok: boolean } {
    if (!this.inBounds(x, y)) return { ok: false };
    const current = this.getCellTypeAt(x, y);
    const hasDemolish =
      (current.onDemolish && current.onDemolish.length > 0) ||
      (current.onClick?.right ?? []).some((r) =>
        r.do.some((a) => a.type === 'openDemolishConfirm')
      );
    if (!hasDemolish) return { ok: false };

    const prevState = this.getCellStateAt(x, y);
    const targetCellId = current.demolishTo ?? this.manifest.defaultCellTypeId;
    const ctx = this.createEvalContext(x, y, {
      cellType: current,
      state: prevState,
    });

    this.setCell(x, y, targetCellId);

    if (current.onDemolish && current.onDemolish.length > 0) {
      executeWorldRules(current.onDemolish, ctx, this.createMutableWorld());
    }

    this.reconcileResourceCaps();
    this.clearNotificationsAt(x, y);
    return { ok: true };
  }

  public getDemolishInfo(x: number, y: number): DemolishInfo {
    if (!this.inBounds(x, y)) return { lines: [], warnings: [] };
    const cellType = this.getCellTypeAt(x, y);
    return deriveDemolishInfo(cellType, this.createEvalContext(x, y));
  }

  public getBuildPreview(
    x: number,
    y: number,
    cellTypeId: CellTypeId
  ): StatusBadge | null {
    if (!this.inBounds(x, y)) return null;
    const def = this.getCellTypeById(cellTypeId);
    if (!def) return null;
    return deriveBuildPreview(def, this.createEvalContext(x, y, { cellType: def }));
  }

  public resolveVisualAt(x: number, y: number): ResolvedVisualState {
    const cellType = this.getCellTypeAt(x, y);
    return resolveCellVisual(cellType, this.createEvalContext(x, y));
  }

  public transferPanelResource(
    x: number,
    y: number,
    resourceId: ResourceId,
    stateKey: string,
    delta: number,
    min: number,
    max: number,
    resetKeys?: string[],
    clearNotifications?: boolean
  ): boolean {
    if (!this.inBounds(x, y) || delta === 0) return false;
    const state = this.getCellStateAt(x, y);
    const cur = Number(state[stateKey] ?? 0);
    const next = cur + delta;
    if (next < min || next > max) return false;

    if (delta > 0) {
      if (!this.consumeResource(resourceId, delta)) return false;
    } else {
      this.addResource(resourceId, Math.abs(delta));
    }

    const patch: CellStateData = { [stateKey]: next };
    if (delta > 0 && resetKeys) {
      for (const k of resetKeys) {
        patch[k] = 0;
      }
    }
    this.patchCellState(x, y, patch);
    if (delta > 0 && clearNotifications) {
      this.clearNotificationsAt(x, y);
    }
    this.reconcileResourceCaps();
    return true;
  }

  public selectPanelResource(
    x: number,
    y: number,
    stateKey: string,
    resourceId: ResourceId
  ): boolean {
    if (!this.inBounds(x, y)) return false;
    this.patchCellState(x, y, { [stateKey]: resourceId });
    this.reconcileResourceCaps();
    return true;
  }

  public executePanelAction(
    x: number,
    y: number,
    cost: ResourceDelta | undefined,
    actions: readonly Action[]
  ): boolean {
    if (!this.inBounds(x, y)) return false;
    if (!this.canAffordCost(cost).ok) return false;

    if (cost) {
      for (const [resId, amt] of Object.entries(cost)) {
        if (amt > 0) {
          this.resources[resId] = (this.resources[resId] ?? 0) - amt;
        }
      }
    }

    const ctx = this.createEvalContext(x, y);
    executeWorldRules([{ do: [...actions] }], ctx, this.createMutableWorld());
    this.reconcileResourceCaps();
    return true;
  }

  private applyEmission(
    x: number,
    y: number,
    emission: SupplyEmission,
    producedTotals?: Record<SupplyId, number>
  ): void {
    const buffer = this.supplyBuffers.get(emission.id);
    const def = this.supplyDefsById.get(emission.id);
    if (!buffer || !def) return;

    const w = this.width;
    const h = this.height;
    const r = emission.radius;
    const amount = emission.amount;
    const maxCap = def.maxAmount;
    const includeSelf = emission.includeSelf ?? true;

    const deposit = (idx: number) => {
      const prev = buffer[idx];
      const next =
        maxCap !== undefined ? Math.min(maxCap, prev + amount) : prev + amount;
      buffer[idx] = next;
      if (producedTotals && next > prev) {
        producedTotals[emission.id] =
          (producedTotals[emission.id] ?? 0) + (next - prev);
      }
    };

    if (emission.neighborhood === 'self') {
      deposit(y * w + x);
      return;
    }

    for (let dy = -r; dy <= r; dy++) {
      const ty = y + dy;
      if (ty < 0 || ty >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (!includeSelf && dx === 0 && dy === 0) continue;
        if (
          emission.neighborhood === 'vonNeumann' &&
          Math.abs(dx) + Math.abs(dy) > r
        ) {
          continue;
        }
        const tx = x + dx;
        if (tx < 0 || tx >= w) continue;
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
      const prioA = defA.priorityByState
        ? Number(this.cellStates[a]?.[defA.priorityByState] ?? 0)
        : 0;
      const prioB = defB.priorityByState
        ? Number(this.cellStates[b]?.[defB.priorityByState] ?? 0)
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
      cellType: CellTypeManifest;
      state: CellStateData;
    }[] = [];

    for (const supply of this.manifest.supplies) {
      consumedTotals[supply.id] = 0;
      producedTotals[supply.id] = 0;
    }

    this.pendingEmissions.fill([]);
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
      const outcome = evaluateCycleRules(
        currentType,
        this.createEvalContext(x, y, {
          cellType: currentType,
          state: currentState,
          supplies: localSupplies,
          resources: availableResources,
          resourceCaps: initialCaps,
        })
      );

      for (const [supplyId, reqAmount] of Object.entries(
        outcome.consumedSupplies
      )) {
        if (reqAmount <= 0) continue;
        const buf = this.supplyBuffers.get(supplyId);
        if (!buf) continue;
        const actual = Math.min(buf[i], reqAmount);
        if (actual > 0) {
          buf[i] -= actual;
          consumedTotals[supplyId] = (consumedTotals[supplyId] ?? 0) + actual;
        }
      }

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

      const nextIdx = this.cellIndexById.get(outcome.nextTypeId);
      const resolvedNextIdx =
        nextIdx !== undefined ? nextIdx : this.currentGrid[i];
      this.nextGrid[i] = resolvedNextIdx;

      if (resolvedNextIdx !== this.currentGrid[i]) {
        this.pendingEmissions[i] = [];
        const nextDef = this.cellTypeByIndex[resolvedNextIdx];
        this.nextCellStates[i] = this.createCellInitialState(nextDef);
        lostCells.push({
          x,
          y,
          cellType: currentType,
          state: { ...currentState },
        });
      } else {
        this.nextCellStates[i] = outcome.nextState
          ? { ...outcome.nextState }
          : null;
        this.pendingEmissions[i] = outcome.emissions;
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

    // Evaluate default (empty) cells only if default type has onCycle rules
    const defaultDef = this.cellTypeByIndex[this.defaultCellIndex];
    if (defaultDef.onCycle && defaultDef.onCycle.length > 0) {
      for (let i = 0; i < total; i++) {
        if (evaluatedFlags[i] === 1) continue;
        const x = i % w;
        const y = (i - x) / w;
        this.fillLocalSupplies(i, supplyEntries, localSupplies);
        const outcome = evaluateCycleRules(
          defaultDef,
          this.createEvalContext(x, y, {
            cellType: defaultDef,
            state: {},
            supplies: localSupplies,
            resources: availableResources,
            resourceCaps: initialCaps,
          })
        );
        const nextIdx = this.cellIndexById.get(outcome.nextTypeId);
        if (nextIdx !== undefined && nextIdx !== this.defaultCellIndex) {
          this.nextGrid[i] = nextIdx;
          const nextDef = this.cellTypeByIndex[nextIdx];
          this.nextCellStates[i] = this.createCellInitialState(nextDef);
        } else if (outcome.emissions.length > 0) {
          this.pendingEmissions[i] = outcome.emissions;
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

    // Execute declarative onLost rules for cells transformed/removed during cycle
    if (lostCells.length > 0) {
      const world = this.createMutableWorld();
      for (const lost of lostCells) {
        if (lost.cellType.onLost && lost.cellType.onLost.length > 0) {
          executeWorldRules(
            lost.cellType.onLost,
            this.createEvalContext(lost.x, lost.y, {
              cellType: lost.cellType,
              state: lost.state,
            }),
            world
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
        const emissions = this.pendingEmissions[idx];
        if (!emissions || emissions.length === 0) continue;
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
  ): ClickExecutionResult {
    if (!this.inBounds(x, y)) return { uiAction: null, mutated: false };
    const cellType = this.getCellTypeAt(x, y);
    const rules =
      button === 'left'
        ? cellType.onClick?.left
        : button === 'right'
          ? cellType.onClick?.right
          : undefined;
    if (!rules || rules.length === 0) {
      return { uiAction: null, mutated: false };
    }
    const result = executeWorldRules(
      rules,
      this.createEvalContext(x, y),
      this.createMutableWorld()
    );
    if (result.mutated) {
      this.reconcileResourceCaps();
    }
    return result;
  }

  public getEmissionPreviewCoords(
    x: number,
    y: number,
    cellTypeId: CellTypeId
  ): GridCoordinate[] {
    if (!this.inBounds(x, y)) return [];
    const cellType = this.getCellTypeById(cellTypeId);
    if (!cellType) return [];
    const emissions = extractStaticEmissions(cellType);
    if (emissions.length === 0) return [];

    const seen = new Set<number>();
    const coords: GridCoordinate[] = [];

    for (const emission of emissions) {
      const r = emission.radius;
      const includeSelf = emission.includeSelf ?? true;
      if (emission.neighborhood === 'self') {
        const key = y * this.width + x;
        if (!seen.has(key)) {
          seen.add(key);
          coords.push({ x, y });
        }
        continue;
      }

      for (let dy = -r; dy <= r; dy++) {
        const ty = y + dy;
        if (ty < 0 || ty >= this.height) continue;
        for (let dx = -r; dx <= r; dx++) {
          if (!includeSelf && dx === 0 && dy === 0) continue;
          if (
            emission.neighborhood === 'vonNeumann' &&
            Math.abs(dx) + Math.abs(dy) > r
          ) {
            continue;
          }
          const tx = x + dx;
          if (tx < 0 || tx >= this.width) continue;
          const key = ty * this.width + tx;
          if (!seen.has(key)) {
            seen.add(key);
            coords.push({ x: tx, y: ty });
          }
        }
      }
    }

    return coords;
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
      const outcome = evaluateCycleRules(
        cellType,
        this.createEvalContext(x, y, {
          cellType,
          state: this.cellStates[i] ?? {},
          supplies: localSupplies,
          resources: simResources,
          resourceCaps,
        })
      );

      for (const [resId, req] of Object.entries(outcome.consumedResources)) {
        if (req <= 0) continue;
        const avail = simResources[resId] ?? 0;
        simResources[resId] = Math.max(0, avail - Math.min(avail, req));
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

    const badgeCtx = this.createEvalContext(x, y, {
      cellType,
      state,
      supplies,
      resourceCaps,
    });
    const statusBadge = resolveCellBadge(cellType, badgeCtx);

    const cycleCtx = this.createEvalContext(x, y, {
      cellType,
      state,
      supplies,
      resources: availResources,
      resourceCaps,
    });
    const outcome = evaluateCycleRules(cellType, cycleCtx);
    const nextCellType = this.getCellTypeById(outcome.nextTypeId) ?? cellType;
    const explanation = deriveCycleExplanation(cellType, cycleCtx, outcome);

    return {
      x,
      y,
      cellType,
      state,
      supplies,
      nextCellType,
      willChange: nextCellType.id !== cellType.id,
      transitionLabel: explanation.transitionLabel,
      transitionTone: explanation.transitionTone,
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

      const outcome = evaluateCycleRules(
        cellType,
        this.createEvalContext(x, y, {
          cellType,
          state: this.cellStates[i] ?? {},
          supplies: localSupplies,
          resources: simResources,
          resourceCaps,
        })
      );

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

      if (outcome.nextTypeId === cellType.id) {
        for (const [resId, amount] of Object.entries(outcome.producedResources)) {
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
