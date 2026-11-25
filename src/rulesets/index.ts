import {
  BUILTIN_MODULES,
  CompiledRuleset,
  RulesetPackage,
  compileRulesetPackage,
} from '../engine/sdk';
import { classicColonyPackage } from './classic-colony';

const REGISTERED_PACKAGES: RulesetPackage[] = [classicColonyPackage];

export const RULESETS: CompiledRuleset[] = REGISTERED_PACKAGES.map((pkg) =>
  compileRulesetPackage(pkg, BUILTIN_MODULES)
);

export function getRulesetById(id: string): CompiledRuleset {
  return RULESETS.find((r) => r.manifest.id === id) ?? RULESETS[0];
}
