import {
  RulesetEntry,
  RulesetManifest,
  assertValidRuleset,
  cloneManifestWithUniqueId,
  createBlankManifest,
  validateRulesetManifest,
} from '../engine/sdk';
import classicColonyJson from './classic-colony/ruleset.json';

const STORAGE_KEY = 'gridbound_custom_rulesets_v2';

const BUILTIN_MANIFESTS: RulesetManifest[] = [
  assertValidRuleset(classicColonyJson),
];

const BUILTIN_IDS = new Set(BUILTIN_MANIFESTS.map((m) => m.id));

function readStoredCustomManifests(): RulesetManifest[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RulesetManifest =>
        validateRulesetManifest(item).valid && !BUILTIN_IDS.has(item.id)
    );
  } catch {
    return [];
  }
}

function writeStoredCustomManifests(list: RulesetManifest[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export interface RulesetImportResult {
  ok: boolean;
  entry?: RulesetEntry;
  errors?: string[];
}

class RulesetStore {
  private customManifests: RulesetManifest[] = readStoredCustomManifests();

  public list(): RulesetEntry[] {
    return [
      ...BUILTIN_MANIFESTS.map((manifest) => ({ manifest, isCustom: false })),
      ...this.customManifests.map((manifest) => ({ manifest, isCustom: true })),
    ];
  }

  public allIds(): string[] {
    return [
      ...BUILTIN_MANIFESTS.map((m) => m.id),
      ...this.customManifests.map((m) => m.id),
    ];
  }

  public isBuiltin(id: string): boolean {
    return BUILTIN_IDS.has(id);
  }

  public getById(id: string): RulesetManifest {
    const found =
      BUILTIN_MANIFESTS.find((m) => m.id === id) ??
      this.customManifests.find((m) => m.id === id);
    return found ?? BUILTIN_MANIFESTS[0];
  }

  public createBlankDraft(): RulesetManifest {
    return createBlankManifest(this.allIds());
  }

  public cloneDraft(sourceId: string): RulesetManifest {
    const source = this.getById(sourceId);
    return cloneManifestWithUniqueId(source, this.allIds());
  }

  public saveCustom(
    manifest: RulesetManifest,
    previousCustomId?: string | null
  ): RulesetImportResult {
    const validation = validateRulesetManifest(manifest);
    if (!validation.valid) {
      return { ok: false, errors: validation.errors };
    }

    if (BUILTIN_IDS.has(manifest.id)) {
      return {
        ok: false,
        errors: [
          `Ruleset id "${manifest.id}" conflicts with a built-in ruleset`,
        ],
      };
    }

    const cloned: RulesetManifest = JSON.parse(JSON.stringify(manifest));
    const filtered = this.customManifests.filter(
      (m) => m.id !== cloned.id && m.id !== previousCustomId
    );
    const existingIdx = this.customManifests.findIndex(
      (m) => m.id === (previousCustomId ?? cloned.id)
    );

    if (existingIdx >= 0 && existingIdx <= filtered.length) {
      filtered.splice(existingIdx, 0, cloned);
      this.customManifests = filtered;
    } else {
      this.customManifests = [...filtered, cloned];
    }

    writeStoredCustomManifests(this.customManifests);
    return { ok: true, entry: { manifest: cloned, isCustom: true } };
  }

  public importFromJson(rawJson: string): RulesetImportResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      return {
        ok: false,
        errors: [
          err instanceof Error
            ? `Invalid JSON: ${err.message}`
            : 'Invalid JSON file',
        ],
      };
    }

    return this.saveCustom(parsed as RulesetManifest);
  }

  public remove(id: string): boolean {
    if (BUILTIN_IDS.has(id)) return false;
    const prevLen = this.customManifests.length;
    this.customManifests = this.customManifests.filter((m) => m.id !== id);
    if (this.customManifests.length === prevLen) return false;
    writeStoredCustomManifests(this.customManifests);
    return true;
  }
}

export const rulesetStore = new RulesetStore();
