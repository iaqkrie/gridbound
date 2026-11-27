import { Plus, Trash2 } from 'lucide-react';
import {
  RulesetManifest,
  SetupOptionManifest,
} from '../../engine/sdk';
import { makeUniqueId } from './studioUtils';

interface GeneralTabProps {
  manifest: RulesetManifest;
  readOnly?: boolean;
  onChange: (next: RulesetManifest) => void;
}

const INPUT_CLASS =
  'w-full bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded-md px-3 py-2 text-xs text-[#E6EDF3] focus:outline-none disabled:opacity-60';

const LABEL_CLASS = 'block text-xs font-medium text-[#8B98A9] mb-1.5';

export function GeneralTab({ manifest, readOnly, onChange }: GeneralTabProps) {
  const setupOptions = manifest.setupOptions ?? [];

  const updateField = <K extends keyof RulesetManifest>(
    key: K,
    value: RulesetManifest[K]
  ) => {
    if (readOnly) return;
    onChange({ ...manifest, [key]: value });
  };

  const updateSetupOption = (
    idx: number,
    patch: Partial<SetupOptionManifest>
  ) => {
    if (readOnly) return;
    const next = [...setupOptions];
    next[idx] = { ...next[idx], ...patch };
    updateField('setupOptions', next);
  };

  const addSetupOption = () => {
    if (readOnly) return;
    const id = makeUniqueId(
      'option',
      setupOptions.map((o) => o.id)
    );
    updateField('setupOptions', [
      ...setupOptions,
      {
        id,
        label: 'New Option',
        type: 'number',
        defaultValue: 1,
        min: 0,
        max: 10,
        step: 1,
      },
    ]);
  };

  const removeSetupOption = (idx: number) => {
    if (readOnly) return;
    updateField(
      'setupOptions',
      setupOptions.filter((_, i) => i !== idx)
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl space-y-8">
        {/* Identity */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#E6EDF3] pb-2 border-b border-[#1F2A38]">
            Ruleset Identity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Ruleset Name</label>
              <input
                type="text"
                disabled={readOnly}
                value={manifest.name}
                onChange={(e) => updateField('name', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Ruleset ID</label>
              <input
                type="text"
                disabled={readOnly}
                value={manifest.id}
                onChange={(e) => updateField('id', e.target.value)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Author</label>
              <input
                type="text"
                disabled={readOnly}
                value={manifest.author ?? ''}
                onChange={(e) => updateField('author', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Schema Version</label>
              <input
                type="text"
                disabled
                value={`Schema v${manifest.schemaVersion}`}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea
              rows={2}
              disabled={readOnly}
              value={manifest.description ?? ''}
              onChange={(e) => updateField('description', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </section>

        {/* World Defaults */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#E6EDF3] pb-2 border-b border-[#1F2A38]">
            World Defaults
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Default Width</label>
                <input
                  type="number"
                  min={4}
                  max={64}
                  disabled={readOnly}
                  value={manifest.defaultGridSize.width}
                  onChange={(e) =>
                    updateField('defaultGridSize', {
                      ...manifest.defaultGridSize,
                      width: Math.max(4, Math.min(64, Number(e.target.value))),
                    })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Default Height</label>
                <input
                  type="number"
                  min={4}
                  max={64}
                  disabled={readOnly}
                  value={manifest.defaultGridSize.height}
                  onChange={(e) =>
                    updateField('defaultGridSize', {
                      ...manifest.defaultGridSize,
                      height: Math.max(4, Math.min(64, Number(e.target.value))),
                    })
                  }
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>Default Cell Type</label>
              <select
                disabled={readOnly}
                value={manifest.defaultCellTypeId}
                onChange={(e) => updateField('defaultCellTypeId', e.target.value)}
                className={INPUT_CLASS}
              >
                {manifest.cellTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name} ({ct.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Default Hover Interface</label>
              <select
                disabled={readOnly}
                value={manifest.defaultHoverInterfaceId ?? ''}
                onChange={(e) =>
                  updateField(
                    'defaultHoverInterfaceId',
                    e.target.value ? e.target.value : null
                  )
                }
                className={INPUT_CLASS}
              >
                <option value="">Disabled (No hover card by default)</option>
                <option value="@builtin/inspector">
                  Built-in Cell Inspector (@builtin/inspector)
                </option>
                {manifest.interfaces.map((iface) => (
                  <option key={iface.id} value={iface.id}>
                    {iface.title} ({iface.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Setup Options */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#1F2A38]">
            <div>
              <h2 className="text-sm font-semibold text-[#E6EDF3]">
                World Setup Options
              </h2>
              <p className="text-[11px] text-[#8B98A9] mt-0.5">
                Readable in all node graphs via Get Setup Option and WorldGenerator via Setup Parameter.
              </p>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={addSetupOption}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Option</span>
              </button>
            )}
          </div>

          {setupOptions.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-[#1F2A38] rounded-md text-xs text-[#8B98A9]">
              No custom setup options configured.
            </div>
          ) : (
            <div className="space-y-3">
              {setupOptions.map((opt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#111720] border border-[#1F2A38] rounded-md space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className={LABEL_CLASS}>ID</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={opt.id}
                        onChange={(e) =>
                          updateSetupOption(idx, { id: e.target.value })
                        }
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Label</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={opt.label}
                        onChange={(e) =>
                          updateSetupOption(idx, { label: e.target.value })
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Type</label>
                      <select
                        disabled={readOnly}
                        value={opt.type}
                        onChange={(e) => {
                          const t = e.target.value as SetupOptionManifest['type'];
                          if (t === 'number') {
                            updateSetupOption(idx, {
                              type: 'number',
                              defaultValue: 1,
                              min: 0,
                              max: 10,
                              step: 1,
                            });
                          } else if (t === 'boolean') {
                            updateSetupOption(idx, {
                              type: 'boolean',
                              defaultValue: false,
                            });
                          } else {
                            updateSetupOption(idx, {
                              type: 'select',
                              defaultValue: 'normal',
                              options: [
                                { value: 'low', label: 'Low' },
                                { value: 'normal', label: 'Normal' },
                                { value: 'high', label: 'High' },
                              ],
                            });
                          }
                        }}
                        className={INPUT_CLASS}
                      >
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="select">Select</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className={LABEL_CLASS}>Default</label>
                        {opt.type === 'boolean' ? (
                          <select
                            disabled={readOnly}
                            value={opt.defaultValue ? 'true' : 'false'}
                            onChange={(e) =>
                              updateSetupOption(idx, {
                                defaultValue: e.target.value === 'true',
                              })
                            }
                            className={INPUT_CLASS}
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : opt.type === 'number' ? (
                          <input
                            type="number"
                            step="any"
                            disabled={readOnly}
                            value={Number(opt.defaultValue)}
                            onChange={(e) =>
                              updateSetupOption(idx, {
                                defaultValue: Number(e.target.value),
                              })
                            }
                            className={`${INPUT_CLASS} font-mono`}
                          />
                        ) : (
                          <input
                            type="text"
                            disabled={readOnly}
                            value={String(opt.defaultValue)}
                            onChange={(e) =>
                              updateSetupOption(idx, {
                                defaultValue: e.target.value,
                              })
                            }
                            className={INPUT_CLASS}
                          />
                        )}
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeSetupOption(idx)}
                          title="Remove option"
                          className="p-2 text-[#8B98A9] hover:text-[#F43F5E] bg-[#0B0F14] border border-[#1F2A38] rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {opt.type === 'number' && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={LABEL_CLASS}>Min</label>
                        <input
                          type="number"
                          step="any"
                          disabled={readOnly}
                          value={opt.min ?? 0}
                          onChange={(e) =>
                            updateSetupOption(idx, { min: Number(e.target.value) })
                          }
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Max</label>
                        <input
                          type="number"
                          step="any"
                          disabled={readOnly}
                          value={opt.max ?? 10}
                          onChange={(e) =>
                            updateSetupOption(idx, { max: Number(e.target.value) })
                          }
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Step</label>
                        <input
                          type="number"
                          step="any"
                          disabled={readOnly}
                          value={opt.step ?? 1}
                          onChange={(e) =>
                            updateSetupOption(idx, {
                              step: Number(e.target.value),
                            })
                          }
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
