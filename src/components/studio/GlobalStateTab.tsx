import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  AccessLevel,
  GlobalVariableManifest,
  HudItemManifest,
  RulesetManifest,
  ValueType,
} from '../../engine/sdk';
import { NodeGraphEditor } from './NodeGraphEditor';
import { makeUniqueId } from './studioUtils';
import { NumberInput } from './NumberInput';

interface GlobalStateTabProps {
  manifest: RulesetManifest;
  readOnly?: boolean;
  onChange: (next: RulesetManifest) => void;
}

type GlobalSubTab = 'variables' | 'hud' | 'graph';

const INPUT_CLASS =
  'w-full bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded px-2.5 py-1.5 text-xs text-[#E6EDF3] focus:outline-none disabled:opacity-60';

export function GlobalStateTab({
  manifest,
  readOnly,
  onChange,
}: GlobalStateTabProps) {
  const [subTab, setSubTab] = useState<GlobalSubTab>('variables');
  const { variables, hud, graph } = manifest.globalState;

  const updateGlobalState = (
    patch: Partial<RulesetManifest['globalState']>
  ) => {
    if (readOnly) return;
    onChange({
      ...manifest,
      globalState: { ...manifest.globalState, ...patch },
    });
  };

  const addVariable = () => {
    const id = makeUniqueId(
      'var',
      variables.map((v) => v.id)
    );
    const nextVar: GlobalVariableManifest = {
      id,
      name: `Variable ${variables.length + 1}`,
      type: 'number',
      initialValue: 0,
      hasCap: false,
      allowNegative: false,
      access: 'public',
      color: '#38bdf8',
    };
    updateGlobalState({ variables: [...variables, nextVar] });
  };

  const updateVariable = (
    idx: number,
    patch: Partial<GlobalVariableManifest>
  ) => {
    const next = [...variables];
    next[idx] = { ...next[idx], ...patch };
    updateGlobalState({ variables: next });
  };

  const deleteVariable = (idx: number) => {
    const removedId = variables[idx]?.id;
    updateGlobalState({
      variables: variables.filter((_, i) => i !== idx),
      hud: hud.filter((h) => h.variableId !== removedId),
    });
  };

  const addHudItem = () => {
    const firstVar =
      variables.find((v) => !hud.some((h) => h.variableId === v.id)) ??
      variables[0];
    if (!firstVar) return;
    const item: HudItemManifest = {
      variableId: firstVar.id,
      label: firstVar.shortName ?? firstVar.name,
      color: firstVar.color,
      showCap: Boolean(firstVar.hasCap),
      showDelta: firstVar.type === 'number',
    };
    updateGlobalState({ hud: [...hud, item] });
  };

  const updateHudItem = (idx: number, patch: Partial<HudItemManifest>) => {
    const next = [...hud];
    next[idx] = { ...next[idx], ...patch };
    updateGlobalState({ hud: next });
  };

  const moveHudItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= hud.length) return;
    const next = [...hud];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateGlobalState({ hud: next });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Sub-tab Bar */}
      <div className="h-11 shrink-0 border-b border-[#1F2A38] bg-[#111720] px-4 flex items-center gap-1">
        {(
          [
            { id: 'variables', label: `Variables (${variables.length})` },
            { id: 'hud', label: `HUD Bar (${hud.length})` },
            { id: 'graph', label: `World Logic (${graph.nodes.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              subTab === tab.id
                ? 'bg-[#17202B] text-[#E6EDF3] border border-[#2D3C4E]'
                : 'text-[#8B98A9] hover:text-[#E6EDF3]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. Variables Table */}
      {subTab === 'variables' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#E6EDF3]">
                  Global Variables
                </h2>
                <p className="text-[11px] text-[#8B98A9] mt-0.5">
                  Control read/write access per variable: public (all graphs), readonly (global graph writes), private (global graph only).
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={addVariable}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Variable</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {variables.map((v, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-[#111720] border border-[#1F2A38] rounded-md space-y-3"
                >
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] text-[#8B98A9] mb-1">
                        ID
                      </label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={v.id}
                        onChange={(e) =>
                          updateVariable(idx, { id: e.target.value })
                        }
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#8B98A9] mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={v.name}
                        onChange={(e) =>
                          updateVariable(idx, { name: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#8B98A9] mb-1">
                        Type
                      </label>
                      <select
                        disabled={readOnly}
                        value={v.type}
                        onChange={(e) => {
                          const t = e.target.value as ValueType;
                          updateVariable(idx, {
                            type: t,
                            initialValue:
                              t === 'number' ? 0 : t === 'boolean' ? false : '',
                            hasCap: t === 'number' ? v.hasCap : false,
                          });
                        }}
                        className={INPUT_CLASS}
                      >
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="string">String</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#8B98A9] mb-1">
                        Initial
                      </label>
                      {v.type === 'boolean' ? (
                        <select
                          disabled={readOnly}
                          value={v.initialValue ? 'true' : 'false'}
                          onChange={(e) =>
                            updateVariable(idx, {
                              initialValue: e.target.value === 'true',
                            })
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : v.type === 'number' ? (
                        <NumberInput
                          disabled={readOnly}
                          value={Number(v.initialValue)}
                          onChange={(initialValue) =>
                            updateVariable(idx, { initialValue })
                          }
                          className={`${INPUT_CLASS} font-mono tabular-nums`}
                        />
                      ) : (
                        <input
                          type="text"
                          disabled={readOnly}
                          value={String(v.initialValue)}
                          onChange={(e) =>
                            updateVariable(idx, { initialValue: e.target.value })
                          }
                          className={INPUT_CLASS}
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#8B98A9] mb-1">
                        Access
                      </label>
                      <select
                        disabled={readOnly}
                        value={v.access}
                        onChange={(e) =>
                          updateVariable(idx, {
                            access: e.target.value as AccessLevel,
                          })
                        }
                        className={INPUT_CLASS}
                      >
                        <option value="public">public</option>
                        <option value="readonly">readonly</option>
                        <option value="private">private</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] text-[#8B98A9] mb-1">
                          Color
                        </label>
                        <input
                          type="color"
                          disabled={readOnly}
                          value={v.color ?? '#38bdf8'}
                          onChange={(e) =>
                            updateVariable(idx, { color: e.target.value })
                          }
                          className="w-full h-[30px] bg-[#0B0F14] border border-[#1F2A38] rounded cursor-pointer"
                        />
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => deleteVariable(idx)}
                          title="Delete variable"
                          className="p-1.5 text-[#8B98A9] hover:text-[#F43F5E] bg-[#0B0F14] border border-[#1F2A38] rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {v.type === 'number' && (
                    <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#1F2A38] text-xs">
                      <label className="inline-flex items-center gap-1.5 text-[#E6EDF3] cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={readOnly}
                          checked={Boolean(v.hasCap)}
                          onChange={(e) =>
                            updateVariable(idx, {
                              hasCap: e.target.checked,
                              initialMax: e.target.checked
                                ? (v.initialMax ?? 100)
                                : undefined,
                            })
                          }
                          className="accent-[#10B981]"
                        />
                        <span>Has Cap</span>
                      </label>

                      {v.hasCap && (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-[#8B98A9]">Initial Cap:</span>
                          <NumberInput
                            min={0}
                            disabled={readOnly}
                            value={v.initialMax ?? 100}
                            onChange={(initialMax) =>
                              updateVariable(idx, { initialMax })
                            }
                            className="w-20 bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-xs font-mono text-[#E6EDF3]"
                          />
                        </div>
                      )}

                      <label className="inline-flex items-center gap-1.5 text-[#E6EDF3] cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={readOnly}
                          checked={Boolean(v.allowNegative)}
                          onChange={(e) =>
                            updateVariable(idx, {
                              allowNegative: e.target.checked,
                            })
                          }
                          className="accent-[#10B981]"
                        />
                        <span>Allow Negative</span>
                      </label>

                      <div className="inline-flex items-center gap-1.5 ml-auto">
                        <span className="text-[#8B98A9]">Tags:</span>
                        <input
                          type="text"
                          disabled={readOnly}
                          value={(v.tags ?? []).join(', ')}
                          onChange={(e) =>
                            updateVariable(idx, {
                              tags: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="storable, economy"
                          className="w-36 bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-xs font-mono text-[#E6EDF3]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. HUD Layout + Live TopBar Preview */}
      {subTab === 'hud' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl space-y-6">
            {/* Live TopBar Preview */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#8B98A9]">
                Live In-Game TopBar Preview
              </div>
              <div className="h-12 bg-[#111720] border border-[#2D3C4E] rounded-md px-4 flex items-center justify-between gap-4 overflow-x-auto">
                <span className="text-xs font-semibold text-[#E6EDF3] shrink-0">
                  {manifest.name}
                </span>
                <div className="flex items-center gap-4 text-xs">
                  {hud.map((h, i) => {
                    const v = variables.find((x) => x.id === h.variableId);
                    if (!v) return null;
                    return (
                      <div key={i} className="flex items-baseline gap-1.5 shrink-0">
                        <span
                          className="w-1.5 h-1.5 rounded-[1px] self-center"
                          style={{
                            backgroundColor: h.color ?? v.color ?? '#8B98A9',
                          }}
                        />
                        <span className="text-[#8B98A9]">
                          {h.label || v.shortName || v.name}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-[#E6EDF3]">
                          {String(v.initialValue)}
                          {h.showCap && v.hasCap ? `/${v.initialMax ?? 0}` : ''}
                        </span>
                        {h.showDelta && v.type === 'number' && (
                          <span className="font-mono text-[11px] text-[#10B981]">
                            +0
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <span className="text-[#1F2A38]">·</span>
                  <span className="text-[#8B98A9]">
                    Cycle <strong className="font-mono text-[#E6EDF3]">0</strong>
                  </span>
                </div>
                <span className="px-3 py-1 text-[11px] font-semibold bg-[#10B981] text-[#0B0F14] rounded shrink-0">
                  Next Cycle
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E6EDF3]">
                Visible HUD Items
              </h2>
              {!readOnly && (
                <button
                  type="button"
                  disabled={variables.length === 0}
                  onClick={addHudItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] disabled:opacity-50 rounded-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add HUD Item</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {hud.map((h, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#111720] border border-[#1F2A38] rounded-md flex flex-wrap items-center gap-3"
                >
                  <select
                    disabled={readOnly}
                    value={h.variableId}
                    onChange={(e) => {
                      const v = variables.find((x) => x.id === e.target.value);
                      updateHudItem(idx, {
                        variableId: e.target.value,
                        label: v?.shortName ?? v?.name ?? e.target.value,
                        color: v?.color,
                      });
                    }}
                    className="w-40 bg-[#0B0F14] border border-[#1F2A38] rounded px-2.5 py-1.5 text-xs text-[#E6EDF3]"
                  >
                    {variables.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.id})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    disabled={readOnly}
                    value={h.label ?? ''}
                    onChange={(e) =>
                      updateHudItem(idx, { label: e.target.value })
                    }
                    placeholder="Label override"
                    className="w-32 bg-[#0B0F14] border border-[#1F2A38] rounded px-2.5 py-1.5 text-xs text-[#E6EDF3]"
                  />

                  <input
                    type="color"
                    disabled={readOnly}
                    value={h.color ?? '#38bdf8'}
                    onChange={(e) =>
                      updateHudItem(idx, { color: e.target.value })
                    }
                    className="w-8 h-7 bg-[#0B0F14] border border-[#1F2A38] rounded cursor-pointer"
                  />

                  <label className="inline-flex items-center gap-1.5 text-xs text-[#E6EDF3] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={Boolean(h.showCap)}
                      onChange={(e) =>
                        updateHudItem(idx, { showCap: e.target.checked })
                      }
                      className="accent-[#10B981]"
                    />
                    <span>Show Cap</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-xs text-[#E6EDF3] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={Boolean(h.showDelta)}
                      onChange={(e) =>
                        updateHudItem(idx, { showDelta: e.target.checked })
                      }
                      className="accent-[#10B981]"
                    />
                    <span>Show Delta</span>
                  </label>

                  {!readOnly && (
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveHudItem(idx, -1)}
                        className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === hud.length - 1}
                        onClick={() => moveHudItem(idx, 1)}
                        className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateGlobalState({
                            hud: hud.filter((_, i) => i !== idx),
                          })
                        }
                        className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. World Logic Graph (scope: global) */}
      {subTab === 'graph' && (
        <NodeGraphEditor
          graph={graph}
          scope="global"
          manifest={manifest}
          readOnly={readOnly}
          onChange={(nextGraph) => updateGlobalState({ graph: nextGraph })}
        />
      )}
    </div>
  );
}
