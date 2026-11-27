import { Plus, Trash2 } from 'lucide-react';
import {
  DecayRule,
  RulesetManifest,
  SupplyManifest,
} from '../../engine/sdk';
import { makeUniqueId } from './studioUtils';
import { NumberInput } from './NumberInput';

interface SuppliesTabProps {
  manifest: RulesetManifest;
  readOnly?: boolean;
  onChange: (next: RulesetManifest) => void;
}

const INPUT_CLASS =
  'w-full bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded px-2.5 py-1.5 text-xs text-[#E6EDF3] focus:outline-none disabled:opacity-60';

export function SuppliesTab({ manifest, readOnly, onChange }: SuppliesTabProps) {
  const addSupply = () => {
    if (readOnly) return;
    const id = makeUniqueId(
      'supply',
      manifest.supplies.map((s) => s.id)
    );
    const next: SupplyManifest = {
      id,
      name: `Supply ${manifest.supplies.length + 1}`,
      description: '',
      color: '#38bdf8',
      maxExpected: 4,
      maxAmount: 99,
      decay: { kind: 'clear' },
      showInOverlay: true,
    };
    onChange({ ...manifest, supplies: [...manifest.supplies, next] });
  };

  const updateSupply = (idx: number, patch: Partial<SupplyManifest>) => {
    if (readOnly) return;
    const next = [...manifest.supplies];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...manifest, supplies: next });
  };

  const deleteSupply = (idx: number) => {
    if (readOnly) return;
    onChange({
      ...manifest,
      supplies: manifest.supplies.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-[#1F2A38]">
          <div>
            <h2 className="text-sm font-semibold text-[#E6EDF3]">
              Unified Numeric Supplies
            </h2>
            <p className="text-[11px] text-[#8B98A9] mt-0.5">
              Spatial numeric fields emitted by cells in Phase 2. Set decay to &ldquo;Clear every cycle&rdquo; for 1-cycle signals and messages.
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={addSupply}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supply</span>
            </button>
          )}
        </div>

        {manifest.supplies.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-[#1F2A38] rounded-md text-xs text-[#8B98A9]">
            No supplies defined yet. Add a supply like Moisture, Power, or Signal.
          </div>
        ) : (
          <div className="space-y-3">
            {manifest.supplies.map((s, idx) => (
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
                      value={s.id}
                      onChange={(e) => updateSupply(idx, { id: e.target.value })}
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
                      value={s.name}
                      onChange={(e) =>
                        updateSupply(idx, { name: e.target.value })
                      }
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8B98A9] mb-1">
                      Overlay Scale
                    </label>
                    <NumberInput
                      min={1}
                      disabled={readOnly}
                      value={s.maxExpected}
                      onChange={(maxExpected) =>
                        updateSupply(idx, { maxExpected })
                      }
                      className={`${INPUT_CLASS} font-mono tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8B98A9] mb-1">
                      Max Cap
                    </label>
                    <NumberInput
                      min={1}
                      disabled={readOnly}
                      value={s.maxAmount ?? 99}
                      onChange={(maxAmount) => updateSupply(idx, { maxAmount })}
                      className={`${INPUT_CLASS} font-mono tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8B98A9] mb-1">
                      Color
                    </label>
                    <input
                      type="color"
                      disabled={readOnly}
                      value={s.color}
                      onChange={(e) =>
                        updateSupply(idx, { color: e.target.value })
                      }
                      className="w-full h-[30px] bg-[#0B0F14] border border-[#1F2A38] rounded cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 pb-1">
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#E6EDF3] cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={s.showInOverlay !== false}
                        onChange={(e) =>
                          updateSupply(idx, { showInOverlay: e.target.checked })
                        }
                        className="accent-[#10B981]"
                      />
                      <span>Overlay</span>
                    </label>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => deleteSupply(idx)}
                        title="Delete supply"
                        className="p-1.5 text-[#8B98A9] hover:text-[#F43F5E] bg-[#0B0F14] border border-[#1F2A38] rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Decay Rule Builder */}
                <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-[#1F2A38] text-xs">
                  <span className="text-[#8B98A9]">Phase 1 Decay:</span>
                  <select
                    disabled={readOnly}
                    value={s.decay.kind}
                    onChange={(e) => {
                      const kind = e.target.value as DecayRule['kind'];
                      if (kind === 'clear') updateSupply(idx, { decay: { kind: 'clear' } });
                      else if (kind === 'none') updateSupply(idx, { decay: { kind: 'none' } });
                      else if (kind === 'linear')
                        updateSupply(idx, { decay: { kind: 'linear', amount: 1 } });
                      else
                        updateSupply(idx, {
                          decay: { kind: 'percent', retainRatio: 0.5, round: 'floor' },
                        });
                    }}
                    className="w-44 bg-[#0B0F14] border border-[#1F2A38] rounded px-2.5 py-1 text-xs text-[#E6EDF3]"
                  >
                    <option value="clear">Clear every cycle (0)</option>
                    <option value="none">Persistent (No decay)</option>
                    <option value="linear">Linear subtract</option>
                    <option value="percent">Percent retain</option>
                  </select>

                  {s.decay.kind === 'linear' && (
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-[#8B98A9]">Amount:</span>
                      <NumberInput
                        min={1}
                        disabled={readOnly}
                        value={s.decay.amount}
                        onChange={(amount) =>
                          updateSupply(idx, {
                            decay: { kind: 'linear', amount },
                          })
                        }
                        className="w-20 bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-xs font-mono text-[#E6EDF3]"
                      />
                    </div>
                  )}

                  {s.decay.kind === 'percent' && (
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-[#8B98A9]">Retain Ratio (0–1):</span>
                      <NumberInput
                        min={0}
                        max={1}
                        step={0.05}
                        disabled={readOnly}
                        value={s.decay.retainRatio}
                        onChange={(retainRatio) =>
                          updateSupply(idx, {
                            decay: {
                              ...s.decay,
                              kind: 'percent',
                              retainRatio,
                            },
                          })
                        }
                        className="w-20 bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-xs font-mono text-[#E6EDF3]"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
