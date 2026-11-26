import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  CellTypeManifest,
  PanelBlock,
  RulesetManifest,
  StatusTone,
} from '../../engine/sdk';
import {
  ActionListEditor,
  ConditionListEditor,
} from './RuleListEditor';
import {
  INPUT_CLS,
  MONO_INPUT_CLS,
  SELECT_CLS,
  createDefaultPanelBlock,
  moveArrayItem,
} from './editorHelpers';

interface CellPanelEditorProps {
  cell: CellTypeManifest;
  manifest: RulesetManifest;
  stateKeys: string[];
  allStateKeys: string[];
  onChange: (nextPanel: PanelBlock[] | undefined) => void;
}

export function CellPanelEditor({
  cell,
  manifest,
  stateKeys,
  allStateKeys,
  onChange,
}: CellPanelEditorProps) {
  const blocks = cell.panel ?? [];
  const stateKeyListId = 'panel-editor-state-keys';
  const allStateKeyListId = 'panel-editor-all-state-keys';

  const setBlocks = (next: PanelBlock[]) => {
    onChange(next.length > 0 ? next : undefined);
  };

  const updateAt = (idx: number, next: PanelBlock) => {
    const copy = [...blocks];
    copy[idx] = next;
    setBlocks(copy);
  };

  const addBlock = (type: PanelBlock['type']) => {
    setBlocks([
      ...blocks,
      createDefaultPanelBlock(type, manifest, stateKeys),
    ]);
  };

  const removeAt = (idx: number) => {
    setBlocks(blocks.filter((_, i) => i !== idx));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_296px] gap-6 items-start">
      <datalist id={stateKeyListId}>
        {stateKeys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <datalist id={allStateKeyListId}>
        {allStateKeys.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>

      {/* Left: Block Builder */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-[#E6EDF3]">
              Cell Popover Panel Blocks
            </h3>
            <p className="text-[11px] text-[#8B98A9] mt-0.5">
              Shown when an onClick rule runs Open cell panel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['stat', 'Stat'],
                ['transfer', 'Transfer'],
                ['resourceSelect', 'Resource Select'],
                ['actionButton', 'Action Button'],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {blocks.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-[#1F2A38] rounded-md px-4">
            <p className="text-xs text-[#8B98A9]">
              No panel blocks yet. Add a Stat, Transfer, Resource Select, or Action Button block above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block, idx) => (
              <div
                key={idx}
                className="bg-[#111720] border border-[#1F2A38] rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#17202B]/70 border-b border-[#1F2A38]">
                  <span className="font-mono text-xs font-semibold text-[#E6EDF3]">
                    #{idx + 1} · {block.type}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => setBlocks(moveArrayItem(blocks, idx, idx - 1))}
                      aria-label="Move block up"
                      className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === blocks.length - 1}
                      onClick={() => setBlocks(moveArrayItem(blocks, idx, idx + 1))}
                      aria-label="Move block down"
                      className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAt(idx)}
                      aria-label="Remove block"
                      className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="p-3 space-y-2.5">
                  {block.type === 'stat' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                            Label
                          </span>
                          <input
                            type="text"
                            value={block.label}
                            onChange={(e) =>
                              updateAt(idx, { ...block, label: e.target.value })
                            }
                            className={`${INPUT_CLS} w-full`}
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                            Value (or cycleOutput)
                          </span>
                          <input
                            type="text"
                            value={block.value}
                            onChange={(e) =>
                              updateAt(idx, { ...block, value: e.target.value })
                            }
                            placeholder="cycleOutput or {{state.key}}"
                            className={`${MONO_INPUT_CLS} w-full`}
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                            Tone
                          </span>
                          <select
                            value={block.tone ?? 'neutral'}
                            onChange={(e) =>
                              updateAt(idx, {
                                ...block,
                                tone: e.target.value as StatusTone,
                              })
                            }
                            className={`${SELECT_CLS} w-full`}
                          >
                            <option value="neutral">Neutral</option>
                            <option value="positive">Positive</option>
                            <option value="warning">Warning</option>
                            <option value="danger">Danger</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#1F2A38]">
                        <span className="block text-[10px] text-[#8B98A9] mb-1">
                          Show only when (optional)
                        </span>
                        <ConditionListEditor
                          conditions={block.when ?? []}
                          manifest={manifest}
                          stateKeys={stateKeys}
                          stateKeyListId={stateKeyListId}
                          onChange={(when) =>
                            updateAt(idx, {
                              ...block,
                              when: when.length > 0 ? when : undefined,
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  {block.type === 'transfer' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Label
                        </span>
                        <input
                          type="text"
                          value={block.label}
                          onChange={(e) =>
                            updateAt(idx, { ...block, label: e.target.value })
                          }
                          className={`${INPUT_CLS} w-full`}
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Resource Pool
                        </span>
                        <select
                          value={block.resource}
                          onChange={(e) =>
                            updateAt(idx, { ...block, resource: e.target.value })
                          }
                          className={`${SELECT_CLS} w-full`}
                        >
                          {manifest.resources.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.id})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Cell State Key
                        </span>
                        <input
                          type="text"
                          list={stateKeyListId}
                          value={block.stateKey}
                          onChange={(e) =>
                            updateAt(idx, { ...block, stateKey: e.target.value })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Min / Max / Step
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          <input
                            type="number"
                            value={block.min}
                            onChange={(e) =>
                              updateAt(idx, { ...block, min: Number(e.target.value) })
                            }
                            className={MONO_INPUT_CLS}
                            aria-label="Min"
                          />
                          <input
                            type="number"
                            value={block.max}
                            onChange={(e) =>
                              updateAt(idx, { ...block, max: Number(e.target.value) })
                            }
                            className={MONO_INPUT_CLS}
                            aria-label="Max"
                          />
                          <input
                            type="number"
                            min={1}
                            value={block.step ?? 1}
                            onChange={(e) =>
                              updateAt(idx, {
                                ...block,
                                step: Math.max(1, Number(e.target.value)),
                              })
                            }
                            className={MONO_INPUT_CLS}
                            aria-label="Step"
                          />
                        </div>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Assign Label
                        </span>
                        <input
                          type="text"
                          value={block.assignLabel ?? ''}
                          onChange={(e) =>
                            updateAt(idx, {
                              ...block,
                              assignLabel: e.target.value || undefined,
                            })
                          }
                          placeholder="Assign"
                          className={`${INPUT_CLS} w-full`}
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Remove Label
                        </span>
                        <input
                          type="text"
                          value={block.removeLabel ?? ''}
                          onChange={(e) =>
                            updateAt(idx, {
                              ...block,
                              removeLabel: e.target.value || undefined,
                            })
                          }
                          placeholder="Remove"
                          className={`${INPUT_CLS} w-full`}
                        />
                      </div>
                    </div>
                  )}

                  {block.type === 'resourceSelect' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Label
                        </span>
                        <input
                          type="text"
                          value={block.label ?? ''}
                          onChange={(e) =>
                            updateAt(idx, {
                              ...block,
                              label: e.target.value || undefined,
                            })
                          }
                          placeholder="Cap Bonus"
                          className={`${INPUT_CLS} w-full`}
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Bonus Text
                        </span>
                        <input
                          type="text"
                          value={block.bonusText ?? ''}
                          onChange={(e) =>
                            updateAt(idx, {
                              ...block,
                              bonusText: e.target.value || undefined,
                            })
                          }
                          placeholder="+100"
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          State Key
                        </span>
                        <input
                          type="text"
                          list={stateKeyListId}
                          value={block.stateKey}
                          onChange={(e) =>
                            updateAt(idx, { ...block, stateKey: e.target.value })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Filter Kind
                        </span>
                        <select
                          value={block.kind ?? ''}
                          onChange={(e) =>
                            updateAt(idx, {
                              ...block,
                              kind: (e.target.value || undefined) as
                                | 'capped'
                                | 'unlimited'
                                | undefined,
                            })
                          }
                          className={`${SELECT_CLS} w-full`}
                        >
                          <option value="">Any</option>
                          <option value="capped">Capped only</option>
                          <option value="unlimited">Unlimited only</option>
                        </select>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Filter Tag
                        </span>
                        <input
                          type="text"
                          value={block.tag ?? ''}
                          onChange={(e) =>
                            updateAt(idx, {
                              ...block,
                              tag: e.target.value || undefined,
                            })
                          }
                          placeholder="storable"
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                    </div>
                  )}

                  {block.type === 'actionButton' && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                            Button Label
                          </span>
                          <input
                            type="text"
                            value={block.label}
                            onChange={(e) =>
                              updateAt(idx, { ...block, label: e.target.value })
                            }
                            className={`${INPUT_CLS} w-full`}
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                            Button Style
                          </span>
                          <select
                            value={block.tone ?? 'primary'}
                            onChange={(e) =>
                              updateAt(idx, {
                                ...block,
                                tone: e.target.value as
                                  | 'primary'
                                  | 'neutral'
                                  | 'danger',
                              })
                            }
                            className={`${SELECT_CLS} w-full`}
                          >
                            <option value="primary">Primary (Emerald)</option>
                            <option value="neutral">Neutral</option>
                            <option value="danger">Danger (Rose)</option>
                          </select>
                        </div>
                        <div className="flex items-end pb-1.5">
                          <label className="inline-flex items-center gap-1.5 text-xs text-[#8B98A9] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(block.closeAfter)}
                              onChange={(e) =>
                                updateAt(idx, {
                                  ...block,
                                  closeAfter: e.target.checked || undefined,
                                })
                              }
                              className="accent-[#10B981]"
                            />
                            <span>Close after click</span>
                          </label>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#1F2A38]">
                        <span className="block text-[10px] text-[#8B98A9] mb-1">
                          Actions on click
                        </span>
                        <ActionListEditor
                          actions={block.do}
                          manifest={manifest}
                          stateKeys={stateKeys}
                          allStateKeys={allStateKeys}
                          stateKeyListId={stateKeyListId}
                          allStateKeyListId={allStateKeyListId}
                          allowUiActions={false}
                          onChange={(nextDo) =>
                            updateAt(idx, { ...block, do: nextDo })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Static Popover Mockup Preview */}
      <aside className="sticky top-4 space-y-2">
        <div className="text-[11px] font-medium text-[#8B98A9]">
          In-Game Popover Preview
        </div>
        <div className="w-[272px] bg-[#111720] border border-[#2D3C4E] rounded-lg overflow-hidden shadow-xl">
          <div className="px-3.5 py-2.5 border-b border-[#1F2A38] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                style={{ backgroundColor: cell.visual.color }}
              />
              <span className="text-xs font-semibold text-[#E6EDF3] truncate">
                {cell.name}
              </span>
            </div>
            <span className="font-mono text-[10px] text-[#8B98A9]">4, 7</span>
          </div>

          <div className="p-3.5 space-y-2.5">
            {blocks.length === 0 ? (
              <div className="text-[11px] text-[#8B98A9] text-center py-4">
                Empty panel
              </div>
            ) : (
              blocks.map((block, idx) => {
                if (block.type === 'stat') {
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-[#8B98A9]">{block.label}</span>
                      <span className="font-mono text-[#E6EDF3]">
                        {block.value === 'cycleOutput' ? '+3' : block.value}
                      </span>
                    </div>
                  );
                }
                if (block.type === 'transfer') {
                  return (
                    <div
                      key={idx}
                      className="pt-2 border-t border-[#1F2A38] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8B98A9]">{block.label}</span>
                        <span className="font-mono text-[#10B981]">
                          {block.min} / {block.max}
                        </span>
                      </div>
                      <div className="w-full py-1.5 text-center text-xs font-semibold text-[#0B0F14] bg-[#10B981] rounded-md">
                        {block.assignLabel || 'Assign'}
                      </div>
                    </div>
                  );
                }
                if (block.type === 'resourceSelect') {
                  return (
                    <div
                      key={idx}
                      className="pt-2 border-t border-[#1F2A38] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#8B98A9]">
                        <span>{block.label || 'Select'}</span>
                        <span className="font-mono text-[#E6EDF3]">
                          {block.bonusText}
                        </span>
                      </div>
                      {manifest.resources
                        .filter(
                          (r) =>
                            (!block.kind || r.kind === block.kind) &&
                            (!block.tag || (r.tags ?? []).includes(block.tag))
                        )
                        .slice(0, 3)
                        .map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#0B0F14] border border-[#1F2A38] text-[11px]"
                          >
                            <span className="inline-flex items-center gap-1.5 text-[#E6EDF3]">
                              <span
                                className="w-2 h-2 rounded-[2px]"
                                style={{ backgroundColor: r.color }}
                              />
                              {r.name}
                            </span>
                            <span className="font-mono text-[#8B98A9]">
                              {r.initialValue}
                            </span>
                          </div>
                        ))}
                    </div>
                  );
                }
                if (block.type === 'actionButton') {
                  return (
                    <div
                      key={idx}
                      className="pt-2 border-t border-[#1F2A38]"
                    >
                      <div
                        className={`w-full py-1.5 text-center text-xs font-semibold rounded-md ${
                          block.tone === 'danger'
                            ? 'bg-[#F43F5E] text-[#E6EDF3]'
                            : block.tone === 'neutral'
                              ? 'bg-[#17202B] text-[#E6EDF3] border border-[#2D3C4E]'
                              : 'bg-[#10B981] text-[#0B0F14]'
                        }`}
                      >
                        {block.label}
                      </div>
                    </div>
                  );
                }
                return null;
              })
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
