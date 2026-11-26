import {
  Action,
  CellTypeManifest,
  CompareOp,
  Condition,
  GeneratorStep,
  PanelBlock,
  ResourceManifest,
  Rule,
  RulesetManifest,
  SupplyManifest,
  makeUniqueId,
} from '../../engine/sdk';

export const TACTICAL_COLORS = [
  '#10B981', // Emerald
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
  '#818CF8', // Indigo
  '#A855F7', // Purple
  '#F59E0B', // Amber
  '#D97706', // Ochre
  '#F97316', // Orange
  '#F43F5E', // Rose
  '#EF4444', // Red
  '#15803D', // Forest
  '#14B8A6', // Teal
  '#64748B', // Slate
  '#94A3B8', // Light Slate
  '#CBD5E1', // Silver
  '#1F2A38', // Charcoal
] as const;

export const COMPARE_OPS: { value: CompareOp; label: string }[] = [
  { value: 'gte', label: '>=' },
  { value: 'gt', label: '>' },
  { value: 'lte', label: '<=' },
  { value: 'lt', label: '<' },
  { value: 'eq', label: '==' },
  { value: 'neq', label: '!=' },
];

export const INPUT_CLS =
  'bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded-md px-2.5 py-1.5 text-xs text-[#E6EDF3] placeholder:text-[#8B98A9]/50 focus:outline-none transition-colors';

export const SELECT_CLS =
  'bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded-md px-2 py-1.5 text-xs text-[#E6EDF3] focus:outline-none transition-colors cursor-pointer';

export const MONO_INPUT_CLS = `${INPUT_CLS} font-mono tabular-nums`;

export function createDefaultCondition(
  type: Condition['type'],
  manifest: RulesetManifest,
  stateKeys: string[]
): Condition {
  const firstSupply = manifest.supplies[0]?.id ?? '';
  const firstResource = manifest.resources[0]?.id ?? '';
  const firstCell = manifest.cellTypes[0]?.id ?? '';
  const firstKey = stateKeys[0] ?? 'active';

  switch (type) {
    case 'supply':
      return { type: 'supply', id: firstSupply, op: 'gte', value: 1 };
    case 'resource':
      return { type: 'resource', id: firstResource, op: 'gte', value: 1 };
    case 'state':
      return { type: 'state', key: firstKey, op: 'gte', value: 1 };
    case 'neighbors':
      return {
        type: 'neighbors',
        cell: firstCell,
        op: 'gte',
        value: 1,
        radius: 1,
        neighborhood: 'moore',
      };
    case 'chance':
      return { type: 'chance', probability: 0.25 };
    case 'not':
      return {
        type: 'not',
        condition: createDefaultCondition('state', manifest, stateKeys),
      };
    case 'any':
      return {
        type: 'any',
        conditions: [createDefaultCondition('state', manifest, stateKeys)],
      };
  }
}

export function createDefaultAction(
  type: Action['type'],
  manifest: RulesetManifest,
  stateKeys: string[]
): Action {
  const firstSupply = manifest.supplies[0]?.id ?? '';
  const firstResource = manifest.resources[0]?.id ?? '';
  const firstCell = manifest.defaultCellTypeId || manifest.cellTypes[0]?.id || '';
  const nonDefaultCell =
    manifest.cellTypes.find((c) => c.id !== manifest.defaultCellTypeId)?.id ??
    firstCell;
  const firstKey = stateKeys[0] ?? 'counter';

  switch (type) {
    case 'addResource':
      return { type: 'addResource', id: firstResource, amount: 1 };
    case 'consumeResource':
      return { type: 'consumeResource', id: firstResource, amount: 1 };
    case 'emitSupply':
      return {
        type: 'emitSupply',
        id: firstSupply,
        amount: 2,
        radius: 2,
        neighborhood: 'moore',
        includeSelf: true,
      };
    case 'consumeSupply':
      return { type: 'consumeSupply', id: firstSupply, amount: 1 };
    case 'setState':
      return { type: 'setState', key: firstKey, value: 0 };
    case 'addState':
      return { type: 'addState', key: firstKey, amount: 1 };
    case 'transform':
      return { type: 'transform', to: firstCell };
    case 'notify':
      return {
        type: 'notify',
        severity: 'warning',
        title: 'Alert',
        message: 'Check this cell',
      };
    case 'refundStateToResource':
      return {
        type: 'refundStateToResource',
        stateKey: firstKey,
        resourceId: firstResource,
      };
    case 'reclaimResource':
      return {
        type: 'reclaimResource',
        resourceId: firstResource,
        amount: 1,
      };
    case 'openBuildMenu':
      return { type: 'openBuildMenu', options: [nonDefaultCell] };
    case 'openPanel':
      return { type: 'openPanel' };
    case 'openDemolishConfirm':
      return { type: 'openDemolishConfirm' };
  }
}

export function createDefaultRule(
  manifest: RulesetManifest,
  stateKeys: string[],
  allowUiActions: boolean
): Rule {
  const defaultActionType: Action['type'] = allowUiActions
    ? 'openPanel'
    : manifest.resources.length > 0
      ? 'addResource'
      : 'setState';
  return {
    when: [],
    do: [createDefaultAction(defaultActionType, manifest, stateKeys)],
    stop: false,
  };
}

export function createDefaultResource(
  manifest: RulesetManifest
): ResourceManifest {
  const id = makeUniqueId(
    'resource',
    manifest.resources.map((r) => r.id)
  );
  return {
    id,
    name: 'New Resource',
    shortName: 'Res',
    color: TACTICAL_COLORS[manifest.resources.length % TACTICAL_COLORS.length],
    kind: 'capped',
    initialValue: 0,
    initialMax: 100,
    tags: [],
  };
}

export function createDefaultSupply(manifest: RulesetManifest): SupplyManifest {
  const id = makeUniqueId(
    'supply',
    manifest.supplies.map((s) => s.id)
  );
  return {
    id,
    name: 'New Supply',
    color:
      TACTICAL_COLORS[(manifest.supplies.length + 1) % TACTICAL_COLORS.length],
    maxExpected: 6,
    decay: { kind: 'clear' },
  };
}

export function createDefaultCellType(
  manifest: RulesetManifest
): CellTypeManifest {
  const id = makeUniqueId(
    'cell',
    manifest.cellTypes.map((c) => c.id)
  );
  return {
    id,
    name: 'New Cell',
    shortRule: '',
    visual: {
      color:
        TACTICAL_COLORS[manifest.cellTypes.length % TACTICAL_COLORS.length],
      icon: 'solid',
      border: 'solid',
    },
    onClick: {
      right: [{ do: [{ type: 'openDemolishConfirm' }] }],
    },
  };
}

export function createDefaultGeneratorStep(
  type: GeneratorStep['type'],
  manifest: RulesetManifest
): GeneratorStep {
  const nonDefault =
    manifest.cellTypes.find((c) => c.id !== manifest.defaultCellTypeId)?.id ??
    manifest.defaultCellTypeId;
  switch (type) {
    case 'fill':
      return { type: 'fill', cell: manifest.defaultCellTypeId };
    case 'clusters':
      return {
        type: 'clusters',
        cell: nonDefault,
        clustersPer768: 6,
        minClusters: 1,
        minSize: 3,
        maxSize: 6,
        onlyOnEmpty: true,
      };
    case 'scatter':
      return {
        type: 'scatter',
        cell: nonDefault,
        countPer768: 12,
        minCount: 1,
        onlyOnEmpty: true,
      };
    case 'placeNear':
      return {
        type: 'placeNear',
        cell: nonDefault,
        nearCell: nonDefault,
        radius: 1,
        neighborhood: 'moore',
        chance: 0.35,
        onlyOnEmpty: true,
      };
  }
}

export function createDefaultPanelBlock(
  type: PanelBlock['type'],
  manifest: RulesetManifest,
  stateKeys: string[]
): PanelBlock {
  const firstResource = manifest.resources[0]?.id ?? '';
  const firstKey = stateKeys[0] ?? 'worker';

  switch (type) {
    case 'stat':
      return {
        type: 'stat',
        label: 'Output',
        value: 'cycleOutput',
      };
    case 'transfer':
      return {
        type: 'transfer',
        label: 'Worker',
        resource: firstResource,
        stateKey: firstKey,
        min: 0,
        max: 1,
        step: 1,
      };
    case 'resourceSelect':
      return {
        type: 'resourceSelect',
        label: 'Stored Resource',
        bonusText: '+100',
        stateKey: stateKeys[0] ?? 'storageResource',
        kind: 'capped',
      };
    case 'actionButton':
      return {
        type: 'actionButton',
        label: 'Activate',
        do: [createDefaultAction('setState', manifest, stateKeys)],
        tone: 'primary',
      };
  }
}

export function moveArrayItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function downloadRulesetJson(manifest: RulesetManifest): void {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${manifest.id || 'ruleset'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
