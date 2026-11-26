import {
  Action,
  CellModifier,
  CellTypeId,
  CellTypeManifest,
  Condition,
  GeneratorStep,
  PanelBlock,
  ResourceDelta,
  ResourceId,
  Rule,
  RulesetManifest,
  SupplyId,
} from './types';

export function slugifyId(raw: string, fallback = 'item'): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

export function makeUniqueId(base: string, existing: Iterable<string>): string {
  const set = new Set(existing);
  const root = slugifyId(base);
  if (!set.has(root)) return root;
  let i = 2;
  while (set.has(`${root}_${i}`)) i++;
  return `${root}_${i}`;
}

export function createBlankManifest(existingIds: Iterable<string> = []): RulesetManifest {
  const id = makeUniqueId('custom_ruleset', existingIds);
  return {
    schemaVersion: 2,
    id,
    name: 'Untitled Ruleset',
    author: '',
    description: '',
    defaultGridSize: { width: 16, height: 12 },
    defaultCellTypeId: 'empty',
    initialCycles: 1,
    setupOptions: {
      allowSeed: true,
      mapSizes: [
        { id: 'small', name: 'Small', width: 16, height: 12 },
        { id: 'medium', name: 'Medium', width: 32, height: 24 },
        { id: 'large', name: 'Large', width: 64, height: 48 },
      ],
      params: [],
    },
    resources: [
      {
        id: 'credits',
        name: 'Credits',
        shortName: 'Cr',
        color: '#F59E0B',
        kind: 'unlimited',
        initialValue: 25,
      },
    ],
    supplies: [],
    worldGenerator: [{ type: 'fill', cell: 'empty' }],
    cellTypes: [
      {
        id: 'empty',
        name: 'Empty',
        visual: { color: '#1F2A38', icon: 'empty' },
      },
    ],
  };
}

export function cloneManifestWithUniqueId(
  source: RulesetManifest,
  existingIds: Iterable<string>
): RulesetManifest {
  const copy: RulesetManifest = JSON.parse(JSON.stringify(source));
  copy.id = makeUniqueId(`${source.id}_copy`, existingIds);
  copy.name = `${source.name} (Copy)`;
  return copy;
}

// ============================================================================
// Internal Recursive Condition / Action / Rule Mappers
// ============================================================================

function mapCondition(
  cond: Condition,
  fn: (c: Condition) => Condition
): Condition {
  if (cond.type === 'any') {
    return fn({
      ...cond,
      conditions: cond.conditions.map((c) => mapCondition(c, fn)),
    });
  }
  if (cond.type === 'not') {
    return fn({
      ...cond,
      condition: mapCondition(cond.condition, fn),
    });
  }
  return fn(cond);
}

function mapConditions(
  conds: Condition[] | undefined,
  fn: (c: Condition) => Condition
): Condition[] | undefined {
  return conds?.map((c) => mapCondition(c, fn));
}

function mapRules(
  rules: Rule[] | undefined,
  mapCond: (c: Condition) => Condition,
  mapAct: (a: Action) => Action
): Rule[] | undefined {
  return rules?.map((rule) => ({
    ...rule,
    when: mapConditions(rule.when, mapCond),
    do: rule.do.map(mapAct),
    else: rule.else?.map(mapAct),
  }));
}

function mapDeltaKey(
  delta: ResourceDelta | undefined,
  oldId: ResourceId,
  newId: ResourceId
): ResourceDelta | undefined {
  if (!delta || !(oldId in delta)) return delta;
  const next: ResourceDelta = {};
  for (const [k, v] of Object.entries(delta)) {
    next[k === oldId ? newId : k] = v;
  }
  return next;
}

// ============================================================================
// Cascade Rename Helpers
// ============================================================================

export function renameResourceId(
  manifest: RulesetManifest,
  oldId: ResourceId,
  rawNewId: string
): RulesetManifest {
  const newId = slugifyId(rawNewId, oldId);
  if (!newId || newId === oldId) return manifest;
  if (manifest.resources.some((r) => r.id === newId)) return manifest;

  const mapCond = (c: Condition): Condition =>
    c.type === 'resource' && c.id === oldId ? { ...c, id: newId } : c;

  const mapAct = (a: Action): Action => {
    if ((a.type === 'addResource' || a.type === 'consumeResource') && a.id === oldId) {
      return { ...a, id: newId };
    }
    if (
      (a.type === 'refundStateToResource' || a.type === 'reclaimResource') &&
      a.resourceId === oldId
    ) {
      return { ...a, resourceId: newId };
    }
    return a;
  };

  const mapPanel = (blk: PanelBlock): PanelBlock => {
    if (blk.type === 'stat') {
      return {
        ...blk,
        when: mapConditions(blk.when, mapCond),
        toneWhen: blk.toneWhen?.map((tw) => ({
          ...tw,
          when: mapConditions(tw.when, mapCond) ?? [],
        })),
      };
    }
    if (blk.type === 'transfer' && blk.resource === oldId) {
      return { ...blk, resource: newId };
    }
    if (blk.type === 'actionButton') {
      return {
        ...blk,
        when: mapConditions(blk.when, mapCond),
        cost: mapDeltaKey(blk.cost, oldId, newId),
        do: blk.do.map(mapAct),
      };
    }
    return blk;
  };

  const mapModifier = (mod: CellModifier): CellModifier =>
    mod.type === 'capBonus' && mod.resource === oldId
      ? { ...mod, resource: newId }
      : mod;

  return {
    ...manifest,
    resources: manifest.resources.map((r) =>
      r.id === oldId ? { ...r, id: newId } : r
    ),
    cellTypes: manifest.cellTypes.map((cell) => ({
      ...cell,
      buildCost: mapDeltaKey(cell.buildCost, oldId, newId),
      modifiers: cell.modifiers?.map(mapModifier),
      visual: {
        ...cell.visual,
        rules: cell.visual.rules?.map((vr) => ({
          ...vr,
          when: mapConditions(vr.when, mapCond),
        })),
        indicators: cell.visual.indicators?.map((ind) => ({
          ...ind,
          when: mapConditions(ind.when, mapCond),
        })),
      },
      badges: cell.badges?.map((b) => ({
        ...b,
        when: mapConditions(b.when, mapCond),
      })),
      onClick: cell.onClick
        ? {
            left: mapRules(cell.onClick.left, mapCond, mapAct),
            right: mapRules(cell.onClick.right, mapCond, mapAct),
          }
        : undefined,
      onBuild: mapRules(cell.onBuild, mapCond, mapAct),
      onCycle: mapRules(cell.onCycle, mapCond, mapAct),
      onDemolish: mapRules(cell.onDemolish, mapCond, mapAct),
      onLost: mapRules(cell.onLost, mapCond, mapAct),
      panel: cell.panel?.map(mapPanel),
    })),
  };
}

export function renameSupplyId(
  manifest: RulesetManifest,
  oldId: SupplyId,
  rawNewId: string
): RulesetManifest {
  const newId = slugifyId(rawNewId, oldId);
  if (!newId || newId === oldId) return manifest;
  if (manifest.supplies.some((s) => s.id === newId)) return manifest;

  const mapCond = (c: Condition): Condition =>
    c.type === 'supply' && c.id === oldId ? { ...c, id: newId } : c;

  const mapAct = (a: Action): Action =>
    (a.type === 'emitSupply' || a.type === 'consumeSupply') && a.id === oldId
      ? { ...a, id: newId }
      : a;

  return {
    ...manifest,
    supplies: manifest.supplies.map((s) =>
      s.id === oldId ? { ...s, id: newId } : s
    ),
    cellTypes: manifest.cellTypes.map((cell) => ({
      ...cell,
      visual: {
        ...cell.visual,
        rules: cell.visual.rules?.map((vr) => ({
          ...vr,
          when: mapConditions(vr.when, mapCond),
        })),
        indicators: cell.visual.indicators?.map((ind) => ({
          ...ind,
          when: mapConditions(ind.when, mapCond),
        })),
      },
      badges: cell.badges?.map((b) => ({
        ...b,
        when: mapConditions(b.when, mapCond),
      })),
      onClick: cell.onClick
        ? {
            left: mapRules(cell.onClick.left, mapCond, mapAct),
            right: mapRules(cell.onClick.right, mapCond, mapAct),
          }
        : undefined,
      onBuild: mapRules(cell.onBuild, mapCond, mapAct),
      onCycle: mapRules(cell.onCycle, mapCond, mapAct),
      onDemolish: mapRules(cell.onDemolish, mapCond, mapAct),
      onLost: mapRules(cell.onLost, mapCond, mapAct),
      panel: cell.panel?.map((blk) => {
        if (blk.type === 'stat') {
          return {
            ...blk,
            value: blk.value.replaceAll(
              `{{supply.${oldId}}}`,
              `{{supply.${newId}}}`
            ),
            when: mapConditions(blk.when, mapCond),
            toneWhen: blk.toneWhen?.map((tw) => ({
              ...tw,
              when: mapConditions(tw.when, mapCond) ?? [],
            })),
          };
        }
        if (blk.type === 'actionButton') {
          return {
            ...blk,
            when: mapConditions(blk.when, mapCond),
            do: blk.do.map(mapAct),
          };
        }
        return blk;
      }),
    })),
  };
}

export function renameCellTypeId(
  manifest: RulesetManifest,
  oldId: CellTypeId,
  rawNewId: string
): RulesetManifest {
  const newId = slugifyId(rawNewId, oldId);
  if (!newId || newId === oldId) return manifest;
  if (manifest.cellTypes.some((c) => c.id === newId)) return manifest;

  const mapCond = (c: Condition): Condition =>
    c.type === 'neighbors' && c.cell === oldId ? { ...c, cell: newId } : c;

  const mapAct = (a: Action): Action => {
    if (a.type === 'transform' && a.to === oldId) {
      return { ...a, to: newId };
    }
    if (a.type === 'openBuildMenu' && a.options.includes(oldId)) {
      return {
        ...a,
        options: a.options.map((opt) => (opt === oldId ? newId : opt)),
      };
    }
    return a;
  };

  const mapGenStep = (step: GeneratorStep): GeneratorStep => {
    if (step.type === 'placeNear') {
      return {
        ...step,
        cell: step.cell === oldId ? newId : step.cell,
        nearCell: step.nearCell === oldId ? newId : step.nearCell,
      };
    }
    return step.cell === oldId ? { ...step, cell: newId } : step;
  };

  return {
    ...manifest,
    defaultCellTypeId:
      manifest.defaultCellTypeId === oldId ? newId : manifest.defaultCellTypeId,
    worldGenerator: manifest.worldGenerator.map(mapGenStep),
    cellTypes: manifest.cellTypes.map((cell): CellTypeManifest => ({
      ...cell,
      id: cell.id === oldId ? newId : cell.id,
      demolishTo: cell.demolishTo === oldId ? newId : cell.demolishTo,
      visual: {
        ...cell.visual,
        rules: cell.visual.rules?.map((vr) => ({
          ...vr,
          when: mapConditions(vr.when, mapCond),
        })),
        indicators: cell.visual.indicators?.map((ind) => ({
          ...ind,
          when: mapConditions(ind.when, mapCond),
        })),
      },
      badges: cell.badges?.map((b) => ({
        ...b,
        when: mapConditions(b.when, mapCond),
      })),
      onClick: cell.onClick
        ? {
            left: mapRules(cell.onClick.left, mapCond, mapAct),
            right: mapRules(cell.onClick.right, mapCond, mapAct),
          }
        : undefined,
      onBuild: mapRules(cell.onBuild, mapCond, mapAct),
      onCycle: mapRules(cell.onCycle, mapCond, mapAct),
      onDemolish: mapRules(cell.onDemolish, mapCond, mapAct),
      onLost: mapRules(cell.onLost, mapCond, mapAct),
      panel: cell.panel?.map((blk) => {
        if (blk.type === 'stat') {
          return {
            ...blk,
            when: mapConditions(blk.when, mapCond),
            toneWhen: blk.toneWhen?.map((tw) => ({
              ...tw,
              when: mapConditions(tw.when, mapCond) ?? [],
            })),
          };
        }
        if (blk.type === 'actionButton') {
          return {
            ...blk,
            when: mapConditions(blk.when, mapCond),
            do: blk.do.map(mapAct),
          };
        }
        return blk;
      }),
    })),
  };
}
