import { RulesetManifest, RuntimeValue, SerializedSimulationState } from './sdk';

const SAVES_STORAGE_KEY = 'gridbound_saves_v4';

export interface SaveSlotRecord {
  id: string;
  name: string;
  rulesetId: string;
  rulesetName: string;
  savedAt: number;
  cycle: number;
  width: number;
  height: number;
  hudSummary: { label: string; value: RuntimeValue; color?: string }[];
  snapshot: SerializedSimulationState;
}

export function listSaveSlots(): SaveSlotRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(SAVES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s && s.snapshot?.version === 4)
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  } catch {
    return [];
  }
}

export function saveGameSlot(
  snapshot: SerializedSimulationState,
  manifest: RulesetManifest,
  slotId?: string,
  customName?: string
): SaveSlotRecord {
  const existing = listSaveSlots();
  const id = slotId ?? `save_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const prev = existing.find((s) => s.id === id);

  const hudSummary = manifest.globalState.hud.slice(0, 4).map((item) => {
    const varDef = manifest.globalState.variables.find((v) => v.id === item.variableId);
    return {
      label: item.label ?? varDef?.shortName ?? varDef?.name ?? item.variableId,
      value: snapshot.globalValues[item.variableId] ?? 0,
      color: item.color ?? varDef?.color,
    };
  });

  const record: SaveSlotRecord = {
    id,
    name: customName ?? prev?.name ?? `${manifest.name} · Cycle ${snapshot.cycle}`,
    rulesetId: manifest.id,
    rulesetName: manifest.name,
    savedAt: Date.now(),
    cycle: snapshot.cycle,
    width: snapshot.width,
    height: snapshot.height,
    hudSummary,
    snapshot,
  };

  const next = [record, ...existing.filter((s) => s.id !== id)];
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(next));
  }
  return record;
}

export function deleteSaveSlot(id: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const next = listSaveSlots().filter((s) => s.id !== id);
  window.localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(next));
}
