import { useState } from 'react';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import {
  CellBadgeRule,
  CellIcon,
  CellModifier,
  CellStateValue,
  CellTypeManifest,
  ICON_REGISTRY,
  Rule,
  RulesetManifest,
  StatusTone,
  VisualIndicator,
  VisualRule,
} from '../../engine/sdk';
import { CellPanelEditor } from './CellPanelEditor';
import { CellTilePreview } from './CellTilePreview';
import { IconPicker } from './IconPicker';
import { ConditionListEditor, RuleListEditor } from './RuleListEditor';
import { INPUT_CLS, MONO_INPUT_CLS, SELECT_CLS } from './editorHelpers';

type CellTab = 'basics' | 'events' | 'panel' | 'json';
type EventKey =
  | 'onCycle'
  | 'onClickLeft'
  | 'onClickRight'
  | 'onBuild'
  | 'onDemolish'
  | 'onLost';

interface CellEditorProps {
  cell: CellTypeManifest;
  manifest: RulesetManifest;
  canDelete: boolean;
  onChangeCell: (next: CellTypeManifest) => void;
  onRenameCellId: (oldId: string, rawNewId: string) => void;
  onDuplicateCell: () => void;
  onDeleteCell: () => void;
}

const EVENT_TABS: { key: EventKey; label: string; hint: string }[] = [
  {
    key: 'onCycle',
    label: 'onCycle',
    hint: 'Runs once every cycle to consume/produce resources, emit supplies, update state, or transform.',
  },
  {
    key: 'onClickLeft',
    label: 'Left Click',
    hint: 'Runs when the player left-clicks this tile (e.g. open build menu, open cell panel, or toggle state).',
  },
  {
    key: 'onClickRight',
    label: 'Right Click',
    hint: 'Runs when the player right-clicks this tile (e.g. open demolish confirmation).',
  },
  {
    key: 'onBuild',
    label: 'onBuild',
    hint: 'Runs immediately after this cell is built on the grid.',
  },
  {
    key: 'onDemolish',
    label: 'onDemolish',
    hint: 'Runs when the player demolishes this cell (e.g. partial cost refund, freeing workers).',
  },
  {
    key: 'onLost',
    label: 'onLost',
    hint: 'Runs when this cell transforms into another type during a cycle (e.g. starvation collapse).',
  },
];

export function CellEditor({
  cell,
  manifest,
  canDelete,
  onChangeCell,
  onRenameCellId,
  onDuplicateCell,
  onDeleteCell,
}: CellEditorProps) {
  const [tab, setTab] = useState<CellTab>('basics');
  const [eventKey, setEventKey] = useState<EventKey>('onCycle');
  const [newStateKey, setNewStateKey] = useState('');
  const [newStateType, setNewStateType] = useState<'number' | 'string' | 'boolean'>('number');
  const [copied, setCopied] = useState(false);

  const stateKeys = Object.keys(cell.initialState ?? {});
  const allStateKeys = Array.from(
    new Set(
      manifest.cellTypes.flatMap((c) => Object.keys(c.initialState ?? {}))
    )
  );
  const stateKeyListId = 'cell-visual-state-keys';

  const getEventRules = (key: EventKey): Rule[] => {
    switch (key) {
      case 'onCycle':
        return cell.onCycle ?? [];
      case 'onClickLeft':
        return cell.onClick?.left ?? [];
      case 'onClickRight':
        return cell.onClick?.right ?? [];
      case 'onBuild':
        return cell.onBuild ?? [];
      case 'onDemolish':
        return cell.onDemolish ?? [];
      case 'onLost':
        return cell.onLost ?? [];
    }
  };

  const setEventRules = (key: EventKey, next: Rule[]) => {
    const cleaned = next.length > 0 ? next : undefined;
    switch (key) {
      case 'onCycle':
        onChangeCell({ ...cell, onCycle: cleaned });
        break;
      case 'onClickLeft': {
        const nextClick = {
          ...(cell.onClick ?? {}),
          left: cleaned,
        };
        onChangeCell({
          ...cell,
          onClick: nextClick.left || nextClick.right ? nextClick : undefined,
        });
        break;
      }
      case 'onClickRight': {
        const nextClick = {
          ...(cell.onClick ?? {}),
          right: cleaned,
        };
        onChangeCell({
          ...cell,
          onClick: nextClick.left || nextClick.right ? nextClick : undefined,
        });
        break;
      }
      case 'onBuild':
        onChangeCell({ ...cell, onBuild: cleaned });
        break;
      case 'onDemolish':
        onChangeCell({ ...cell, onDemolish: cleaned });
        break;
      case 'onLost':
        onChangeCell({ ...cell, onLost: cleaned });
        break;
    }
  };

  // Build Cost helpers
  const setBuildCostValue = (resId: string, amount: number) => {
    const next = { ...(cell.buildCost ?? {}) };
    if (amount <= 0 || Number.isNaN(amount)) {
      delete next[resId];
    } else {
      next[resId] = amount;
    }
    onChangeCell({
      ...cell,
      buildCost: Object.keys(next).length > 0 ? next : undefined,
    });
  };

  // Initial State helpers
  const addStateEntry = () => {
    const key = newStateKey.trim().replace(/\s+/g, '_');
    if (!key) return;
    const defaultVal: CellStateValue =
      newStateType === 'number' ? 0 : newStateType === 'boolean' ? false : '';
    onChangeCell({
      ...cell,
      initialState: {
        ...(cell.initialState ?? {}),
        [key]: defaultVal,
      },
    });
    setNewStateKey('');
  };

  const updateStateValue = (key: string, value: CellStateValue) => {
    onChangeCell({
      ...cell,
      initialState: {
        ...(cell.initialState ?? {}),
        [key]: value,
      },
    });
  };

  const removeStateEntry = (key: string) => {
    const next = { ...(cell.initialState ?? {}) };
    delete next[key];
    onChangeCell({
      ...cell,
      initialState: Object.keys(next).length > 0 ? next : undefined,
    });
  };

  // Passive Modifiers
  const modifiers = cell.modifiers ?? [];
  const addModifier = () => {
    const mod: CellModifier = {
      type: 'capBonus',
      resource: manifest.resources[0]?.id,
      amount: 100,
    };
    onChangeCell({ ...cell, modifiers: [...modifiers, mod] });
  };

  // Visual Rules
  const visualRules = cell.visual.rules ?? [];
  const addVisualRule = () => {
    const rule: VisualRule = {
      when: [],
      border: 'solid',
      dim: false,
    };
    onChangeCell({
      ...cell,
      visual: { ...cell.visual, rules: [...visualRules, rule] },
    });
  };

  // Visual Indicators
  const indicators = cell.visual.indicators ?? [];
  const addIndicator = (kind: 'dot' | 'bar') => {
    const ind: VisualIndicator =
      kind === 'dot'
        ? {
            kind: 'dot',
            position: 'bottomRight',
            color: '#10B981',
            inactiveColor: '#8B98A9',
            when: [],
          }
        : {
            kind: 'bar',
            color: '#10B981',
            when: [],
          };
    onChangeCell({
      ...cell,
      visual: { ...cell.visual, indicators: [...indicators, ind] },
    });
  };

  // Hover Badges
  const badges = cell.badges ?? [];
  const addBadge = () => {
    const badge: CellBadgeRule = {
      text: 'Active',
      tone: 'positive',
      when: [],
    };
    onChangeCell({ ...cell, badges: [...badges, badge] });
  };

  const totalEventRules = EVENT_TABS.reduce(
    (sum, ev) => sum + getEventRules(ev.key).length,
    0
  );

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(cell, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard may be restricted in iframe
    }
  };

  return (
    <div className="space-y-5">
      <datalist id={stateKeyListId}>
        {stateKeys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>

      {/* Cell Header + Live Preview + Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1F2A38]">
        <div className="flex items-center gap-3.5 min-w-0">
          <CellTilePreview visual={cell.visual} size={46} />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#E6EDF3] truncate">
              {cell.name || 'Unnamed Cell'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#8B98A9] mt-0.5">
              <span className="font-mono">{cell.id}</span>
              {manifest.defaultCellTypeId === cell.id && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#10B981]">Default tile</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#111720] p-1 rounded-md border border-[#1F2A38]">
            {(
              [
                ['basics', 'Basics & Visuals'],
                ['events', `Events (${totalEventRules})`],
                ['panel', `Panel (${cell.panel?.length ?? 0})`],
                ['json', 'JSON'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  tab === key
                    ? 'bg-[#17202B] text-[#E6EDF3]'
                    : 'text-[#8B98A9] hover:text-[#E6EDF3]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onDuplicateCell}
            title="Duplicate cell"
            aria-label="Duplicate cell"
            className="p-2 text-[#8B98A9] hover:text-[#E6EDF3] bg-[#111720] hover:bg-[#17202B] border border-[#1F2A38] rounded-md transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            disabled={!canDelete}
            onClick={onDeleteCell}
            title={
              canDelete
                ? 'Delete cell'
                : 'Cannot delete the default or last remaining cell'
            }
            aria-label="Delete cell"
            className="p-2 text-[#8B98A9] hover:text-[#F43F5E] bg-[#111720] hover:bg-[#17202B] border border-[#1F2A38] rounded-md transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* TAB 1: BASICS & VISUALS */}
      {tab === 'basics' && (
        <div className="max-w-4xl space-y-7">
          {/* Basic Identity & Build Cost */}
          <section className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[11px] font-medium text-[#8B98A9] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={cell.name}
                  onChange={(e) => onChangeCell({ ...cell, name: e.target.value })}
                  className={`${INPUT_CLS} w-full`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8B98A9] mb-1">
                  Cell ID (cascade rename)
                </label>
                <input
                  type="text"
                  defaultValue={cell.id}
                  key={cell.id}
                  onBlur={(e) => onRenameCellId(cell.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onRenameCellId(cell.id, e.currentTarget.value);
                    }
                  }}
                  className={`${MONO_INPUT_CLS} w-full`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8B98A9] mb-1">
                  Demolish Becomes
                </label>
                <select
                  value={cell.demolishTo ?? ''}
                  onChange={(e) =>
                    onChangeCell({
                      ...cell,
                      demolishTo: e.target.value || undefined,
                    })
                  }
                  className={`${SELECT_CLS} w-full`}
                >
                  <option value="">Default ({manifest.defaultCellTypeId})</option>
                  {manifest.cellTypes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-medium text-[#8B98A9] mb-1">
                  Short Rule Summary (shown in build menu / hover)
                </label>
                <input
                  type="text"
                  value={cell.shortRule ?? ''}
                  onChange={(e) =>
                    onChangeCell({
                      ...cell,
                      shortRule: e.target.value || undefined,
                    })
                  }
                  placeholder="e.g. +3 Food / cycle"
                  className={`${INPUT_CLS} w-full`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#8B98A9] mb-1">
                  Tick Priority State Key (optional)
                </label>
                <input
                  type="text"
                  list={stateKeyListId}
                  value={cell.priorityByState ?? ''}
                  onChange={(e) =>
                    onChangeCell({
                      ...cell,
                      priorityByState: e.target.value || undefined,
                    })
                  }
                  placeholder="e.g. hunger (higher runs first)"
                  className={`${MONO_INPUT_CLS} w-full`}
                />
              </div>
            </div>

            {manifest.resources.length > 0 && (
              <div>
                <span className="block text-[11px] font-medium text-[#8B98A9] mb-1.5">
                  Build Cost (leave 0 if free)
                </span>
                <div className="flex flex-wrap gap-2">
                  {manifest.resources.map((res) => (
                    <label
                      key={res.id}
                      className="inline-flex items-center gap-2 bg-[#111720] border border-[#1F2A38] rounded-md px-2.5 py-1.5"
                    >
                      <span
                        className="w-2 h-2 rounded-[2px] shrink-0"
                        style={{ backgroundColor: res.color }}
                      />
                      <span className="text-xs text-[#E6EDF3]">
                        {res.shortName ?? res.name}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={cell.buildCost?.[res.id] ?? 0}
                        onChange={(e) =>
                          setBuildCostValue(res.id, Number(e.target.value))
                        }
                        className={`${MONO_INPUT_CLS} w-16 py-0.5`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Local Cell State (initialState) */}
          <section className="pt-5 border-t border-[#1F2A38] space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-[#E6EDF3]">
                Local Cell State (initialState)
              </h3>
              <p className="text-[11px] text-[#8B98A9] mt-0.5">
                Per-tile variables initialized when built (e.g. worker = 0, hunger = 0, level = 1). Suggested automatically in rules and panels.
              </p>
            </div>

            {stateKeys.length > 0 && (
              <div className="space-y-1.5">
                {stateKeys.map((key) => {
                  const val = cell.initialState![key];
                  const valType = typeof val;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 bg-[#111720] border border-[#1F2A38] rounded-md px-3 py-1.5"
                    >
                      <span className="font-mono text-xs text-[#E6EDF3] w-36 truncate">
                        {key}
                      </span>
                      <span className="text-[11px] text-[#8B98A9] w-16">
                        {valType}
                      </span>
                      {valType === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => updateStateValue(key, e.target.checked)}
                          className="accent-[#10B981]"
                        />
                      ) : valType === 'number' ? (
                        <input
                          type="number"
                          value={Number(val)}
                          onChange={(e) =>
                            updateStateValue(key, Number(e.target.value))
                          }
                          className={`${MONO_INPUT_CLS} w-28`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(val)}
                          onChange={(e) => updateStateValue(key, e.target.value)}
                          placeholder="empty string"
                          className={`${MONO_INPUT_CLS} w-40`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeStateEntry(key)}
                        aria-label={`Remove state ${key}`}
                        className="ml-auto p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newStateKey}
                onChange={(e) => setNewStateKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addStateEntry();
                  }
                }}
                placeholder="New variable name (e.g. worker)"
                className={`${MONO_INPUT_CLS} w-52`}
              />
              <select
                value={newStateType}
                onChange={(e) =>
                  setNewStateType(
                    e.target.value as 'number' | 'string' | 'boolean'
                  )
                }
                className={SELECT_CLS}
              >
                <option value="number">Number</option>
                <option value="string">String</option>
                <option value="boolean">Boolean</option>
              </select>
              <button
                type="button"
                onClick={addStateEntry}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Variable</span>
              </button>
            </div>
          </section>

          {/* Passive Modifiers (capBonus) */}
          <section className="pt-5 border-t border-[#1F2A38] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-[#E6EDF3]">
                  Passive Modifiers (Cap Bonus)
                </h3>
                <p className="text-[11px] text-[#8B98A9] mt-0.5">
                  Increase a capped resource limit while this cell exists on the grid.
                </p>
              </div>
              <button
                type="button"
                onClick={addModifier}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Cap Bonus</span>
              </button>
            </div>

            {modifiers.map((mod, idx) => {
              const dynamic = Boolean(mod.resourceFromState);
              return (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 bg-[#111720] border border-[#1F2A38] rounded-md p-2.5"
                >
                  <select
                    value={dynamic ? 'state' : 'fixed'}
                    onChange={(e) => {
                      const next = [...modifiers];
                      next[idx] =
                        e.target.value === 'state'
                          ? {
                              type: 'capBonus',
                              resourceFromState: stateKeys[0] ?? 'storageResource',
                              amount: mod.amount,
                            }
                          : {
                              type: 'capBonus',
                              resource: manifest.resources[0]?.id,
                              amount: mod.amount,
                            };
                      onChangeCell({ ...cell, modifiers: next });
                    }}
                    className={SELECT_CLS}
                  >
                    <option value="fixed">Fixed Resource</option>
                    <option value="state">From Cell State</option>
                  </select>

                  {dynamic ? (
                    <input
                      type="text"
                      list={stateKeyListId}
                      value={mod.resourceFromState ?? ''}
                      onChange={(e) => {
                        const next = [...modifiers];
                        next[idx] = {
                          type: 'capBonus',
                          resourceFromState: e.target.value,
                          amount: mod.amount,
                        };
                        onChangeCell({ ...cell, modifiers: next });
                      }}
                      placeholder="stateKey"
                      className={`${MONO_INPUT_CLS} w-36`}
                    />
                  ) : (
                    <select
                      value={mod.resource ?? ''}
                      onChange={(e) => {
                        const next = [...modifiers];
                        next[idx] = {
                          type: 'capBonus',
                          resource: e.target.value,
                          amount: mod.amount,
                        };
                        onChangeCell({ ...cell, modifiers: next });
                      }}
                      className={SELECT_CLS}
                    >
                      {manifest.resources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.id})
                        </option>
                      ))}
                    </select>
                  )}

                  <span className="text-xs text-[#8B98A9]">+</span>
                  <input
                    type="number"
                    value={mod.amount}
                    onChange={(e) => {
                      const next = [...modifiers];
                      next[idx] = { ...mod, amount: Number(e.target.value) };
                      onChangeCell({ ...cell, modifiers: next });
                    }}
                    className={`${MONO_INPUT_CLS} w-20`}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const next = modifiers.filter((_, i) => i !== idx);
                      onChangeCell({
                        ...cell,
                        modifiers: next.length > 0 ? next : undefined,
                      });
                    }}
                    aria-label="Remove modifier"
                    className="ml-auto p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </section>

          {/* Visuals & Icon Gallery */}
          <section className="pt-5 border-t border-[#1F2A38] space-y-4">
            <h3 className="text-xs font-semibold text-[#E6EDF3]">
              Appearance & Icon
            </h3>
            <IconPicker
              visual={cell.visual}
              onChange={(visual) => onChangeCell({ ...cell, visual })}
            />
          </section>

          {/* Conditional Visual Rules */}
          <section className="pt-5 border-t border-[#1F2A38] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-[#E6EDF3]">
                  Conditional Visual Rules
                </h3>
                <p className="text-[11px] text-[#8B98A9] mt-0.5">
                  First matching rule overrides color, border, opacity, icon, or glyph.
                </p>
              </div>
              <button
                type="button"
                onClick={addVisualRule}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Style Rule</span>
              </button>
            </div>

            {visualRules.map((vr, idx) => (
              <div
                key={idx}
                className="bg-[#111720] border border-[#1F2A38] rounded-md p-3 space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-[#8B98A9]">
                    #{idx + 1}
                  </span>
                  <input
                    type="color"
                    value={
                      vr.color && /^#[0-9a-fA-F]{6}$/.test(vr.color)
                        ? vr.color
                        : cell.visual.color
                    }
                    onChange={(e) => {
                      const next = [...visualRules];
                      next[idx] = { ...vr, color: e.target.value };
                      onChangeCell({
                        ...cell,
                        visual: { ...cell.visual, rules: next },
                      });
                    }}
                    className="w-6 h-6 bg-transparent border border-[#1F2A38] rounded cursor-pointer"
                    title="Override color"
                  />
                  <select
                    value={vr.border ?? ''}
                    onChange={(e) => {
                      const next = [...visualRules];
                      next[idx] = {
                        ...vr,
                        border: (e.target.value || undefined) as
                          | 'solid'
                          | 'dashed'
                          | undefined,
                      };
                      onChangeCell({
                        ...cell,
                        visual: { ...cell.visual, rules: next },
                      });
                    }}
                    className={SELECT_CLS}
                  >
                    <option value="">Keep border</option>
                    <option value="solid">Solid border</option>
                    <option value="dashed">Dashed border</option>
                  </select>
                  <select
                    value={vr.dim === undefined ? '' : String(vr.dim)}
                    onChange={(e) => {
                      const next = [...visualRules];
                      next[idx] = {
                        ...vr,
                        dim:
                          e.target.value === ''
                            ? undefined
                            : e.target.value === 'true',
                      };
                      onChangeCell({
                        ...cell,
                        visual: { ...cell.visual, rules: next },
                      });
                    }}
                    className={SELECT_CLS}
                  >
                    <option value="">Keep opacity</option>
                    <option value="false">Bright</option>
                    <option value="true">Dim</option>
                  </select>
                  <select
                    value={vr.icon ?? ''}
                    onChange={(e) => {
                      const next = [...visualRules];
                      next[idx] = {
                        ...vr,
                        icon: (e.target.value || undefined) as
                          | CellIcon
                          | undefined,
                      };
                      onChangeCell({
                        ...cell,
                        visual: { ...cell.visual, rules: next },
                      });
                    }}
                    className={SELECT_CLS}
                  >
                    <option value="">Keep icon</option>
                    {ICON_REGISTRY.map((ic) => (
                      <option key={ic.id} value={ic.id}>
                        {ic.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    maxLength={2}
                    value={vr.glyph ?? ''}
                    onChange={(e) => {
                      const next = [...visualRules];
                      next[idx] = {
                        ...vr,
                        glyph: e.target.value || undefined,
                      };
                      onChangeCell({
                        ...cell,
                        visual: { ...cell.visual, rules: next },
                      });
                    }}
                    placeholder="Glyph"
                    className={`${MONO_INPUT_CLS} w-16`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = visualRules.filter((_, i) => i !== idx);
                      onChangeCell({
                        ...cell,
                        visual: {
                          ...cell.visual,
                          rules: next.length > 0 ? next : undefined,
                        },
                      });
                    }}
                    aria-label="Remove style rule"
                    className="ml-auto p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <ConditionListEditor
                  conditions={vr.when ?? []}
                  manifest={manifest}
                  stateKeys={stateKeys}
                  stateKeyListId={stateKeyListId}
                  onChange={(when) => {
                    const next = [...visualRules];
                    next[idx] = {
                      ...vr,
                      when: when.length > 0 ? when : undefined,
                    };
                    onChangeCell({
                      ...cell,
                      visual: { ...cell.visual, rules: next },
                    });
                  }}
                />
              </div>
            ))}
          </section>

          {/* Indicators (dot / bar) */}
          <section className="pt-5 border-t border-[#1F2A38] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-[#E6EDF3]">
                Tile Indicators
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => addIndicator('dot')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md cursor-pointer"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  <span>Dot</span>
                </button>
                <button
                  type="button"
                  onClick={() => addIndicator('bar')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md cursor-pointer"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  <span>Bar</span>
                </button>
              </div>
            </div>

            {indicators.map((ind, idx) => (
              <div
                key={idx}
                className="bg-[#111720] border border-[#1F2A38] rounded-md p-3 space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-[#E6EDF3]">
                    {ind.kind}
                  </span>
                  {ind.kind === 'dot' ? (
                    <>
                      <select
                        value={ind.position}
                        onChange={(e) => {
                          const next = [...indicators];
                          next[idx] = {
                            ...ind,
                            position: e.target.value as
                              | 'bottomRight'
                              | 'topLeft'
                              | 'bottomLeft',
                          };
                          onChangeCell({
                            ...cell,
                            visual: { ...cell.visual, indicators: next },
                          });
                        }}
                        className={SELECT_CLS}
                      >
                        <option value="bottomRight">Bottom-Right</option>
                        <option value="bottomLeft">Bottom-Left</option>
                        <option value="topLeft">Top-Left</option>
                      </select>
                      <span className="text-[11px] text-[#8B98A9]">Active</span>
                      <input
                        type="color"
                        value={ind.color}
                        onChange={(e) => {
                          const next = [...indicators];
                          next[idx] = { ...ind, color: e.target.value };
                          onChangeCell({
                            ...cell,
                            visual: { ...cell.visual, indicators: next },
                          });
                        }}
                        className="w-6 h-6 bg-transparent border border-[#1F2A38] rounded cursor-pointer"
                      />
                      <span className="text-[11px] text-[#8B98A9]">
                        Inactive
                      </span>
                      <input
                        type="color"
                        value={ind.inactiveColor ?? '#8B98A9'}
                        onChange={(e) => {
                          const next = [...indicators];
                          next[idx] = { ...ind, inactiveColor: e.target.value };
                          onChangeCell({
                            ...cell,
                            visual: { ...cell.visual, indicators: next },
                          });
                        }}
                        className="w-6 h-6 bg-transparent border border-[#1F2A38] rounded cursor-pointer"
                      />
                    </>
                  ) : (
                    <>
                      <input
                        type="color"
                        value={ind.color ?? cell.visual.color}
                        onChange={(e) => {
                          const next = [...indicators];
                          next[idx] = { ...ind, color: e.target.value };
                          onChangeCell({
                            ...cell,
                            visual: { ...cell.visual, indicators: next },
                          });
                        }}
                        className="w-6 h-6 bg-transparent border border-[#1F2A38] rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        list={stateKeyListId}
                        value={ind.colorFromResourceState ?? ''}
                        onChange={(e) => {
                          const next = [...indicators];
                          next[idx] = {
                            ...ind,
                            colorFromResourceState: e.target.value || undefined,
                          };
                          onChangeCell({
                            ...cell,
                            visual: { ...cell.visual, indicators: next },
                          });
                        }}
                        placeholder="colorFromResourceState (optional)"
                        className={`${MONO_INPUT_CLS} w-52`}
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const next = indicators.filter((_, i) => i !== idx);
                      onChangeCell({
                        ...cell,
                        visual: {
                          ...cell.visual,
                          indicators: next.length > 0 ? next : undefined,
                        },
                      });
                    }}
                    aria-label="Remove indicator"
                    className="ml-auto p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <ConditionListEditor
                  conditions={ind.when ?? []}
                  manifest={manifest}
                  stateKeys={stateKeys}
                  stateKeyListId={stateKeyListId}
                  onChange={(when) => {
                    const next = [...indicators];
                    next[idx] = {
                      ...ind,
                      when: when.length > 0 ? when : undefined,
                    };
                    onChangeCell({
                      ...cell,
                      visual: { ...cell.visual, indicators: next },
                    });
                  }}
                />
              </div>
            ))}
          </section>

          {/* Hover Badges */}
          <section className="pt-5 border-t border-[#1F2A38] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-[#E6EDF3]">
                Hover Status Badges
              </h3>
              <button
                type="button"
                onClick={addBadge}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Badge</span>
              </button>
            </div>

            {badges.map((badge, idx) => (
              <div
                key={idx}
                className="bg-[#111720] border border-[#1F2A38] rounded-md p-3 space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={badge.text}
                    onChange={(e) => {
                      const next = [...badges];
                      next[idx] = { ...badge, text: e.target.value };
                      onChangeCell({ ...cell, badges: next });
                    }}
                    placeholder="Text (e.g. W {{state.worker}}/1)"
                    className={`${INPUT_CLS} flex-1 min-w-[180px]`}
                  />
                  <select
                    value={badge.tone ?? 'neutral'}
                    onChange={(e) => {
                      const next = [...badges];
                      next[idx] = {
                        ...badge,
                        tone: e.target.value as StatusTone,
                      };
                      onChangeCell({ ...cell, badges: next });
                    }}
                    className={SELECT_CLS}
                  >
                    <option value="neutral">Neutral</option>
                    <option value="positive">Positive</option>
                    <option value="warning">Warning</option>
                    <option value="danger">Danger</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const next = badges.filter((_, i) => i !== idx);
                      onChangeCell({
                        ...cell,
                        badges: next.length > 0 ? next : undefined,
                      });
                    }}
                    aria-label="Remove badge"
                    className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <ConditionListEditor
                  conditions={badge.when ?? []}
                  manifest={manifest}
                  stateKeys={stateKeys}
                  stateKeyListId={stateKeyListId}
                  onChange={(when) => {
                    const next = [...badges];
                    next[idx] = {
                      ...badge,
                      when: when.length > 0 ? when : undefined,
                    };
                    onChangeCell({ ...cell, badges: next });
                  }}
                />
              </div>
            ))}
          </section>
        </div>
      )}

      {/* TAB 2: EVENTS & LOGIC */}
      {tab === 'events' && (
        <div className="max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#1F2A38] pb-3">
            {EVENT_TABS.map((ev) => {
              const count = getEventRules(ev.key).length;
              const active = eventKey === ev.key;
              return (
                <button
                  key={ev.key}
                  type="button"
                  onClick={() => setEventKey(ev.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#17202B] border-[#10B981] text-[#E6EDF3]'
                      : 'bg-[#111720] border-[#1F2A38] text-[#8B98A9] hover:text-[#E6EDF3]'
                  }`}
                >
                  <span>{ev.label}</span>
                  <span className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[#8B98A9]">
            {EVENT_TABS.find((e) => e.key === eventKey)?.hint}
          </p>

          <RuleListEditor
            rules={getEventRules(eventKey)}
            manifest={manifest}
            stateKeys={stateKeys}
            allStateKeys={allStateKeys}
            allowUiActions={
              eventKey === 'onClickLeft' || eventKey === 'onClickRight'
            }
            showInspectorMeta={eventKey === 'onCycle'}
            onChange={(next) => setEventRules(eventKey, next)}
          />
        </div>
      )}

      {/* TAB 3: CELL PANEL */}
      {tab === 'panel' && (
        <CellPanelEditor
          cell={cell}
          manifest={manifest}
          stateKeys={stateKeys}
          allStateKeys={allStateKeys}
          onChange={(nextPanel) => onChangeCell({ ...cell, panel: nextPanel })}
        />
      )}

      {/* TAB 4: READ-ONLY JSON */}
      {tab === 'json' && (
        <div className="max-w-4xl space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#8B98A9]">
              Generated Schema v2 JSON for <span className="font-mono text-[#E6EDF3]">{cell.id}</span>
            </span>
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre className="bg-[#111720] border border-[#1F2A38] rounded-lg p-4 font-mono text-[11px] text-[#E6EDF3]/90 overflow-x-auto max-h-[65vh] leading-relaxed">
            {JSON.stringify(cell, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
