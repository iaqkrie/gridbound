import { t } from '../i18n';
import { SimulationCore } from './SimulationCore';
import { ResourceId, SerializedSimulationState } from './sdk';

export interface SaveSlot {
  id: string;
  name: string;
  rulesetId: string;
  rulesetName: string;
  cycle: number;
  resources: Record<ResourceId, number>;
  savedAt: string;
  snapshot: SerializedSimulationState;
}

class InMemorySaveStore {
  private slots: SaveSlot[] = [];
  private sequence = 1;

  public nextDefaultName(): string {
    return t('menu.defaultSaveName', { n: this.sequence });
  }

  public list(): SaveSlot[] {
    return [...this.slots];
  }

  public get(id: string): SaveSlot | undefined {
    return this.slots.find((s) => s.id === id);
  }

  public create(name: string, core: SimulationCore): SaveSlot {
    const cleanName = name.trim() || this.nextDefaultName();
    this.sequence += 1;

    const slot: SaveSlot = {
      id: `save-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      rulesetId: core.manifest.id,
      rulesetName: core.manifest.name,
      cycle: core.cycle,
      resources: core.getResources(),
      savedAt: formatSaveTime(new Date()),
      snapshot: core.serialize(),
    };

    this.slots = [slot, ...this.slots];
    return slot;
  }

  public update(id: string, core: SimulationCore): SaveSlot | null {
    const idx = this.slots.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const updated: SaveSlot = {
      ...this.slots[idx],
      cycle: core.cycle,
      resources: core.getResources(),
      savedAt: formatSaveTime(new Date()),
      snapshot: core.serialize(),
    };

    this.slots = [
      updated,
      ...this.slots.slice(0, idx),
      ...this.slots.slice(idx + 1),
    ];
    return updated;
  }

  public remove(id: string): void {
    this.slots = this.slots.filter((s) => s.id !== id);
  }
}

function formatSaveTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export const saveStore = new InMemorySaveStore();
