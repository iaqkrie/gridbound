import {
  Action,
  CellTypeManifest,
  CompareOp,
  GeneratorStep,
  PanelBlock,
  Rule,
  RulesetManifest,
  ValidationIssue,
  ValidationSection,
} from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  issues: ValidationIssue[];
}

const VALID_OPS = new Set<CompareOp>(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);
const VALID_NEIGHBORHOODS = new Set(['moore', 'vonNeumann', 'self']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type IssueCollector = (
  section: ValidationSection,
  path: string,
  message: string,
  cellId?: string
) => void;

function validateCondition(
  cond: unknown,
  path: string,
  cellId: string | undefined,
  resourceIds: Set<string>,
  supplyIds: Set<string>,
  cellIds: Set<string>,
  push: IssueCollector
): void {
  if (!isRecord(cond) || typeof cond.type !== 'string') {
    push('cells', path, `${path}: invalid condition object`, cellId);
    return;
  }

  switch (cond.type) {
    case 'supply':
      if (typeof cond.id !== 'string' || !supplyIds.has(cond.id)) {
        push('cells', path, `${path}: unknown supply "${String(cond.id)}"`, cellId);
      }
      if (!VALID_OPS.has(cond.op as CompareOp)) {
        push('cells', path, `${path}: invalid operator "${String(cond.op)}"`, cellId);
      }
      if (typeof cond.value !== 'number' || Number.isNaN(cond.value)) {
        push('cells', path, `${path}: supply value must be a number`, cellId);
      }
      break;

    case 'resource':
      if (typeof cond.id !== 'string' || !resourceIds.has(cond.id)) {
        push('cells', path, `${path}: unknown resource "${String(cond.id)}"`, cellId);
      }
      if (!VALID_OPS.has(cond.op as CompareOp)) {
        push('cells', path, `${path}: invalid operator "${String(cond.op)}"`, cellId);
      }
      if (typeof cond.value !== 'number' || Number.isNaN(cond.value)) {
        push('cells', path, `${path}: resource value must be a number`, cellId);
      }
      break;

    case 'state':
      if (typeof cond.key !== 'string' || !cond.key.trim()) {
        push('cells', path, `${path}: state condition missing key`, cellId);
      }
      if (!VALID_OPS.has(cond.op as CompareOp)) {
        push('cells', path, `${path}: invalid operator "${String(cond.op)}"`, cellId);
      }
      if (
        typeof cond.value !== 'number' &&
        typeof cond.value !== 'string' &&
        typeof cond.value !== 'boolean'
      ) {
        push('cells', path, `${path}: invalid state comparison value`, cellId);
      }
      break;

    case 'neighbors':
      if (typeof cond.cell !== 'string' || !cellIds.has(cond.cell)) {
        push('cells', path, `${path}: unknown neighbor cell "${String(cond.cell)}"`, cellId);
      }
      if (!VALID_OPS.has(cond.op as CompareOp)) {
        push('cells', path, `${path}: invalid operator "${String(cond.op)}"`, cellId);
      }
      if (typeof cond.value !== 'number' || Number.isNaN(cond.value)) {
        push('cells', path, `${path}: neighbors value must be a number`, cellId);
      }
      break;

    case 'chance':
      if (
        typeof cond.probability !== 'number' ||
        Number.isNaN(cond.probability) ||
        cond.probability < 0 ||
        cond.probability > 1
      ) {
        push('cells', path, `${path}: chance probability must be between 0 and 1`, cellId);
      }
      break;

    case 'any':
      if (!Array.isArray(cond.conditions) || cond.conditions.length === 0) {
        push('cells', path, `${path}: "any" requires a non-empty conditions array`, cellId);
      } else {
        cond.conditions.forEach((c, idx) =>
          validateCondition(
            c,
            `${path}.any[${idx}]`,
            cellId,
            resourceIds,
            supplyIds,
            cellIds,
            push
          )
        );
      }
      break;

    case 'not':
      validateCondition(
        cond.condition,
        `${path}.not`,
        cellId,
        resourceIds,
        supplyIds,
        cellIds,
        push
      );
      break;

    default:
      push('cells', path, `${path}: unknown condition type "${cond.type}"`, cellId);
  }
}

function validateConditions(
  conds: unknown,
  path: string,
  cellId: string | undefined,
  resourceIds: Set<string>,
  supplyIds: Set<string>,
  cellIds: Set<string>,
  push: IssueCollector
): void {
  if (conds === undefined) return;
  if (!Array.isArray(conds)) {
    push('cells', path, `${path}: "when" must be an array`, cellId);
    return;
  }
  conds.forEach((c, idx) =>
    validateCondition(
      c,
      `${path}[${idx}]`,
      cellId,
      resourceIds,
      supplyIds,
      cellIds,
      push
    )
  );
}

function validateAction(
  action: unknown,
  path: string,
  cellId: string | undefined,
  resourceIds: Set<string>,
  supplyIds: Set<string>,
  cellIds: Set<string>,
  push: IssueCollector
): void {
  if (!isRecord(action) || typeof action.type !== 'string') {
    push('cells', path, `${path}: invalid action object`, cellId);
    return;
  }

  switch (action.type as Action['type']) {
    case 'addResource':
    case 'consumeResource':
      if (typeof action.id !== 'string' || !resourceIds.has(action.id)) {
        push('cells', path, `${path}: unknown resource "${String(action.id)}"`, cellId);
      }
      if (typeof action.amount !== 'number' || Number.isNaN(action.amount)) {
        push('cells', path, `${path}: amount must be a number`, cellId);
      }
      break;

    case 'consumeSupply':
      if (typeof action.id !== 'string' || !supplyIds.has(action.id)) {
        push('cells', path, `${path}: unknown supply "${String(action.id)}"`, cellId);
      }
      if (typeof action.amount !== 'number' || Number.isNaN(action.amount) || action.amount < 0) {
        push('cells', path, `${path}: amount must be a non-negative number`, cellId);
      }
      break;

    case 'emitSupply':
      if (typeof action.id !== 'string' || !supplyIds.has(action.id)) {
        push('cells', path, `${path}: unknown supply "${String(action.id)}"`, cellId);
      }
      if (typeof action.amount !== 'number' || Number.isNaN(action.amount) || action.amount <= 0) {
        push('cells', path, `${path}: emitSupply amount must be > 0`, cellId);
      }
      if (typeof action.radius !== 'number' || Number.isNaN(action.radius) || action.radius < 0) {
        push('cells', path, `${path}: emitSupply radius must be >= 0`, cellId);
      }
      if (!VALID_NEIGHBORHOODS.has(String(action.neighborhood))) {
        push(
          'cells',
          path,
          `${path}: invalid neighborhood "${String(action.neighborhood)}"`,
          cellId
        );
      }
      break;

    case 'setState':
      if (typeof action.key !== 'string' || !action.key.trim()) {
        push('cells', path, `${path}: setState missing key`, cellId);
      }
      if (
        typeof action.value !== 'number' &&
        typeof action.value !== 'string' &&
        typeof action.value !== 'boolean'
      ) {
        push('cells', path, `${path}: setState value must be number, string, or boolean`, cellId);
      }
      break;

    case 'addState':
      if (typeof action.key !== 'string' || !action.key.trim()) {
        push('cells', path, `${path}: addState missing key`, cellId);
      }
      if (typeof action.amount !== 'number' || Number.isNaN(action.amount)) {
        push('cells', path, `${path}: addState amount must be a number`, cellId);
      }
      break;

    case 'transform':
      if (typeof action.to !== 'string' || !cellIds.has(action.to)) {
        push('cells', path, `${path}: transform targets unknown cell "${String(action.to)}"`, cellId);
      }
      break;

    case 'notify':
      if (action.severity !== 'warning' && action.severity !== 'danger') {
        push('cells', path, `${path}: notify severity must be "warning" or "danger"`, cellId);
      }
      if (typeof action.title !== 'string') {
        push('cells', path, `${path}: notify requires title string`, cellId);
      }
      break;

    case 'refundStateToResource':
      if (typeof action.stateKey !== 'string' || !action.stateKey.trim()) {
        push('cells', path, `${path}: refundStateToResource missing stateKey`, cellId);
      }
      if (typeof action.resourceId !== 'string' || !resourceIds.has(action.resourceId)) {
        push('cells', path, `${path}: unknown resource "${String(action.resourceId)}"`, cellId);
      }
      break;

    case 'reclaimResource':
      if (typeof action.resourceId !== 'string' || !resourceIds.has(action.resourceId)) {
        push('cells', path, `${path}: unknown resource "${String(action.resourceId)}"`, cellId);
      }
      if (typeof action.amount !== 'number' || Number.isNaN(action.amount) || action.amount <= 0) {
        push('cells', path, `${path}: reclaimResource amount must be > 0`, cellId);
      }
      break;

    case 'openBuildMenu':
      if (!Array.isArray(action.options) || action.options.length === 0) {
        push('cells', path, `${path}: openBuildMenu requires non-empty options array`, cellId);
      } else {
        for (const opt of action.options) {
          if (typeof opt !== 'string' || !cellIds.has(opt)) {
            push(
              'cells',
              path,
              `${path}: openBuildMenu references unknown cell "${String(opt)}"`,
              cellId
            );
          }
        }
      }
      break;

    case 'openPanel':
    case 'openDemolishConfirm':
      break;

    default:
      push('cells', path, `${path}: unknown action type "${String(action.type)}"`, cellId);
  }
}

function validateRules(
  rules: unknown,
  path: string,
  cellId: string | undefined,
  resourceIds: Set<string>,
  supplyIds: Set<string>,
  cellIds: Set<string>,
  push: IssueCollector
): void {
  if (rules === undefined) return;
  if (!Array.isArray(rules)) {
    push('cells', path, `${path}: must be an array of rules`, cellId);
    return;
  }

  (rules as Rule[]).forEach((rule, idx) => {
    const rPath = `${path}[${idx}]`;
    if (!isRecord(rule)) {
      push('cells', rPath, `${rPath}: invalid rule object`, cellId);
      return;
    }
    validateConditions(
      rule.when,
      `${rPath}.when`,
      cellId,
      resourceIds,
      supplyIds,
      cellIds,
      push
    );
    if (!Array.isArray(rule.do)) {
      push('cells', rPath, `${rPath}: missing "do" action array`, cellId);
    } else {
      rule.do.forEach((act, aIdx) =>
        validateAction(
          act,
          `${rPath}.do[${aIdx}]`,
          cellId,
          resourceIds,
          supplyIds,
          cellIds,
          push
        )
      );
    }
    if (rule.else !== undefined) {
      if (!Array.isArray(rule.else)) {
        push('cells', rPath, `${rPath}: "else" must be an array of actions`, cellId);
      } else {
        rule.else.forEach((act, aIdx) =>
          validateAction(
            act,
            `${rPath}.else[${aIdx}]`,
            cellId,
            resourceIds,
            supplyIds,
            cellIds,
            push
          )
        );
      }
    }
  });
}

function validateGeneratorStep(
  step: unknown,
  idx: number,
  cellIds: Set<string>,
  push: IssueCollector
): void {
  const path = `worldGenerator[${idx}]`;
  if (!isRecord(step) || typeof step.type !== 'string') {
    push('generator', path, `${path}: invalid generator step`);
    return;
  }

  const typed = step as Partial<GeneratorStep>;
  switch (typed.type) {
    case 'fill':
      if (!typed.cell || !cellIds.has(typed.cell)) {
        push('generator', path, `${path}: unknown cell "${String(typed.cell)}"`);
      }
      break;
    case 'clusters':
      if (!typed.cell || !cellIds.has(typed.cell)) {
        push('generator', path, `${path}: unknown cell "${String(typed.cell)}"`);
      }
      if (typeof typed.clustersPer768 !== 'number' || typed.clustersPer768 < 0) {
        push('generator', path, `${path}: invalid clustersPer768`);
      }
      if (typeof typed.minSize !== 'number' || typeof typed.maxSize !== 'number') {
        push('generator', path, `${path}: clusters requires numeric minSize and maxSize`);
      }
      break;
    case 'scatter':
      if (!typed.cell || !cellIds.has(typed.cell)) {
        push('generator', path, `${path}: unknown cell "${String(typed.cell)}"`);
      }
      if (typeof typed.countPer768 !== 'number' || typed.countPer768 < 0) {
        push('generator', path, `${path}: invalid countPer768`);
      }
      break;
    case 'placeNear':
      if (!typed.cell || !cellIds.has(typed.cell)) {
        push('generator', path, `${path}: unknown cell "${String(typed.cell)}"`);
      }
      if (!typed.nearCell || !cellIds.has(typed.nearCell)) {
        push('generator', path, `${path}: unknown nearCell "${String(typed.nearCell)}"`);
      }
      if (typeof typed.chance !== 'number' || typed.chance < 0 || typed.chance > 1) {
        push('generator', path, `${path}: chance must be between 0 and 1`);
      }
      break;
    default:
      push('generator', path, `${path}: unknown generator step type "${String(step.type)}"`);
  }
}

function validatePanelBlock(
  block: unknown,
  path: string,
  cellId: string | undefined,
  resourceIds: Set<string>,
  supplyIds: Set<string>,
  cellIds: Set<string>,
  push: IssueCollector
): void {
  if (!isRecord(block) || typeof block.type !== 'string') {
    push('cells', path, `${path}: invalid panel block`, cellId);
    return;
  }

  const typed = block as Partial<PanelBlock>;
  switch (typed.type) {
    case 'stat':
      if (typeof typed.label !== 'string' || typeof typed.value !== 'string') {
        push('cells', path, `${path}: stat block requires label and value strings`, cellId);
      }
      validateConditions(
        typed.when,
        `${path}.when`,
        cellId,
        resourceIds,
        supplyIds,
        cellIds,
        push
      );
      break;
    case 'transfer':
      if (typeof typed.resource !== 'string' || !resourceIds.has(typed.resource)) {
        push('cells', path, `${path}: unknown resource "${String(typed.resource)}"`, cellId);
      }
      if (typeof typed.stateKey !== 'string' || !typed.stateKey.trim()) {
        push('cells', path, `${path}: transfer requires stateKey`, cellId);
      }
      if (typeof typed.min !== 'number' || typeof typed.max !== 'number') {
        push('cells', path, `${path}: transfer requires numeric min and max`, cellId);
      }
      break;
    case 'resourceSelect':
      if (typeof typed.stateKey !== 'string' || !typed.stateKey.trim()) {
        push('cells', path, `${path}: resourceSelect requires stateKey`, cellId);
      }
      break;
    case 'actionButton':
      if (typeof typed.label !== 'string') {
        push('cells', path, `${path}: actionButton requires label`, cellId);
      }
      validateConditions(
        typed.when,
        `${path}.when`,
        cellId,
        resourceIds,
        supplyIds,
        cellIds,
        push
      );
      if (typed.cost) {
        for (const resId of Object.keys(typed.cost)) {
          if (!resourceIds.has(resId)) {
            push('cells', path, `${path}: cost references unknown resource "${resId}"`, cellId);
          }
        }
      }
      if (!Array.isArray(typed.do)) {
        push('cells', path, `${path}: actionButton requires "do" action array`, cellId);
      } else {
        typed.do.forEach((act, aIdx) =>
          validateAction(
            act,
            `${path}.do[${aIdx}]`,
            cellId,
            resourceIds,
            supplyIds,
            cellIds,
            push
          )
        );
      }
      break;
    default:
      push('cells', path, `${path}: unknown panel block type "${String(block.type)}"`, cellId);
  }
}

export function validateRulesetManifest(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const push: IssueCollector = (section, path, message, cellId) => {
    issues.push({ section, path, message, cellId });
  };

  if (!isRecord(input)) {
    const msg = 'Ruleset root must be a JSON object';
    return {
      valid: false,
      errors: [msg],
      issues: [{ section: 'general', path: 'root', message: msg }],
    };
  }

  const manifest = input as Partial<RulesetManifest>;

  if (manifest.schemaVersion !== 2) {
    push(
      'general',
      'schemaVersion',
      `Unsupported schemaVersion "${String(manifest.schemaVersion)}" (expected 2)`
    );
  }
  if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
    push('general', 'id', 'Missing ruleset "id"');
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    push('general', 'name', 'Missing ruleset "name"');
  }
  if (
    !isRecord(manifest.defaultGridSize) ||
    typeof manifest.defaultGridSize.width !== 'number' ||
    typeof manifest.defaultGridSize.height !== 'number' ||
    manifest.defaultGridSize.width < 4 ||
    manifest.defaultGridSize.height < 4
  ) {
    push(
      'general',
      'defaultGridSize',
      'Invalid "defaultGridSize" (width and height must be >= 4)'
    );
  }

  const resourceIds = new Set<string>();
  if (!Array.isArray(manifest.resources)) {
    push('resources', 'resources', 'Missing "resources" array');
  } else {
    for (const res of manifest.resources) {
      if (!isRecord(res) || typeof res.id !== 'string' || !res.id.trim()) {
        push('resources', 'resources', 'Invalid resource entry (missing id)');
        continue;
      }
      if (resourceIds.has(res.id)) {
        push('resources', `resources.${res.id}`, `Duplicate resource id "${res.id}"`);
      }
      resourceIds.add(res.id);
      if (res.kind !== 'unlimited' && res.kind !== 'capped') {
        push(
          'resources',
          `resources.${res.id}`,
          `Resource "${res.id}": kind must be "unlimited" or "capped"`
        );
      }
      if (
        res.kind === 'capped' &&
        (typeof res.initialMax !== 'number' || res.initialMax < 0)
      ) {
        push(
          'resources',
          `resources.${res.id}`,
          `Resource "${res.id}": capped resource requires initialMax >= 0`
        );
      }
    }
  }

  const supplyIds = new Set<string>();
  if (!Array.isArray(manifest.supplies)) {
    push('supplies', 'supplies', 'Missing "supplies" array');
  } else {
    for (const sup of manifest.supplies) {
      if (!isRecord(sup) || typeof sup.id !== 'string' || !sup.id.trim()) {
        push('supplies', 'supplies', 'Invalid supply entry (missing id)');
        continue;
      }
      if (supplyIds.has(sup.id)) {
        push('supplies', `supplies.${sup.id}`, `Duplicate supply id "${sup.id}"`);
      }
      supplyIds.add(sup.id);
    }
  }

  const cellIds = new Set<string>();
  if (!Array.isArray(manifest.cellTypes) || manifest.cellTypes.length === 0) {
    push('cells', 'cellTypes', 'Missing non-empty "cellTypes" array');
  } else {
    for (const cell of manifest.cellTypes) {
      if (!isRecord(cell) || typeof cell.id !== 'string' || !cell.id.trim()) {
        push('cells', 'cellTypes', 'Invalid cellType entry (missing id)');
        continue;
      }
      if (cellIds.has(cell.id)) {
        push('cells', `cellTypes.${cell.id}`, `Duplicate cellType id "${cell.id}"`, cell.id);
      }
      cellIds.add(cell.id);
    }
  }

  if (
    typeof manifest.defaultCellTypeId !== 'string' ||
    !cellIds.has(manifest.defaultCellTypeId)
  ) {
    push(
      'general',
      'defaultCellTypeId',
      `defaultCellTypeId "${String(manifest.defaultCellTypeId)}" not found in cellTypes`
    );
  }

  if (!Array.isArray(manifest.worldGenerator)) {
    push('generator', 'worldGenerator', 'Missing "worldGenerator" array');
  } else {
    manifest.worldGenerator.forEach((step, idx) =>
      validateGeneratorStep(step, idx, cellIds, push)
    );
  }

  for (const cell of (manifest.cellTypes ?? []) as CellTypeManifest[]) {
    if (!isRecord(cell) || typeof cell.id !== 'string') continue;
    const prefix = `Cell "${cell.id}"`;

    if (!isRecord(cell.visual) || typeof cell.visual.color !== 'string') {
      push('cells', `${prefix}.visual`, `${prefix}: missing visual.color`, cell.id);
    } else {
      cell.visual.rules?.forEach((vr, idx) =>
        validateConditions(
          vr.when,
          `${prefix}.visual.rules[${idx}].when`,
          cell.id,
          resourceIds,
          supplyIds,
          cellIds,
          push
        )
      );
      cell.visual.indicators?.forEach((ind, idx) =>
        validateConditions(
          ind.when,
          `${prefix}.visual.indicators[${idx}].when`,
          cell.id,
          resourceIds,
          supplyIds,
          cellIds,
          push
        )
      );
    }

    if (cell.demolishTo && !cellIds.has(cell.demolishTo)) {
      push(
        'cells',
        `${prefix}.demolishTo`,
        `${prefix}: demolishTo "${cell.demolishTo}" does not exist`,
        cell.id
      );
    }

    if (cell.buildCost) {
      for (const resId of Object.keys(cell.buildCost)) {
        if (!resourceIds.has(resId)) {
          push(
            'cells',
            `${prefix}.buildCost`,
            `${prefix}: buildCost references unknown resource "${resId}"`,
            cell.id
          );
        }
      }
    }

    cell.modifiers?.forEach((mod, idx) => {
      if (mod.type !== 'capBonus') {
        push('cells', `${prefix}.modifiers[${idx}]`, `${prefix}.modifiers[${idx}]: unknown modifier type`, cell.id);
        return;
      }
      if (mod.resource && !resourceIds.has(mod.resource)) {
        push(
          'cells',
          `${prefix}.modifiers[${idx}]`,
          `${prefix}.modifiers[${idx}]: unknown resource "${mod.resource}"`,
          cell.id
        );
      }
      if (!mod.resource && !mod.resourceFromState) {
        push(
          'cells',
          `${prefix}.modifiers[${idx}]`,
          `${prefix}.modifiers[${idx}]: capBonus requires resource or resourceFromState`,
          cell.id
        );
      }
    });

    cell.badges?.forEach((badge, idx) =>
      validateConditions(
        badge.when,
        `${prefix}.badges[${idx}].when`,
        cell.id,
        resourceIds,
        supplyIds,
        cellIds,
        push
      )
    );

    validateRules(
      cell.onClick?.left,
      `${prefix}.onClick.left`,
      cell.id,
      resourceIds,
      supplyIds,
      cellIds,
      push
    );
    validateRules(
      cell.onClick?.right,
      `${prefix}.onClick.right`,
      cell.id,
      resourceIds,
      supplyIds,
      cellIds,
      push
    );
    validateRules(
      cell.onBuild,
      `${prefix}.onBuild`,
      cell.id,
      resourceIds,
      supplyIds,
      cellIds,
      push
    );
    validateRules(
      cell.onCycle,
      `${prefix}.onCycle`,
      cell.id,
      resourceIds,
      supplyIds,
      cellIds,
      push
    );
    validateRules(
      cell.onDemolish,
      `${prefix}.onDemolish`,
      cell.id,
      resourceIds,
      supplyIds,
      cellIds,
      push
    );
    validateRules(
      cell.onLost,
      `${prefix}.onLost`,
      cell.id,
      resourceIds,
      supplyIds,
      cellIds,
      push
    );

    if (cell.panel !== undefined) {
      if (!Array.isArray(cell.panel)) {
        push('cells', `${prefix}.panel`, `${prefix}.panel: must be an array`, cell.id);
      } else {
        cell.panel.forEach((blk, idx) =>
          validatePanelBlock(
            blk,
            `${prefix}.panel[${idx}]`,
            cell.id,
            resourceIds,
            supplyIds,
            cellIds,
            push
          )
        );
      }
    }
  }

  return {
    valid: issues.length === 0,
    errors: issues.map((i) => i.message),
    issues,
  };
}

export function assertValidRuleset(input: unknown): RulesetManifest {
  const result = validateRulesetManifest(input);
  if (!result.valid) {
    throw new Error(`Invalid ruleset:\n- ${result.errors.join('\n- ')}`);
  }
  return input as RulesetManifest;
}
