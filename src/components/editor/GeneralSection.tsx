import { Plus, Trash2 } from 'lucide-react';
import {
  MapSizePreset,
  RulesetManifest,
  SetupParamManifest,
  slugifyId,
} from '../../engine/sdk';
import { INPUT_CLS, MONO_INPUT_CLS, SELECT_CLS } from './editorHelpers';

interface GeneralSectionProps {
  manifest: RulesetManifest;
  onChange: (next: RulesetManifest) => void;
}

export function GeneralSection({ manifest, onChange }: GeneralSectionProps) {
  const setupOptions = manifest.setupOptions ?? {
    allowSeed: true,
    mapSizes: [],
    params: [],
  };
  const mapSizes = setupOptions.mapSizes ?? [];
  const params = setupOptions.params ?? [];

  const updateSetup = (patch: Partial<typeof setupOptions>) => {
    onChange({
      ...manifest,
      setupOptions: {
        ...setupOptions,
        ...patch,
      },
    });
  };

  const updateMapSize = (idx: number, patch: Partial<MapSizePreset>) => {
    const next = [...mapSizes];
    next[idx] = { ...next[idx], ...patch };
    updateSetup({ mapSizes: next });
  };

  const addMapSize = () => {
    const id = `size_${mapSizes.length + 1}`;
    updateSetup({
      mapSizes: [
        ...mapSizes,
        { id, name: `Preset ${mapSizes.length + 1}`, width: 24, height: 18 },
      ],
    });
  };

  const removeMapSize = (idx: number) => {
    updateSetup({ mapSizes: mapSizes.filter((_, i) => i !== idx) });
  };

  const addParam = () => {
    const id = `param_${params.length + 1}`;
    const nextParam: SetupParamManifest = {
      id,
      label: 'Density',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { value: 'sparse', label: 'Sparse' },
        { value: 'normal', label: 'Normal' },
        { value: 'rich', label: 'Rich' },
      ],
    };
    updateSetup({ params: [...params, nextParam] });
  };

  const updateParam = (idx: number, nextParam: SetupParamManifest) => {
    const next = [...params];
    next[idx] = nextParam;
    updateSetup({ params: next });
  };

  const removeParam = (idx: number) => {
    updateSetup({ params: params.filter((_, i) => i !== idx) });
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Identity */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#E6EDF3]">
            Ruleset Identity
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="rs-name"
              className="block text-xs font-medium text-[#8B98A9] mb-1.5"
            >
              Name
            </label>
            <input
              id="rs-name"
              type="text"
              value={manifest.name}
              onChange={(e) => onChange({ ...manifest, name: e.target.value })}
              className={`${INPUT_CLS} w-full`}
            />
          </div>

          <div>
            <label
              htmlFor="rs-id"
              className="block text-xs font-medium text-[#8B98A9] mb-1.5"
            >
              Ruleset ID
            </label>
            <input
              id="rs-id"
              type="text"
              value={manifest.id}
              onChange={(e) =>
                onChange({ ...manifest, id: slugifyId(e.target.value, 'ruleset') })
              }
              className={`${MONO_INPUT_CLS} w-full`}
            />
          </div>

          <div>
            <label
              htmlFor="rs-author"
              className="block text-xs font-medium text-[#8B98A9] mb-1.5"
            >
              Author
            </label>
            <input
              id="rs-author"
              type="text"
              value={manifest.author ?? ''}
              onChange={(e) =>
                onChange({ ...manifest, author: e.target.value || undefined })
              }
              placeholder="Optional"
              className={`${INPUT_CLS} w-full`}
            />
          </div>

          <div>
            <label
              htmlFor="rs-default-cell"
              className="block text-xs font-medium text-[#8B98A9] mb-1.5"
            >
              Default Cell Type
            </label>
            <select
              id="rs-default-cell"
              value={manifest.defaultCellTypeId}
              onChange={(e) =>
                onChange({ ...manifest, defaultCellTypeId: e.target.value })
              }
              className={`${SELECT_CLS} w-full`}
            >
              {manifest.cellTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="rs-desc"
            className="block text-xs font-medium text-[#8B98A9] mb-1.5"
          >
            Description
          </label>
          <textarea
            id="rs-desc"
            rows={2}
            value={manifest.description ?? ''}
            onChange={(e) =>
              onChange({
                ...manifest,
                description: e.target.value || undefined,
              })
            }
            placeholder="Brief ruleset summary"
            className={`${INPUT_CLS} w-full resize-none`}
          />
        </div>
      </section>

      {/* Grid & Initial Simulation */}
      <section className="pt-6 border-t border-[#1F2A38] space-y-4">
        <h2 className="text-sm font-semibold text-[#E6EDF3]">
          Grid & Simulation Defaults
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label
              htmlFor="rs-grid-w"
              className="block text-xs font-medium text-[#8B98A9] mb-1.5"
            >
              Default Width
            </label>
            <input
              id="rs-grid-w"
              type="number"
              min={4}
              max={128}
              value={manifest.defaultGridSize.width}
              onChange={(e) =>
                onChange({
                  ...manifest,
                  defaultGridSize: {
                    ...manifest.defaultGridSize,
                    width: Math.max(4, Number(e.target.value)),
                  },
                })
              }
              className={`${MONO_INPUT_CLS} w-full`}
            />
          </div>

          <div>
            <label
              htmlFor="rs-grid-h"
              className="block text-xs font-medium text-[#8B98A9] mb-1.5"
            >
              Default Height
            </label>
            <input
              id="rs-grid-h"
              type="number"
              min={4}
              max={128}
              value={manifest.defaultGridSize.height}
              onChange={(e) =>
                onChange({
                  ...manifest,
                  defaultGridSize: {
                    ...manifest.defaultGridSize,
                    height: Math.max(4, Number(e.target.value)),
                  },
                })
              }
              className={`${MONO_INPUT_CLS} w-full`}
            />
          </div>

          <div>
            <label
              htmlFor="rs-init-cycles"
              className="block text-xs font-medium text-[#8B98A9] mb-1.5"
            >
              Warmup Cycles
            </label>
            <input
              id="rs-init-cycles"
              type="number"
              min={0}
              max={10}
              value={manifest.initialCycles ?? 1}
              onChange={(e) =>
                onChange({
                  ...manifest,
                  initialCycles: Math.max(0, Number(e.target.value)),
                })
              }
              className={`${MONO_INPUT_CLS} w-full`}
            />
          </div>

          <div className="flex items-end pb-1.5">
            <label className="inline-flex items-center gap-2 text-xs text-[#E6EDF3] cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(setupOptions.allowSeed)}
                onChange={(e) => updateSetup({ allowSeed: e.target.checked })}
                className="accent-[#10B981] w-4 h-4"
              />
              <span>Allow custom seed</span>
            </label>
          </div>
        </div>
      </section>

      {/* Map Size Presets */}
      <section className="pt-6 border-t border-[#1F2A38] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#E6EDF3]">
            Map Size Presets
          </h2>
          <button
            type="button"
            onClick={addMapSize}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Preset</span>
          </button>
        </div>

        {mapSizes.length === 0 ? (
          <p className="text-xs text-[#8B98A9]">
            No size presets — games will use default grid size.
          </p>
        ) : (
          <div className="space-y-2">
            {mapSizes.map((preset, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_1fr_80px_80px_32px] gap-2 items-center"
              >
                <input
                  type="text"
                  value={preset.name}
                  onChange={(e) => updateMapSize(idx, { name: e.target.value })}
                  placeholder="Label"
                  className={INPUT_CLS}
                  aria-label="Preset name"
                />
                <input
                  type="text"
                  value={preset.id}
                  onChange={(e) =>
                    updateMapSize(idx, {
                      id: slugifyId(e.target.value, preset.id),
                    })
                  }
                  placeholder="id"
                  className={MONO_INPUT_CLS}
                  aria-label="Preset id"
                />
                <input
                  type="number"
                  min={4}
                  max={128}
                  value={preset.width}
                  onChange={(e) =>
                    updateMapSize(idx, {
                      width: Math.max(4, Number(e.target.value)),
                    })
                  }
                  className={MONO_INPUT_CLS}
                  aria-label="Width"
                />
                <input
                  type="number"
                  min={4}
                  max={128}
                  value={preset.height}
                  onChange={(e) =>
                    updateMapSize(idx, {
                      height: Math.max(4, Number(e.target.value)),
                    })
                  }
                  className={MONO_INPUT_CLS}
                  aria-label="Height"
                />
                <button
                  type="button"
                  onClick={() => removeMapSize(idx)}
                  aria-label="Remove preset"
                  className="p-1.5 text-[#8B98A9] hover:text-[#F43F5E] rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Setup Parameters */}
      <section className="pt-6 border-t border-[#1F2A38] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#E6EDF3]">
            Setup Parameters
          </h2>
          <button
            type="button"
            onClick={addParam}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Parameter</span>
          </button>
        </div>

        {params.length === 0 ? (
          <p className="text-xs text-[#8B98A9]">
            Optional menu parameters (e.g. terrain density) passed to world generator steps.
          </p>
        ) : (
          <div className="space-y-2.5">
            {params.map((param, idx) => (
              <div
                key={idx}
                className="bg-[#111720] border border-[#1F2A38] rounded-md p-3 space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={param.id}
                    onChange={(e) =>
                      updateParam(idx, {
                        ...param,
                        id: slugifyId(e.target.value, param.id),
                      })
                    }
                    placeholder="id"
                    className={`${MONO_INPUT_CLS} w-28`}
                    aria-label="Parameter ID"
                  />
                  <input
                    type="text"
                    value={param.label}
                    onChange={(e) =>
                      updateParam(idx, { ...param, label: e.target.value })
                    }
                    placeholder="Label"
                    className={`${INPUT_CLS} flex-1 min-w-[120px]`}
                    aria-label="Parameter label"
                  />
                  <select
                    value={param.type}
                    onChange={(e) => {
                      const t = e.target.value as SetupParamManifest['type'];
                      if (t === 'select') {
                        updateParam(idx, {
                          id: param.id,
                          label: param.label,
                          type: 'select',
                          defaultValue: 'normal',
                          options: [
                            { value: 'sparse', label: 'Sparse' },
                            { value: 'normal', label: 'Normal' },
                            { value: 'rich', label: 'Rich' },
                          ],
                        });
                      } else if (t === 'number') {
                        updateParam(idx, {
                          id: param.id,
                          label: param.label,
                          type: 'number',
                          defaultValue: 1,
                          min: 0,
                          max: 10,
                          step: 1,
                        });
                      } else {
                        updateParam(idx, {
                          id: param.id,
                          label: param.label,
                          type: 'boolean',
                          defaultValue: true,
                        });
                      }
                    }}
                    className={SELECT_CLS}
                    aria-label="Parameter type"
                  >
                    <option value="select">Select</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeParam(idx)}
                    aria-label="Remove parameter"
                    className="p-1 text-[#8B98A9] hover:text-[#F43F5E] rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                {param.type === 'select' && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[11px] text-[#8B98A9]">Options:</span>
                    <input
                      type="text"
                      value={param.options
                        .map((o) => `${o.value}:${o.label}`)
                        .join(', ')}
                      onChange={(e) => {
                        const parsed = e.target.value
                          .split(',')
                          .map((chunk) => chunk.trim())
                          .filter(Boolean)
                          .map((chunk) => {
                            const [v, l] = chunk.split(':');
                            const val = v.trim();
                            return { value: val, label: (l ?? val).trim() };
                          });
                        updateParam(idx, {
                          ...param,
                          options: parsed.length > 0 ? parsed : param.options,
                          defaultValue: parsed[0]?.value ?? param.defaultValue,
                        });
                      }}
                      className={`${MONO_INPUT_CLS} flex-1 min-w-[200px]`}
                      placeholder="sparse:Sparse, normal:Normal, rich:Rich"
                    />
                  </div>
                )}

                {param.type === 'number' && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[11px] text-[#8B98A9]">Default</span>
                    <input
                      type="number"
                      value={param.defaultValue}
                      onChange={(e) =>
                        updateParam(idx, {
                          ...param,
                          defaultValue: Number(e.target.value),
                        })
                      }
                      className={`${MONO_INPUT_CLS} w-20`}
                    />
                    <span className="text-[11px] text-[#8B98A9]">Min</span>
                    <input
                      type="number"
                      value={param.min}
                      onChange={(e) =>
                        updateParam(idx, {
                          ...param,
                          min: Number(e.target.value),
                        })
                      }
                      className={`${MONO_INPUT_CLS} w-16`}
                    />
                    <span className="text-[11px] text-[#8B98A9]">Max</span>
                    <input
                      type="number"
                      value={param.max}
                      onChange={(e) =>
                        updateParam(idx, {
                          ...param,
                          max: Number(e.target.value),
                        })
                      }
                      className={`${MONO_INPUT_CLS} w-16`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
