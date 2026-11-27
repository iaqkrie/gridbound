import { useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  AccessLevel,
  CellTypeManifest,
  RulesetManifest,
  StateFieldManifest,
  ValueType,
} from '../../engine/sdk';
import { NodeGraphEditor } from './NodeGraphEditor';
import { makeUniqueId } from './studioUtils';

interface CellsTabProps {
  manifest: RulesetManifest;
  readOnly?: boolean;
  onChange: (next: RulesetManifest) => void;
}

type CellSubTab = 'properties' | 'graph';

const INPUT_CLASS =
  'w-full bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded px-2.5 py-1.5 text-xs text-[#E6EDF3] focus:outline-none disabled:opacity-60';

const LABEL_CLASS = 'block text-[11px] font-medium text-[#8B98A9] mb-1';

export function CellsTab({ manifest, readOnly, onChange }: CellsTabProps) {
  const [selectedId, setSelectedId] = useState<string>(
    manifest.cellTypes[0]?.id ?? ''
  );
  const [subTab, setSubTab] = useState<CellSubTab>('properties');

  const spriteById = useMemo(
    () => new Map(manifest.sprites.map((s) => [s.id, s])),
    [manifest.sprites]
  );

  const selectedCell =
    manifest.cellTypes.find((c) => c.id === selectedId) ?? manifest.cellTypes[0];

  const updateCell = (
    cellId: string,
    updater: (cell: CellTypeManifest) => CellTypeManifest
  ) => {
    if (readOnly) return;
    let renamedFrom: string | null = null;
    let renamedTo: string | null = null;

    const nextCells = manifest.cellTypes.map((c) => {
      if (c.id !== cellId) return c;
      const updated = updater(c);
      if (updated.id !== c.id) {
        renamedFrom = c.id;
        renamedTo = updated.id;
      }
      return updated;
    });

    const nextManifest: RulesetManifest = {
      ...manifest,
      cellTypes: nextCells,
      defaultCellTypeId:
        renamedFrom && manifest.defaultCellTypeId === renamedFrom && renamedTo
          ? renamedTo
          : manifest.defaultCellTypeId,
    };

    onChange(nextManifest);
    if (renamedTo) {
      setSelectedId(renamedTo);
    }
  };

  const handleAddCell = () => {
    if (readOnly) return;
    const id = makeUniqueId(
      'cell',
      manifest.cellTypes.map((c) => c.id)
    );
    const nextCell: CellTypeManifest = {
      id,
      name: `Cell ${manifest.cellTypes.length + 1}`,
      description: '',
      defaultSpriteId: manifest.sprites[0]?.id ?? null,
      defaultColor: '#334155',
      defaultOpacity: 1,
      substrateSpriteId: null,
      stateSchema: [],
      graph: {
        nodes: [
          {
            id: 'ev_click',
            type: 'event.click',
            data: {},
            position: { x: 80, y: 120 },
          },
        ],
        edges: [],
      },
    };
    onChange({ ...manifest, cellTypes: [...manifest.cellTypes, nextCell] });
    setSelectedId(id);
  };

  const handleDuplicateCell = () => {
    if (readOnly || !selectedCell) return;
    const id = makeUniqueId(
      `${selectedCell.id}_copy`,
      manifest.cellTypes.map((c) => c.id)
    );
    const copy: CellTypeManifest = JSON.parse(JSON.stringify(selectedCell));
    copy.id = id;
    copy.name = `${selectedCell.name} Copy`;
    onChange({ ...manifest, cellTypes: [...manifest.cellTypes, copy] });
    setSelectedId(id);
  };

  const handleDeleteCell = (cellId: string) => {
    if (readOnly || manifest.cellTypes.length <= 1) return;
    const remaining = manifest.cellTypes.filter((c) => c.id !== cellId);
    const nextDefault =
      manifest.defaultCellTypeId === cellId
        ? remaining[0].id
        : manifest.defaultCellTypeId;
    onChange({
      ...manifest,
      cellTypes: remaining,
      defaultCellTypeId: nextDefault,
    });
    if (selectedId === cellId) {
      setSelectedId(remaining[0]?.id ?? '');
    }
  };

  const addStateField = () => {
    if (!selectedCell || readOnly) return;
    const key = makeUniqueId(
      'field',
      selectedCell.stateSchema.map((f) => f.key)
    );
    const field: StateFieldManifest = {
      key,
      label: 'New Field',
      type: 'number',
      initialValue: 0,
      access: 'public',
    };
    updateCell(selectedCell.id, (c) => ({
      ...c,
      stateSchema: [...c.stateSchema, field],
    }));
  };

  const updateStateField = (
    idx: number,
    patch: Partial<StateFieldManifest>
  ) => {
    if (!selectedCell || readOnly) return;
    updateCell(selectedCell.id, (c) => {
      const next = [...c.stateSchema];
      next[idx] = { ...next[idx], ...patch };
      return { ...c, stateSchema: next };
    });
  };

  const removeStateField = (idx: number) => {
    if (!selectedCell || readOnly) return;
    updateCell(selectedCell.id, (c) => {
      const removed = c.stateSchema[idx];
      return {
        ...c,
        stateSchema: c.stateSchema.filter((_, i) => i !== idx),
        priorityByState:
          c.priorityByState === removed?.key ? undefined : c.priorityByState,
      };
    });
  };

  const numericStateFields = selectedCell
    ? selectedCell.stateSchema.filter((f) => f.type === 'number')
    : [];

  const hoverSelectValue =
    selectedCell?.hoverInterfaceId === undefined
      ? '__inherit__'
      : selectedCell.hoverInterfaceId === null
        ? '__none__'
        : selectedCell.hoverInterfaceId;

  const activeSprite = selectedCell?.defaultSpriteId
    ? spriteById.get(selectedCell.defaultSpriteId)
    : undefined;
  const activeSubstrate = selectedCell?.substrateSpriteId
    ? spriteById.get(selectedCell.substrateSpriteId)
    : undefined;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left: Cell Types List */}
      <aside className="w-60 shrink-0 border-r border-[#1F2A38] bg-[#111720] flex flex-col min-h-0">
        <div className="p-3 border-b border-[#1F2A38] flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#E6EDF3]">
            Cell Types ({manifest.cellTypes.length})
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddCell}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {manifest.cellTypes.map((ct) => {
            const active = ct.id === selectedCell?.id;
            const sprite = ct.defaultSpriteId
              ? spriteById.get(ct.defaultSpriteId)
              : undefined;
            const isDefault = ct.id === manifest.defaultCellTypeId;
            return (
              <div
                key={ct.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors ${
                  active
                    ? 'bg-[#17202B] border-[#10B981]'
                    : 'bg-transparent border-transparent hover:bg-[#17202B]/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(ct.id)}
                  className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <div
                    className="w-7 h-7 rounded-[2px] border border-white/10 shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ backgroundColor: ct.defaultColor }}
                  >
                    {sprite && (
                      <img
                        src={sprite.dataUrl}
                        alt=""
                        className="w-full h-full"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#E6EDF3] truncate">
                      {ct.name}
                    </div>
                    <div className="font-mono text-[10px] text-[#8B98A9] truncate">
                      {ct.id}
                      {isDefault ? ' · default' : ''}
                    </div>
                  </div>
                </button>
                {!readOnly && manifest.cellTypes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCell(ct.id)}
                    title="Delete cell type"
                    className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right: Selected Cell Editor */}
      {selectedCell ? (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Sub-tab Header */}
          <div className="h-11 shrink-0 border-b border-[#1F2A38] bg-[#111720] px-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'properties', label: 'Properties & State' },
                  {
                    id: 'graph',
                    label: `Behavior Graph (${selectedCell.graph.nodes.length})`,
                  },
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

            {!readOnly && (
              <button
                type="button"
                onClick={handleDuplicateCell}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] rounded cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate</span>
              </button>
            )}
          </div>

          {subTab === 'properties' ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl space-y-8">
                {/* Identity & Visuals */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1F2A38]">
                    <h2 className="text-sm font-semibold text-[#E6EDF3]">
                      Identity & Visuals
                    </h2>
                    {/* Live Composite Tile Swatch */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#8B98A9]">Preview</span>
                      <div
                        className="relative w-8 h-8 rounded-[2px] border border-[#2D3C4E] overflow-hidden"
                        style={{ backgroundColor: selectedCell.defaultColor }}
                      >
                        {activeSubstrate && (
                          <img
                            src={activeSubstrate.dataUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        )}
                        {activeSprite && (
                          <img
                            src={activeSprite.dataUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full"
                            style={{
                              imageRendering: 'pixelated',
                              opacity: selectedCell.defaultOpacity ?? 1,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_CLASS}>Cell Name</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={selectedCell.name}
                        onChange={(e) =>
                          updateCell(selectedCell.id, (c) => ({
                            ...c,
                            name: e.target.value,
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Cell ID</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={selectedCell.id}
                        onChange={(e) =>
                          updateCell(selectedCell.id, (c) => ({
                            ...c,
                            id: e.target.value,
                          }))
                        }
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Description</label>
                    <textarea
                      rows={2}
                      disabled={readOnly}
                      value={selectedCell.description ?? ''}
                      onChange={(e) =>
                        updateCell(selectedCell.id, (c) => ({
                          ...c,
                          description: e.target.value,
                        }))
                      }
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_CLASS}>Default Sprite</label>
                      <select
                        disabled={readOnly}
                        value={selectedCell.defaultSpriteId ?? ''}
                        onChange={(e) =>
                          updateCell(selectedCell.id, (c) => ({
                            ...c,
                            defaultSpriteId: e.target.value || null,
                          }))
                        }
                        className={INPUT_CLASS}
                      >
                        <option value="">None (Solid color)</option>
                        {manifest.sprites.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} ({sp.id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>
                        Substrate Sprite (Ground Layer)
                      </label>
                      <select
                        disabled={readOnly}
                        value={selectedCell.substrateSpriteId ?? ''}
                        onChange={(e) =>
                          updateCell(selectedCell.id, (c) => ({
                            ...c,
                            substrateSpriteId: e.target.value || null,
                          }))
                        }
                        className={INPUT_CLASS}
                      >
                        <option value="">None</option>
                        {manifest.sprites.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} ({sp.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={LABEL_CLASS}>Default Fill Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          disabled={readOnly}
                          value={selectedCell.defaultColor}
                          onChange={(e) =>
                            updateCell(selectedCell.id, (c) => ({
                              ...c,
                              defaultColor: e.target.value,
                            }))
                          }
                          className="w-9 h-[30px] bg-[#0B0F14] border border-[#1F2A38] rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          disabled={readOnly}
                          value={selectedCell.defaultColor}
                          onChange={(e) =>
                            updateCell(selectedCell.id, (c) => ({
                              ...c,
                              defaultColor: e.target.value,
                            }))
                          }
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={LABEL_CLASS}>
                        Default Opacity ({selectedCell.defaultOpacity ?? 1})
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        disabled={readOnly}
                        value={selectedCell.defaultOpacity ?? 1}
                        onChange={(e) =>
                          updateCell(selectedCell.id, (c) => ({
                            ...c,
                            defaultOpacity: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#10B981] mt-1.5 cursor-pointer"
                      />
                    </div>
                  </div>
                </section>

                {/* Hover & Simulation Priority */}
                <section className="space-y-4">
                  <h2 className="text-sm font-semibold text-[#E6EDF3] pb-2 border-b border-[#1F2A38]">
                    Hover Card & Execution Priority
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_CLASS}>
                        Hover Interface Override
                      </label>
                      <select
                        disabled={readOnly}
                        value={hoverSelectValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateCell(selectedCell.id, (c) => ({
                            ...c,
                            hoverInterfaceId:
                              v === '__inherit__'
                                ? undefined
                                : v === '__none__'
                                  ? null
                                  : v,
                          }));
                        }}
                        className={INPUT_CLASS}
                      >
                        <option value="__inherit__">
                          Inherit Ruleset Default (
                          {manifest.defaultHoverInterfaceId ?? 'Disabled'})
                        </option>
                        <option value="__none__">Disabled (No hover card)</option>
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

                    <div>
                      <label className={LABEL_CLASS}>
                        Phase 4 Priority Field (Higher runs first)
                      </label>
                      <select
                        disabled={readOnly}
                        value={selectedCell.priorityByState ?? ''}
                        onChange={(e) =>
                          updateCell(selectedCell.id, (c) => ({
                            ...c,
                            priorityByState: e.target.value || undefined,
                          }))
                        }
                        className={INPUT_CLASS}
                      >
                        <option value="">Default (Grid scan order)</option>
                        {numericStateFields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label ?? f.key} ({f.key})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                {/* Cell State Schema */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1F2A38]">
                    <div>
                      <h2 className="text-sm font-semibold text-[#E6EDF3]">
                        Instance State Schema
                      </h2>
                      <p className="text-[11px] text-[#8B98A9] mt-0.5">
                        Per-tile fields initialized when this cell enters the grid. Public & readonly fields appear in inspector interfaces.
                      </p>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={addStateField}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Field</span>
                      </button>
                    )}
                  </div>

                  {selectedCell.stateSchema.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-[#1F2A38] rounded-md text-xs text-[#8B98A9]">
                      No state fields on this cell type.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedCell.stateSchema.map((field, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-[#111720] border border-[#1F2A38] rounded-md grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end"
                        >
                          <div>
                            <label className={LABEL_CLASS}>Key</label>
                            <input
                              type="text"
                              disabled={readOnly}
                              value={field.key}
                              onChange={(e) =>
                                updateStateField(idx, { key: e.target.value })
                              }
                              className={`${INPUT_CLASS} font-mono`}
                            />
                          </div>
                          <div>
                            <label className={LABEL_CLASS}>Label</label>
                            <input
                              type="text"
                              disabled={readOnly}
                              value={field.label ?? ''}
                              onChange={(e) =>
                                updateStateField(idx, { label: e.target.value })
                              }
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <label className={LABEL_CLASS}>Type</label>
                            <select
                              disabled={readOnly}
                              value={field.type}
                              onChange={(e) => {
                                const t = e.target.value as ValueType;
                                updateStateField(idx, {
                                  type: t,
                                  initialValue:
                                    t === 'number'
                                      ? 0
                                      : t === 'boolean'
                                        ? false
                                        : '',
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
                            <label className={LABEL_CLASS}>Initial</label>
                            {field.type === 'boolean' ? (
                              <select
                                disabled={readOnly}
                                value={field.initialValue ? 'true' : 'false'}
                                onChange={(e) =>
                                  updateStateField(idx, {
                                    initialValue: e.target.value === 'true',
                                  })
                                }
                                className={INPUT_CLASS}
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : field.type === 'number' ? (
                              <input
                                type="number"
                                step="any"
                                disabled={readOnly}
                                value={Number(field.initialValue)}
                                onChange={(e) =>
                                  updateStateField(idx, {
                                    initialValue: Number(e.target.value),
                                  })
                                }
                                className={`${INPUT_CLASS} font-mono tabular-nums`}
                              />
                            ) : (
                              <input
                                type="text"
                                disabled={readOnly}
                                value={String(field.initialValue)}
                                onChange={(e) =>
                                  updateStateField(idx, {
                                    initialValue: e.target.value,
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            )}
                          </div>
                          <div>
                            <label className={LABEL_CLASS}>Access</label>
                            <select
                              disabled={readOnly}
                              value={field.access}
                              onChange={(e) =>
                                updateStateField(idx, {
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
                          <div className="flex justify-end">
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => removeStateField(idx)}
                                title="Delete field"
                                className="p-1.5 text-[#8B98A9] hover:text-[#F43F5E] bg-[#0B0F14] border border-[#1F2A38] rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <NodeGraphEditor
              graph={selectedCell.graph}
              scope="cell"
              manifest={manifest}
              cellStateSchema={selectedCell.stateSchema}
              readOnly={readOnly}
              onChange={(nextGraph) =>
                updateCell(selectedCell.id, (c) => ({ ...c, graph: nextGraph }))
              }
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-[#8B98A9]">
          Add a cell type to start editing.
        </div>
      )}
    </div>
  );
}
