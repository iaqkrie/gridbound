import { Plus, Trash2 } from 'lucide-react';
import {
  DecayRule,
  RulesetManifest,
  SupplyManifest,
  renameSupplyId,
} from '../../engine/sdk';
import {
  INPUT_CLS,
  MONO_INPUT_CLS,
  SELECT_CLS,
  createDefaultSupply,
} from './editorHelpers';

interface SuppliesSectionProps {
  manifest: RulesetManifest;
  onChange: (next: RulesetManifest) => void;
}

export function SuppliesSection({ manifest, onChange }: SuppliesSectionProps) {
  const updateAt = (idx: number, nextSup: SupplyManifest) => {
    const copy = [...manifest.supplies];
    copy[idx] = nextSup;
    onChange({ ...manifest, supplies: copy });
  };

  const handleRenameId = (oldId: string, rawNewId: string) => {
    onChange(renameSupplyId(manifest, oldId, rawNewId));
  };

  const handleAdd = () => {
    onChange({
      ...manifest,
      supplies: [...manifest.supplies, createDefaultSupply(manifest)],
    });
  };

  const handleDelete = (idx: number) => {
    onChange({
      ...manifest,
      supplies: manifest.supplies.filter((_, i) => i !== idx),
    });
  };

  const handleDecayKindChange = (
    idx: number,
    sup: SupplyManifest,
    kind: DecayRule['kind']
  ) => {
    let nextDecay: DecayRule;
    switch (kind) {
      case 'clear':
        nextDecay = { kind: 'clear' };
        break;
      case 'none':
        nextDecay = { kind: 'none' };
        break;
      case 'linear':
        nextDecay = { kind: 'linear', amount: 1 };
        break;
      case 'percent':
        nextDecay = { kind: 'percent', retainRatio: 0.5, round: 'floor', minStep: 1 };
        break;
    }
    updateAt(idx, { ...sup, decay: nextDecay });
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#E6EDF3]">
            Spatial Supplies
          </h2>
          <p className="text-xs text-[#8B98A9] mt-0.5">
            Per-tile spatial fields (e.g. Moisture, Power, Heat) emitted by cells and shown in map layers.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add Supply</span>
        </button>
      </div>

      {manifest.supplies.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-[#1F2A38] rounded-md">
          <p className="text-xs text-[#8B98A9]">No spatial supplies yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {manifest.supplies.map((sup, idx) => (
            <div
              key={`${sup.id}-${idx}`}
              className="bg-[#111720] border border-[#1F2A38] rounded-lg p-3.5 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(sup.color) ? sup.color : '#0EA5E9'}
                  onChange={(e) => updateAt(idx, { ...sup, color: e.target.value })}
                  className="w-7 h-7 bg-transparent border border-[#1F2A38] rounded cursor-pointer shrink-0"
                  aria-label="Supply color"
                />

                <div className="flex-1 min-w-[140px]">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    Name
                  </span>
                  <input
                    type="text"
                    value={sup.name}
                    onChange={(e) => updateAt(idx, { ...sup, name: e.target.value })}
                    className={`${INPUT_CLS} w-full`}
                  />
                </div>

                <div className="w-36">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    ID (cascade)
                  </span>
                  <input
                    type="text"
                    defaultValue={sup.id}
                    key={sup.id}
                    onBlur={(e) => handleRenameId(sup.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameId(sup.id, e.currentTarget.value);
                      }
                    }}
                    className={`${MONO_INPUT_CLS} w-full`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  aria-label={`Delete ${sup.name}`}
                  className="self-end p-1.5 text-[#8B98A9] hover:text-[#F43F5E] rounded cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-3 pt-2.5 border-t border-[#1F2A38]">
                <div className="w-28">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    Visual Scale Max
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={sup.maxExpected}
                    onChange={(e) =>
                      updateAt(idx, {
                        ...sup,
                        maxExpected: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className={`${MONO_INPUT_CLS} w-full`}
                  />
                </div>

                <div className="w-44">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    Phase 2 Decay Rule
                  </span>
                  <select
                    value={sup.decay.kind}
                    onChange={(e) =>
                      handleDecayKindChange(
                        idx,
                        sup,
                        e.target.value as DecayRule['kind']
                      )
                    }
                    className={`${SELECT_CLS} w-full`}
                  >
                    <option value="clear">Clear every cycle</option>
                    <option value="none">Persist (no decay)</option>
                    <option value="linear">Linear subtract</option>
                    <option value="percent">Percent retain</option>
                  </select>
                </div>

                {sup.decay.kind === 'linear' && (
                  <div className="w-24">
                    <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                      Amount
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={sup.decay.amount}
                      onChange={(e) =>
                        updateAt(idx, {
                          ...sup,
                          decay: {
                            kind: 'linear',
                            amount: Math.max(1, Number(e.target.value)),
                          },
                        })
                      }
                      className={`${MONO_INPUT_CLS} w-full`}
                    />
                  </div>
                )}

                {sup.decay.kind === 'percent' && (
                  <>
                    <div className="w-28">
                      <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                        Retain (0–1)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={sup.decay.retainRatio}
                        onChange={(e) => {
                          const prev = sup.decay.kind === 'percent' ? sup.decay : undefined;
                          updateAt(idx, {
                            ...sup,
                            decay: {
                              kind: 'percent',
                              retainRatio: Math.max(
                                0,
                                Math.min(1, Number(e.target.value))
                              ),
                              round: prev?.round,
                              minStep: prev?.minStep,
                            },
                          });
                        }}
                        className={`${MONO_INPUT_CLS} w-full`}
                      />
                    </div>
                    <div className="w-24">
                      <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                        Round
                      </span>
                      <select
                        value={sup.decay.round ?? 'floor'}
                        onChange={(e) => {
                          const prev = sup.decay.kind === 'percent' ? sup.decay : undefined;
                          updateAt(idx, {
                            ...sup,
                            decay: {
                              kind: 'percent',
                              retainRatio: prev?.retainRatio ?? 0.5,
                              round: e.target.value as 'floor' | 'ceil' | 'round',
                              minStep: prev?.minStep,
                            },
                          });
                        }}
                        className={`${SELECT_CLS} w-full`}
                      >
                        <option value="floor">floor</option>
                        <option value="round">round</option>
                        <option value="ceil">ceil</option>
                      </select>
                    </div>
                    <div className="w-20">
                      <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                        Min Step
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={sup.decay.minStep ?? 0}
                        onChange={(e) => {
                          const prev = sup.decay.kind === 'percent' ? sup.decay : undefined;
                          const val = Math.max(0, Number(e.target.value));
                          updateAt(idx, {
                            ...sup,
                            decay: {
                              kind: 'percent',
                              retainRatio: prev?.retainRatio ?? 0.5,
                              round: prev?.round,
                              minStep: val > 0 ? val : undefined,
                            },
                          });
                        }}
                        className={`${MONO_INPUT_CLS} w-full`}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
