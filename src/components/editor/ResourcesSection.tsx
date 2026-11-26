import { Plus, Trash2 } from 'lucide-react';
import {
  ResourceManifest,
  RulesetManifest,
  renameResourceId,
} from '../../engine/sdk';
import {
  INPUT_CLS,
  MONO_INPUT_CLS,
  SELECT_CLS,
  createDefaultResource,
} from './editorHelpers';

interface ResourcesSectionProps {
  manifest: RulesetManifest;
  onChange: (next: RulesetManifest) => void;
}

export function ResourcesSection({ manifest, onChange }: ResourcesSectionProps) {
  const updateAt = (idx: number, nextRes: ResourceManifest) => {
    const copy = [...manifest.resources];
    copy[idx] = nextRes;
    onChange({ ...manifest, resources: copy });
  };

  const handleRenameId = (oldId: string, rawNewId: string) => {
    onChange(renameResourceId(manifest, oldId, rawNewId));
  };

  const handleAdd = () => {
    onChange({
      ...manifest,
      resources: [...manifest.resources, createDefaultResource(manifest)],
    });
  };

  const handleDelete = (idx: number) => {
    onChange({
      ...manifest,
      resources: manifest.resources.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#E6EDF3]">
            Global Resources
          </h2>
          <p className="text-xs text-[#8B98A9] mt-0.5">
            Displayed in the top bar and shared across all cells. Renaming an ID updates all references automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add Resource</span>
        </button>
      </div>

      {manifest.resources.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-[#1F2A38] rounded-md">
          <p className="text-xs text-[#8B98A9]">No global resources yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {manifest.resources.map((res, idx) => (
            <div
              key={`${res.id}-${idx}`}
              className="bg-[#111720] border border-[#1F2A38] rounded-lg p-3.5 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(res.color) ? res.color : '#10B981'}
                  onChange={(e) => updateAt(idx, { ...res, color: e.target.value })}
                  className="w-7 h-7 bg-transparent border border-[#1F2A38] rounded cursor-pointer shrink-0"
                  aria-label="Resource color"
                />

                <div className="flex-1 min-w-[130px]">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    Name
                  </span>
                  <input
                    type="text"
                    value={res.name}
                    onChange={(e) => updateAt(idx, { ...res, name: e.target.value })}
                    className={`${INPUT_CLS} w-full`}
                  />
                </div>

                <div className="w-24">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    Short
                  </span>
                  <input
                    type="text"
                    value={res.shortName ?? ''}
                    onChange={(e) =>
                      updateAt(idx, {
                        ...res,
                        shortName: e.target.value || undefined,
                      })
                    }
                    placeholder={res.name}
                    className={`${INPUT_CLS} w-full`}
                  />
                </div>

                <div className="w-32">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    ID (cascade)
                  </span>
                  <input
                    type="text"
                    defaultValue={res.id}
                    key={res.id}
                    onBlur={(e) => handleRenameId(res.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameId(res.id, e.currentTarget.value);
                      }
                    }}
                    className={`${MONO_INPUT_CLS} w-full`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  aria-label={`Delete ${res.name}`}
                  className="self-end p-1.5 text-[#8B98A9] hover:text-[#F43F5E] rounded cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-3 pt-2.5 border-t border-[#1F2A38]">
                <div className="w-32">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    Kind
                  </span>
                  <select
                    value={res.kind}
                    onChange={(e) => {
                      const nextKind = e.target.value as 'unlimited' | 'capped';
                      if (nextKind === 'capped') {
                        updateAt(idx, {
                          id: res.id,
                          name: res.name,
                          shortName: res.shortName,
                          color: res.color,
                          initialValue: res.initialValue,
                          tags: res.tags,
                          kind: 'capped',
                          initialMax: res.kind === 'capped' ? res.initialMax : 100,
                        });
                      } else {
                        updateAt(idx, {
                          id: res.id,
                          name: res.name,
                          shortName: res.shortName,
                          color: res.color,
                          initialValue: res.initialValue,
                          tags: res.tags,
                          kind: 'unlimited',
                        });
                      }
                    }}
                    className={`${SELECT_CLS} w-full`}
                  >
                    <option value="unlimited">Unlimited</option>
                    <option value="capped">Capped (Value/Max)</option>
                  </select>
                </div>

                <div className="w-24">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    Initial
                  </span>
                  <input
                    type="number"
                    value={res.initialValue}
                    onChange={(e) =>
                      updateAt(idx, {
                        ...res,
                        initialValue: Number(e.target.value),
                      })
                    }
                    className={`${MONO_INPUT_CLS} w-full`}
                  />
                </div>

                {res.kind === 'capped' && (
                  <div className="w-24">
                    <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                      Initial Max
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={res.initialMax}
                      onChange={(e) =>
                        updateAt(idx, {
                          ...res,
                          initialMax: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className={`${MONO_INPUT_CLS} w-full`}
                    />
                  </div>
                )}

                <div className="flex-1 min-w-[160px]">
                  <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                    Tags (comma-separated, e.g. storable)
                  </span>
                  <input
                    type="text"
                    value={(res.tags ?? []).join(', ')}
                    onChange={(e) => {
                      const tags = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      updateAt(idx, {
                        ...res,
                        tags: tags.length > 0 ? tags : undefined,
                      });
                    }}
                    placeholder="storable"
                    className={`${MONO_INPUT_CLS} w-full`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
