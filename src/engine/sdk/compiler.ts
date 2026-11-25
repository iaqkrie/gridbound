import { BUILTIN_MODULES } from './builtins';
import {
  CompiledRuleset,
  ModuleRef,
  ResolvedCellType,
  RulesetModuleMap,
  RulesetPackage,
} from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function normalizeModuleRef(
  value: ModuleRef | undefined
): { ref: string; params: Record<string, unknown> } | null {
  if (!value) return null;
  if (typeof value === 'string') {
    return { ref: value, params: {} };
  }
  return { ref: value.ref, params: value.params ?? {} };
}

export function validateRulesetPackage(
  pkg: RulesetPackage,
  builtins: RulesetModuleMap = BUILTIN_MODULES
): ValidationResult {
  const errors: string[] = [];
  const { manifest, modules } = pkg;

  if (manifest.schemaVersion !== 1) {
    errors.push(`Unsupported schemaVersion: ${String(manifest.schemaVersion)}`);
  }
  if (!manifest.id.trim()) {
    errors.push('Missing ruleset id');
  }
  if (!manifest.name.trim()) {
    errors.push('Missing ruleset name');
  }

  const resourceIds = new Set<string>();
  for (const res of manifest.resources) {
    if (resourceIds.has(res.id)) {
      errors.push(`Duplicate resource id: ${res.id}`);
    }
    resourceIds.add(res.id);
    if (res.kind === 'capped' && res.initialMax < 0) {
      errors.push(`Resource "${res.id}": initialMax cannot be negative`);
    }
  }

  const supplyIds = new Set<string>();
  for (const sup of manifest.supplies) {
    if (supplyIds.has(sup.id)) {
      errors.push(`Duplicate supply id: ${sup.id}`);
    }
    supplyIds.add(sup.id);
  }

  const cellIds = new Set<string>();
  for (const cell of manifest.cellTypes) {
    if (cellIds.has(cell.id)) {
      errors.push(`Duplicate cellType id: ${cell.id}`);
    }
    cellIds.add(cell.id);
  }

  if (!cellIds.has(manifest.defaultCellTypeId)) {
    errors.push(
      `defaultCellTypeId "${manifest.defaultCellTypeId}" not found in cellTypes`
    );
  }

  const genNorm = normalizeModuleRef(manifest.worldGenerator);
  const genRef = genNorm?.ref ?? '';
  const genFn = modules?.generators?.[genRef] ?? builtins.generators?.[genRef];
  if (!genFn) {
    errors.push(`World generator "${genRef}" is not registered`);
  }

  for (const cell of manifest.cellTypes) {
    if (cell.demolishTo && !cellIds.has(cell.demolishTo)) {
      errors.push(
        `Cell "${cell.id}": demolishTo "${cell.demolishTo}" does not exist`
      );
    }

    for (const em of cell.emissions ?? []) {
      if (!supplyIds.has(em.supplyId)) {
        errors.push(
          `Cell "${cell.id}": emission references unknown supply "${em.supplyId}"`
        );
      }
    }

    const checkDelta = (
      delta: Record<string, number> | undefined,
      field: string
    ) => {
      if (!delta) return;
      for (const resId of Object.keys(delta)) {
        if (!resourceIds.has(resId)) {
          errors.push(
            `Cell "${cell.id}": ${field} references unknown resource "${resId}"`
          );
        }
      }
    };

    checkDelta(cell.buildCost, 'buildCost');
    checkDelta(cell.onBuildEffect, 'onBuildEffect');
    checkDelta(cell.onDemolishEffect, 'onDemolishEffect');
    checkDelta(cell.capBonus, 'capBonus');

    const checkClick = (
      action:
        | { kind: string; options?: string[]; cellTypeId?: string }
        | undefined
    ) => {
      if (!action) return;
      if (action.kind === 'openBuildMenu' && action.options) {
        for (const opt of action.options) {
          if (!cellIds.has(opt)) {
            errors.push(
              `Cell "${cell.id}": build menu references unknown cell "${opt}"`
            );
          }
        }
      }
      if (
        action.kind === 'setCell' &&
        action.cellTypeId &&
        !cellIds.has(action.cellTypeId)
      ) {
        errors.push(
          `Cell "${cell.id}": setCell references unknown cell "${action.cellTypeId}"`
        );
      }
    };

    checkClick(cell.onClick?.left);
    checkClick(cell.onClick?.right);

    const behaviorNorm = normalizeModuleRef(cell.behavior);
    if (behaviorNorm) {
      const mod =
        modules?.behaviors?.[behaviorNorm.ref] ??
        builtins.behaviors?.[behaviorNorm.ref];
      if (!mod) {
        errors.push(
          `Cell "${cell.id}": behavior "${behaviorNorm.ref}" is not registered`
        );
      }
    }

    const panelNorm = normalizeModuleRef(cell.panel);
    if (panelNorm) {
      const comp =
        modules?.panels?.[panelNorm.ref] ?? builtins.panels?.[panelNorm.ref];
      if (!comp) {
        errors.push(
          `Cell "${cell.id}": panel "${panelNorm.ref}" is not registered`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function compileRulesetPackage(
  pkg: RulesetPackage,
  builtins: RulesetModuleMap = BUILTIN_MODULES
): CompiledRuleset {
  const validation = validateRulesetPackage(pkg, builtins);
  if (!validation.valid) {
    throw new Error(
      `Failed to compile ruleset "${pkg.manifest.id}":\n- ${validation.errors.join('\n- ')}`
    );
  }

  const { manifest, modules } = pkg;
  const genNorm = normalizeModuleRef(manifest.worldGenerator)!;
  const genFn = (modules?.generators?.[genNorm.ref] ??
    builtins.generators?.[genNorm.ref])!;

  const cellTypes: ResolvedCellType[] = manifest.cellTypes.map((cell) => {
    const behaviorNorm = normalizeModuleRef(cell.behavior);
    const behaviorModule = behaviorNorm
      ? (modules?.behaviors?.[behaviorNorm.ref] ??
        builtins.behaviors?.[behaviorNorm.ref])
      : undefined;

    const panelNorm = normalizeModuleRef(cell.panel);
    const panelComponent = panelNorm
      ? (modules?.panels?.[panelNorm.ref] ?? builtins.panels?.[panelNorm.ref])
      : undefined;

    return {
      id: cell.id,
      name: cell.name,
      description: cell.description,
      shortRule: cell.shortRule,
      visual: { ...cell.visual },
      emissions: cell.emissions ? [...cell.emissions] : [],
      initialState: cell.initialState ? { ...cell.initialState } : undefined,
      buildCost: cell.buildCost ? { ...cell.buildCost } : undefined,
      onBuildEffect: cell.onBuildEffect ? { ...cell.onBuildEffect } : undefined,
      onDemolishEffect: cell.onDemolishEffect
        ? { ...cell.onDemolishEffect }
        : undefined,
      demolishTo: cell.demolishTo,
      capBonus: cell.capBonus ? { ...cell.capBonus } : undefined,
      onClick: {
        left: cell.onClick?.left ?? { kind: 'none' },
        right: cell.onClick?.right ?? { kind: 'none' },
      },
      behavior:
        behaviorNorm && behaviorModule
          ? {
              ref: behaviorNorm.ref,
              module: behaviorModule,
              params: behaviorNorm.params,
            }
          : undefined,
      panel:
        panelNorm && panelComponent
          ? {
              ref: panelNorm.ref,
              component: panelComponent,
              params: panelNorm.params,
            }
          : undefined,
    };
  });

  return {
    manifest,
    generator: {
      ref: genNorm.ref,
      fn: genFn,
      params: genNorm.params,
    },
    cellTypes,
  };
}
