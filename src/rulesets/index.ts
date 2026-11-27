import {
  assertValidRuleset,
  RulesetManifest,
  validateRulesetManifest,
} from '../engine/sdk';
import { CLASSIC_COLONY_RULESET } from './classic-colony';

const CUSTOM_RULESETS_STORAGE_KEY = 'gridbound_custom_rulesets_v4';

export interface RulesetRegistryEntry {
  manifest: RulesetManifest;
  builtIn: boolean;
}

const BUILTIN_RULESETS: RulesetManifest[] = [
  assertValidRuleset(CLASSIC_COLONY_RULESET),
];

export function loadCustomRulesets(): RulesetManifest[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_RULESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: RulesetManifest[] = [];
    for (const item of parsed) {
      if (validateRulesetManifest(item).valid) {
        valid.push(item as RulesetManifest);
      }
    }
    return valid;
  } catch {
    return [];
  }
}

export function saveCustomRuleset(manifest: RulesetManifest): void {
  assertValidRuleset(manifest);
  if (typeof window === 'undefined' || !window.localStorage) return;
  const current = loadCustomRulesets().filter((r) => r.id !== manifest.id);
  current.push(manifest);
  window.localStorage.setItem(CUSTOM_RULESETS_STORAGE_KEY, JSON.stringify(current));
}

export function deleteCustomRuleset(id: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const current = loadCustomRulesets().filter((r) => r.id !== id);
  window.localStorage.setItem(CUSTOM_RULESETS_STORAGE_KEY, JSON.stringify(current));
}

export function getAllRulesets(): RulesetRegistryEntry[] {
  const builtInEntries: RulesetRegistryEntry[] = BUILTIN_RULESETS.map((m) => ({
    manifest: m,
    builtIn: true,
  }));
  const customEntries: RulesetRegistryEntry[] = loadCustomRulesets().map((m) => ({
    manifest: m,
    builtIn: false,
  }));
  return [...builtInEntries, ...customEntries];
}

export function getRulesetById(id: string): RulesetManifest | undefined {
  return getAllRulesets().find((e) => e.manifest.id === id)?.manifest;
}

export function exportRulesetJson(manifest: RulesetManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function importRulesetJson(jsonText: string): {
  manifest?: RulesetManifest;
  errors?: string[];
} {
  try {
    const parsed = JSON.parse(jsonText);
    const res = validateRulesetManifest(parsed);
    if (!res.valid) {
      return {
        errors: res.errors.map((e) => `${e.path || 'root'}: ${e.message}`),
      };
    }
    return { manifest: parsed as RulesetManifest };
  } catch (err) {
    return {
      errors: [err instanceof Error ? err.message : 'Invalid JSON syntax'],
    };
  }
}

export { CLASSIC_COLONY_RULESET };
