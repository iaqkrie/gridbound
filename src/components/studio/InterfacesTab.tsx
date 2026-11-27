import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  BUILTIN_INTERFACE_IDS,
  BUILTIN_INTERFACES,
  BuiltinInterfaceId,
  cloneBuiltinInterface,
  CompareOp,
  evaluateUiConditions,
  formatUiTemplate,
  InterfaceBlock,
  InterfaceManifest,
  InterfaceRole,
  RulesetManifest,
  UiButtonDef,
  UiCondition,
  UiTemplateContext,
} from '../../engine/sdk';
import { NodeGraphEditor } from './NodeGraphEditor';
import { makeUniqueId } from './studioUtils';

interface InterfacesTabProps {
  manifest: RulesetManifest;
  readOnly?: boolean;
  onChange: (next: RulesetManifest) => void;
}

type InterfaceSubTab = 'blocks' | 'graph';

const INPUT_CLASS =
  'w-full bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded px-2.5 py-1.5 text-xs text-[#E6EDF3] focus:outline-none disabled:opacity-60';

const LABEL_CLASS = 'block text-[11px] font-medium text-[#8B98A9] mb-1';

const TONE_TEXT: Record<string, string> = {
  default: 'text-[#E6EDF3]',
  muted: 'text-[#8B98A9]',
  accent: 'text-[#38BDF8]',
  positive: 'text-[#10B981]',
  warning: 'text-[#F59E0B]',
  danger: 'text-[#F43F5E]',
};

function buttonVariantClass(variant: UiButtonDef['variant']): string {
  if (variant === 'danger') {
    return 'text-[#E6EDF3] bg-[#F43F5E]';
  }
  if (variant === 'secondary') {
    return 'text-[#E6EDF3] bg-[#17202B] border border-[#2D3C4E]';
  }
  return 'text-[#0B0F14] bg-[#10B981]';
}

function createDefaultBlock(kind: InterfaceBlock['kind']): InterfaceBlock {
  switch (kind) {
    case 'text':
      return { kind: 'text', text: '{{cell.name}} details', tone: 'muted' };
    case 'stat':
      return { kind: 'stat', label: 'Metric', value: '0', tone: 'default' };
    case 'button':
      return {
        kind: 'button',
        label: 'Action',
        actionId: 'do_action',
        variant: 'primary',
      };
    case 'buttonRow':
      return {
        kind: 'buttonRow',
        buttons: [
          { label: 'Cancel', closeResult: false, variant: 'secondary' },
          { label: 'Confirm', closeResult: true, variant: 'primary' },
        ],
      };
    case 'selectList':
      return {
        kind: 'selectList',
        label: 'Choose Option',
        actionId: 'select_item',
        source: 'globalVars',
      };
    case 'cellStateList':
      return { kind: 'cellStateList' };
    case 'supplyList':
      return { kind: 'supplyList', onlyPositive: true };
  }
}

export function InterfacesTab({
  manifest,
  readOnly,
  onChange,
}: InterfacesTabProps) {
  const [selectedId, setSelectedId] = useState<string>(
    manifest.interfaces[0]?.id ?? BUILTIN_INTERFACE_IDS[0]
  );
  const [subTab, setSubTab] = useState<InterfaceSubTab>('blocks');
  const [newBlockKind, setNewBlockKind] =
    useState<InterfaceBlock['kind']>('text');
  const [previewCellId, setPreviewCellId] = useState<string>(
    manifest.cellTypes[0]?.id ?? ''
  );

  const isBuiltinSelected = BUILTIN_INTERFACE_IDS.includes(
    selectedId as BuiltinInterfaceId
  );
  const selectedBuiltin = isBuiltinSelected
    ? BUILTIN_INTERFACES[selectedId as BuiltinInterfaceId]
    : null;
  const selectedCustom = !isBuiltinSelected
    ? (manifest.interfaces.find((i) => i.id === selectedId) ?? null)
    : null;

  const updateCustomInterface = (
    ifaceId: string,
    updater: (iface: InterfaceManifest) => InterfaceManifest
  ) => {
    if (readOnly) return;
    let renamedTo: string | null = null;
    const nextList = manifest.interfaces.map((item) => {
      if (item.id !== ifaceId) return item;
      const updated = updater(item);
      if (updated.id !== item.id) renamedTo = updated.id;
      return updated;
    });
    onChange({ ...manifest, interfaces: nextList });
    if (renamedTo) setSelectedId(renamedTo);
  };

  const handleAddInterface = () => {
    if (readOnly) return;
    const id = makeUniqueId(
      'custom_ui',
      manifest.interfaces.map((i) => i.id)
    );
    const created: InterfaceManifest = {
      id,
      title: '{{cell.name}}',
      subtitle: '',
      width: 260,
      role: 'popover',
      showSwatch: true,
      blocks: [
        { kind: 'text', text: 'Configure this cell.', tone: 'muted' },
        {
          kind: 'button',
          label: 'Run Action',
          actionId: 'primary_action',
          variant: 'primary',
        },
      ],
      graph: {
        nodes: [
          {
            id: 'ui_act_1',
            type: 'event.uiAction',
            data: { actionId: 'primary_action' },
            position: { x: 80, y: 120 },
          },
        ],
        edges: [],
      },
    };
    onChange({ ...manifest, interfaces: [...manifest.interfaces, created] });
    setSelectedId(id);
    setSubTab('blocks');
  };

  const handleCloneBuiltin = (builtinId: BuiltinInterfaceId) => {
    if (readOnly) return;
    const baseName = builtinId.replace('@builtin/', 'custom_');
    const id = makeUniqueId(
      baseName,
      manifest.interfaces.map((i) => i.id)
    );
    const cloned = cloneBuiltinInterface(builtinId, id);
    onChange({ ...manifest, interfaces: [...manifest.interfaces, cloned] });
    setSelectedId(id);
    setSubTab('blocks');
  };

  const handleDuplicateCustom = () => {
    if (readOnly || !selectedCustom) return;
    const id = makeUniqueId(
      `${selectedCustom.id}_copy`,
      manifest.interfaces.map((i) => i.id)
    );
    const copy: InterfaceManifest = JSON.parse(JSON.stringify(selectedCustom));
    copy.id = id;
    onChange({ ...manifest, interfaces: [...manifest.interfaces, copy] });
    setSelectedId(id);
  };

  const handleDeleteCustom = (ifaceId: string) => {
    if (readOnly) return;
    const next = manifest.interfaces.filter((i) => i.id !== ifaceId);
    onChange({ ...manifest, interfaces: next });
    if (selectedId === ifaceId) {
      setSelectedId(next[0]?.id ?? BUILTIN_INTERFACE_IDS[0]);
    }
  };

  // Live Preview Context for custom interface rendering
  const previewCell =
    manifest.cellTypes.find((c) => c.id === previewCellId) ??
    manifest.cellTypes[0];

  const previewSprite = useMemo(() => {
    if (!previewCell?.defaultSpriteId) return undefined;
    return manifest.sprites.find((s) => s.id === previewCell.defaultSpriteId);
  }, [manifest.sprites, previewCell]);

  const previewTplCtx = useMemo<UiTemplateContext>(() => {
    const stateMap = new Map(
      (previewCell?.stateSchema ?? []).map((f) => [f.key, f.initialValue])
    );
    const varMap = new Map(
      manifest.globalState.variables.map((v) => [v.id, v])
    );
    const setupMap = new Map(
      (manifest.setupOptions ?? []).map((o) => [o.id, o.defaultValue])
    );
    return {
      cellName: previewCell?.name ?? 'Cell',
      cellTypeId: previewCell?.id ?? 'cell',
      getState: (key) => stateMap.get(key) ?? 0,
      getGlobal: (varId) => varMap.get(varId)?.initialValue ?? 0,
      getGlobalCap: (varId) => varMap.get(varId)?.initialMax ?? 0,
      getGlobalVarName: (varId) => varMap.get(varId)?.name ?? varId,
      getSupply: () => 2,
      getSetup: (paramId) => setupMap.get(paramId) ?? 0,
      params: {
        title: 'Preview Title',
        message: 'Sample parameter message for preview.',
      },
    };
  }, [manifest, previewCell]);

  const updateBlock = (idx: number, nextBlock: InterfaceBlock) => {
    if (!selectedCustom || readOnly) return;
    updateCustomInterface(selectedCustom.id, (iface) => {
      const next = [...iface.blocks];
      next[idx] = nextBlock;
      return { ...iface, blocks: next };
    });
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    if (!selectedCustom || readOnly) return;
    const target = idx + dir;
    if (target < 0 || target >= selectedCustom.blocks.length) return;
    updateCustomInterface(selectedCustom.id, (iface) => {
      const next = [...iface.blocks];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...iface, blocks: next };
    });
  };

  const deleteBlock = (idx: number) => {
    if (!selectedCustom || readOnly) return;
    updateCustomInterface(selectedCustom.id, (iface) => ({
      ...iface,
      blocks: iface.blocks.filter((_, i) => i !== idx),
    }));
  };

  const renderConditionEditor = (
    label: string,
    conditions: UiCondition[] | undefined,
    onUpdate: (next: UiCondition[] | undefined) => void
  ) => {
    const list = conditions ?? [];
    return (
      <div className="pt-2 border-t border-[#1F2A38]/80 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-[#8B98A9]">{label}</span>
          {!readOnly && (
            <button
              type="button"
              onClick={() =>
                onUpdate([
                  ...list,
                  { source: 'state', key: '', op: '==', value: 0 },
                ])
              }
              className="text-[10px] text-[#10B981] hover:underline cursor-pointer"
            >
              + Condition
            </button>
          )}
        </div>
        {list.map((cond, cIdx) => (
          <div key={cIdx} className="grid grid-cols-12 gap-1 items-center">
            <select
              disabled={readOnly}
              value={cond.source}
              onChange={(e) => {
                const next = [...list];
                next[cIdx] = {
                  ...cond,
                  source: e.target.value as UiCondition['source'],
                };
                onUpdate(next);
              }}
              className="col-span-3 bg-[#0B0F14] border border-[#1F2A38] rounded px-1.5 py-1 text-[11px] text-[#E6EDF3]"
            >
              <option value="state">state</option>
              <option value="global">global</option>
              <option value="globalCap">cap</option>
              <option value="supply">supply</option>
              <option value="setup">setup</option>
              <option value="param">param</option>
            </select>
            <input
              type="text"
              disabled={readOnly}
              value={cond.key}
              placeholder="key"
              onChange={(e) => {
                const next = [...list];
                next[cIdx] = { ...cond, key: e.target.value };
                onUpdate(next);
              }}
              className="col-span-3 bg-[#0B0F14] border border-[#1F2A38] rounded px-1.5 py-1 text-[11px] font-mono text-[#E6EDF3]"
            />
            <select
              disabled={readOnly}
              value={cond.op}
              onChange={(e) => {
                const next = [...list];
                next[cIdx] = { ...cond, op: e.target.value as CompareOp };
                onUpdate(next);
              }}
              className="col-span-2 bg-[#0B0F14] border border-[#1F2A38] rounded px-1 py-1 text-[11px] font-mono text-[#E6EDF3]"
            >
              <option value="==">==</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
            </select>
            <input
              type="text"
              disabled={readOnly}
              value={String(cond.value)}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed =
                  raw === 'true'
                    ? true
                    : raw === 'false'
                      ? false
                      : raw !== '' && !Number.isNaN(Number(raw))
                        ? Number(raw)
                        : raw;
                const next = [...list];
                next[cIdx] = { ...cond, value: parsed };
                onUpdate(next);
              }}
              className="col-span-3 bg-[#0B0F14] border border-[#1F2A38] rounded px-1.5 py-1 text-[11px] font-mono text-[#E6EDF3]"
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  const next = list.filter((_, i) => i !== cIdx);
                  onUpdate(next.length > 0 ? next : undefined);
                }}
                className="col-span-1 text-[#8B98A9] hover:text-[#F43F5E] flex justify-center cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left Sidebar: Built-in Templates + Custom Interfaces */}
      <aside className="w-64 shrink-0 border-r border-[#1F2A38] bg-[#111720] flex flex-col min-h-0">
        {/* Built-in Templates */}
        <div className="p-3 border-b border-[#1F2A38] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8B98A9] uppercase tracking-wider">
              Built-in Templates
            </span>
            <Lock className="w-3 h-3 text-[#8B98A9]" />
          </div>
          <div className="space-y-1">
            {BUILTIN_INTERFACE_IDS.map((bid) => {
              const meta = BUILTIN_INTERFACES[bid];
              const active = selectedId === bid;
              return (
                <button
                  key={bid}
                  type="button"
                  onClick={() => setSelectedId(bid)}
                  className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#17202B] border-[#10B981]'
                      : 'bg-transparent border-transparent hover:bg-[#17202B]/50'
                  }`}
                >
                  <div className="text-xs font-medium text-[#E6EDF3] truncate">
                    {meta.name}
                  </div>
                  <div className="font-mono text-[10px] text-[#8B98A9] truncate">
                    {meta.id} · {meta.role}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Interfaces */}
        <div className="p-3 border-b border-[#1F2A38] flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#E6EDF3]">
            Custom ({manifest.interfaces.length})
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddInterface}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {manifest.interfaces.length === 0 ? (
            <p className="px-2 py-4 text-[11px] text-[#8B98A9] text-center">
              No custom interfaces yet. Add one or clone a built-in template.
            </p>
          ) : (
            manifest.interfaces.map((iface) => {
              const active = selectedId === iface.id;
              return (
                <div
                  key={iface.id}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md border transition-colors ${
                    active
                      ? 'bg-[#17202B] border-[#10B981]'
                      : 'bg-transparent border-transparent hover:bg-[#17202B]/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(iface.id)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="text-xs font-medium text-[#E6EDF3] truncate">
                      {iface.title || iface.id}
                    </div>
                    <div className="font-mono text-[10px] text-[#8B98A9] truncate">
                      {iface.id} · {iface.role ?? 'popover'}
                    </div>
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustom(iface.id)}
                      title="Delete interface"
                      className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Pane: Built-in Template Inspector OR Custom Interface Editor */}
      {selectedBuiltin ? (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-xl bg-[#111720] border border-[#1F2A38] rounded-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#E6EDF3]">
                  {selectedBuiltin.name}
                </h2>
                <div className="font-mono text-xs text-[#8B98A9] mt-0.5">
                  {selectedBuiltin.id} · role: {selectedBuiltin.role} · returns:{' '}
                  {selectedBuiltin.resultType}
                </div>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleCloneBuiltin(selectedBuiltin.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Clone to Custom</span>
                </button>
              )}
            </div>

            <p className="text-xs text-[#E6EDF3]/90 leading-relaxed">
              {selectedBuiltin.description}
            </p>

            <div className="pt-3 border-t border-[#1F2A38] text-[11px] text-[#8B98A9] leading-relaxed">
              Built-in interfaces are engine-provided templates and cannot be modified or deleted directly. Click{' '}
              <strong className="text-[#E6EDF3]">Clone to Custom</strong> to copy its layout into your ruleset and customize blocks or attach node logic.
            </div>
          </div>
        </div>
      ) : selectedCustom ? (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Sub-tab Bar */}
          <div className="h-11 shrink-0 border-b border-[#1F2A38] bg-[#111720] px-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSubTab('blocks')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  subTab === 'blocks'
                    ? 'bg-[#17202B] text-[#E6EDF3] border border-[#2D3C4E]'
                    : 'text-[#8B98A9] hover:text-[#E6EDF3]'
                }`}
              >
                Blocks & Preview ({selectedCustom.blocks.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('graph')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  subTab === 'graph'
                    ? 'bg-[#17202B] text-[#E6EDF3] border border-[#2D3C4E]'
                    : 'text-[#8B98A9] hover:text-[#E6EDF3]'
                }`}
              >
                Logic Graph ({selectedCustom.graph?.nodes.length ?? 0})
              </button>
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={handleDuplicateCustom}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] rounded cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate</span>
              </button>
            )}
          </div>

          {subTab === 'blocks' ? (
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Block Builder Column */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Metadata */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-[#E6EDF3] pb-1.5 border-b border-[#1F2A38]">
                    Interface Settings
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>Interface ID</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={selectedCustom.id}
                        onChange={(e) =>
                          updateCustomInterface(selectedCustom.id, (i) => ({
                            ...i,
                            id: e.target.value,
                          }))
                        }
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>
                        Title (supports {'{{cell.name}}'})
                      </label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={selectedCustom.title}
                        onChange={(e) =>
                          updateCustomInterface(selectedCustom.id, (i) => ({
                            ...i,
                            title: e.target.value,
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Role</label>
                      <select
                        disabled={readOnly}
                        value={selectedCustom.role ?? 'popover'}
                        onChange={(e) =>
                          updateCustomInterface(selectedCustom.id, (i) => ({
                            ...i,
                            role: e.target.value as InterfaceRole,
                          }))
                        }
                        className={INPUT_CLASS}
                      >
                        <option value="popover">Popover</option>
                        <option value="modal">Modal</option>
                        <option value="hover">Hover Card</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-1">
                      <label className={LABEL_CLASS}>Subtitle</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={selectedCustom.subtitle ?? ''}
                        onChange={(e) =>
                          updateCustomInterface(selectedCustom.id, (i) => ({
                            ...i,
                            subtitle: e.target.value,
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Width (px)</label>
                      <input
                        type="number"
                        min={180}
                        max={480}
                        disabled={readOnly}
                        value={selectedCustom.width ?? 256}
                        onChange={(e) =>
                          updateCustomInterface(selectedCustom.id, (i) => ({
                            ...i,
                            width: Math.max(180, Number(e.target.value)),
                          }))
                        }
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-[#E6EDF3] pb-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={Boolean(selectedCustom.showSwatch)}
                        onChange={(e) =>
                          updateCustomInterface(selectedCustom.id, (i) => ({
                            ...i,
                            showSwatch: e.target.checked,
                          }))
                        }
                        className="accent-[#10B981]"
                      />
                      <span>Show cell sprite swatch</span>
                    </label>
                  </div>
                </section>

                {/* Blocks List */}
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#1F2A38]">
                    <h3 className="text-xs font-semibold text-[#E6EDF3]">
                      Layout Blocks
                    </h3>
                    {!readOnly && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={newBlockKind}
                          onChange={(e) =>
                            setNewBlockKind(
                              e.target.value as InterfaceBlock['kind']
                            )
                          }
                          className="bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-xs text-[#E6EDF3]"
                        >
                          <option value="text">Text</option>
                          <option value="stat">Stat Row</option>
                          <option value="button">Button</option>
                          <option value="buttonRow">Button Row</option>
                          <option value="selectList">Select List</option>
                          <option value="cellStateList">Cell State List</option>
                          <option value="supplyList">Supply List</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            updateCustomInterface(selectedCustom.id, (i) => ({
                              ...i,
                              blocks: [
                                ...i.blocks,
                                createDefaultBlock(newBlockKind),
                              ],
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Block</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedCustom.blocks.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-[#1F2A38] rounded-md text-xs text-[#8B98A9]">
                      No blocks yet. Add a Text, Stat, Button, or Select List block above.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCustom.blocks.map((block, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 bg-[#111720] border border-[#1F2A38] rounded-md space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-semibold text-[#10B981]">
                              {idx + 1}. {block.kind}
                            </span>
                            {!readOnly && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveBlock(idx, -1)}
                                  className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    idx === selectedCustom.blocks.length - 1
                                  }
                                  onClick={() => moveBlock(idx, 1)}
                                  className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteBlock(idx)}
                                  className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Kind-specific editors */}
                          {block.kind === 'text' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              <div className="md:col-span-2">
                                <label className={LABEL_CLASS}>Text</label>
                                <input
                                  type="text"
                                  disabled={readOnly}
                                  value={block.text}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      ...block,
                                      text: e.target.value,
                                    })
                                  }
                                  className={INPUT_CLASS}
                                />
                              </div>
                              <div>
                                <label className={LABEL_CLASS}>Tone</label>
                                <select
                                  disabled={readOnly}
                                  value={block.tone ?? 'default'}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      ...block,
                                      tone: e.target.value as typeof block.tone,
                                    })
                                  }
                                  className={INPUT_CLASS}
                                >
                                  <option value="default">Default</option>
                                  <option value="muted">Muted</option>
                                  <option value="accent">Accent</option>
                                  <option value="positive">Positive</option>
                                  <option value="warning">Warning</option>
                                  <option value="danger">Danger</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {block.kind === 'stat' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              <div>
                                <label className={LABEL_CLASS}>Label</label>
                                <input
                                  type="text"
                                  disabled={readOnly}
                                  value={block.label}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      ...block,
                                      label: e.target.value,
                                    })
                                  }
                                  className={INPUT_CLASS}
                                />
                              </div>
                              <div>
                                <label className={LABEL_CLASS}>Value</label>
                                <input
                                  type="text"
                                  disabled={readOnly}
                                  value={block.value}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      ...block,
                                      value: e.target.value,
                                    })
                                  }
                                  className={`${INPUT_CLASS} font-mono`}
                                />
                              </div>
                              <div>
                                <label className={LABEL_CLASS}>Tone</label>
                                <select
                                  disabled={readOnly}
                                  value={block.tone ?? 'default'}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      ...block,
                                      tone: e.target.value as typeof block.tone,
                                    })
                                  }
                                  className={INPUT_CLASS}
                                >
                                  <option value="default">Default</option>
                                  <option value="muted">Muted</option>
                                  <option value="accent">Accent</option>
                                  <option value="positive">Positive</option>
                                  <option value="warning">Warning</option>
                                  <option value="danger">Danger</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {block.kind === 'button' && (
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                                <div>
                                  <label className={LABEL_CLASS}>Label</label>
                                  <input
                                    type="text"
                                    disabled={readOnly}
                                    value={block.label}
                                    onChange={(e) =>
                                      updateBlock(idx, {
                                        ...block,
                                        label: e.target.value,
                                      })
                                    }
                                    className={INPUT_CLASS}
                                  />
                                </div>
                                <div>
                                  <label className={LABEL_CLASS}>
                                    Action ID (Graph)
                                  </label>
                                  <input
                                    type="text"
                                    disabled={readOnly}
                                    value={block.actionId ?? ''}
                                    onChange={(e) =>
                                      updateBlock(idx, {
                                        ...block,
                                        actionId: e.target.value || undefined,
                                      })
                                    }
                                    className={`${INPUT_CLASS} font-mono`}
                                  />
                                </div>
                                <div>
                                  <label className={LABEL_CLASS}>
                                    Close Result
                                  </label>
                                  <input
                                    type="text"
                                    disabled={readOnly}
                                    value={
                                      block.closeResult !== undefined
                                        ? String(block.closeResult)
                                        : ''
                                    }
                                    placeholder="optional"
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const parsed =
                                        raw === ''
                                          ? undefined
                                          : raw === 'true'
                                            ? true
                                            : raw === 'false'
                                              ? false
                                              : !Number.isNaN(Number(raw))
                                                ? Number(raw)
                                                : raw;
                                      updateBlock(idx, {
                                        ...block,
                                        closeResult: parsed,
                                      });
                                    }}
                                    className={`${INPUT_CLASS} font-mono`}
                                  />
                                </div>
                                <div>
                                  <label className={LABEL_CLASS}>Variant</label>
                                  <select
                                    disabled={readOnly}
                                    value={block.variant ?? 'primary'}
                                    onChange={(e) =>
                                      updateBlock(idx, {
                                        ...block,
                                        variant: e.target
                                          .value as UiButtonDef['variant'],
                                      })
                                    }
                                    className={INPUT_CLASS}
                                  >
                                    <option value="primary">Primary</option>
                                    <option value="secondary">Secondary</option>
                                    <option value="danger">Danger</option>
                                  </select>
                                </div>
                              </div>
                              {renderConditionEditor(
                                'Disabled When',
                                block.disabledWhen,
                                (next) =>
                                  updateBlock(idx, {
                                    ...block,
                                    disabledWhen: next,
                                  })
                              )}
                            </div>
                          )}

                          {block.kind === 'buttonRow' && (
                            <div className="space-y-2">
                              {block.buttons.map((btn, bIdx) => (
                                <div
                                  key={bIdx}
                                  className="grid grid-cols-12 gap-1.5 items-center"
                                >
                                  <input
                                    type="text"
                                    disabled={readOnly}
                                    value={btn.label}
                                    placeholder="Label"
                                    onChange={(e) => {
                                      const nextBtns = [...block.buttons];
                                      nextBtns[bIdx] = {
                                        ...btn,
                                        label: e.target.value,
                                      };
                                      updateBlock(idx, {
                                        ...block,
                                        buttons: nextBtns,
                                      });
                                    }}
                                    className="col-span-3 bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-xs text-[#E6EDF3]"
                                  />
                                  <input
                                    type="text"
                                    disabled={readOnly}
                                    value={btn.actionId ?? ''}
                                    placeholder="actionId"
                                    onChange={(e) => {
                                      const nextBtns = [...block.buttons];
                                      nextBtns[bIdx] = {
                                        ...btn,
                                        actionId: e.target.value || undefined,
                                      };
                                      updateBlock(idx, {
                                        ...block,
                                        buttons: nextBtns,
                                      });
                                    }}
                                    className="col-span-3 bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-xs font-mono text-[#E6EDF3]"
                                  />
                                  <input
                                    type="text"
                                    disabled={readOnly}
                                    value={
                                      btn.closeResult !== undefined
                                        ? String(btn.closeResult)
                                        : ''
                                    }
                                    placeholder="result"
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const parsed =
                                        raw === ''
                                          ? undefined
                                          : raw === 'true'
                                            ? true
                                            : raw === 'false'
                                              ? false
                                              : !Number.isNaN(Number(raw))
                                                ? Number(raw)
                                                : raw;
                                      const nextBtns = [...block.buttons];
                                      nextBtns[bIdx] = {
                                        ...btn,
                                        closeResult: parsed,
                                      };
                                      updateBlock(idx, {
                                        ...block,
                                        buttons: nextBtns,
                                      });
                                    }}
                                    className="col-span-2 bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-xs font-mono text-[#E6EDF3]"
                                  />
                                  <select
                                    disabled={readOnly}
                                    value={btn.variant ?? 'primary'}
                                    onChange={(e) => {
                                      const nextBtns = [...block.buttons];
                                      nextBtns[bIdx] = {
                                        ...btn,
                                        variant: e.target
                                          .value as UiButtonDef['variant'],
                                      };
                                      updateBlock(idx, {
                                        ...block,
                                        buttons: nextBtns,
                                      });
                                    }}
                                    className="col-span-3 bg-[#0B0F14] border border-[#1F2A38] rounded px-1.5 py-1 text-xs text-[#E6EDF3]"
                                  >
                                    <option value="primary">Primary</option>
                                    <option value="secondary">Secondary</option>
                                    <option value="danger">Danger</option>
                                  </select>
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateBlock(idx, {
                                          ...block,
                                          buttons: block.buttons.filter(
                                            (_, i) => i !== bIdx
                                          ),
                                        })
                                      }
                                      className="col-span-1 text-[#8B98A9] hover:text-[#F43F5E] flex justify-center cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBlock(idx, {
                                      ...block,
                                      buttons: [
                                        ...block.buttons,
                                        { label: 'Button', variant: 'secondary' },
                                      ],
                                    })
                                  }
                                  className="text-[11px] text-[#10B981] hover:underline cursor-pointer"
                                >
                                  + Add Row Button
                                </button>
                              )}
                            </div>
                          )}

                          {block.kind === 'selectList' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              <div>
                                <label className={LABEL_CLASS}>Label</label>
                                <input
                                  type="text"
                                  disabled={readOnly}
                                  value={block.label ?? ''}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      ...block,
                                      label: e.target.value,
                                    })
                                  }
                                  className={INPUT_CLASS}
                                />
                              </div>
                              <div>
                                <label className={LABEL_CLASS}>Action ID</label>
                                <input
                                  type="text"
                                  disabled={readOnly}
                                  value={block.actionId}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      ...block,
                                      actionId: e.target.value,
                                    })
                                  }
                                  className={`${INPUT_CLASS} font-mono`}
                                />
                              </div>
                              <div>
                                <label className={LABEL_CLASS}>Source</label>
                                <select
                                  disabled={readOnly}
                                  value={block.source}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      ...block,
                                      source: e.target
                                        .value as 'globalVars' | 'static',
                                    })
                                  }
                                  className={INPUT_CLASS}
                                >
                                  <option value="globalVars">
                                    Global Variables
                                  </option>
                                  <option value="static">Static Options</option>
                                </select>
                              </div>
                              <div>
                                <label className={LABEL_CLASS}>
                                  Selected State Key
                                </label>
                                <input
                                  type="text"
                                  disabled={readOnly}
                                  value={block.selectedStateKey ?? ''}
                                  onChange={(e) =>
                                    updateBlock(idx, {
                                      ...block,
                                      selectedStateKey:
                                        e.target.value || undefined,
                                    })
                                  }
                                  className={`${INPUT_CLASS} font-mono`}
                                />
                              </div>
                              {block.source === 'globalVars' && (
                                <>
                                  <div>
                                    <label className={LABEL_CLASS}>
                                      Filter Tag
                                    </label>
                                    <input
                                      type="text"
                                      disabled={readOnly}
                                      value={block.filterTag ?? ''}
                                      onChange={(e) =>
                                        updateBlock(idx, {
                                          ...block,
                                          filterTag:
                                            e.target.value || undefined,
                                        })
                                      }
                                      placeholder="e.g. storable"
                                      className={`${INPUT_CLASS} font-mono`}
                                    />
                                  </div>
                                  <label className="inline-flex items-center gap-2 text-xs text-[#E6EDF3] pt-4 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      disabled={readOnly}
                                      checked={Boolean(block.filterHasCap)}
                                      onChange={(e) =>
                                        updateBlock(idx, {
                                          ...block,
                                          filterHasCap: e.target.checked,
                                        })
                                      }
                                      className="accent-[#10B981]"
                                    />
                                    <span>Only capped vars</span>
                                  </label>
                                </>
                              )}
                            </div>
                          )}

                          {block.kind === 'cellStateList' && (
                            <div>
                              <label className={LABEL_CLASS}>
                                Exclude State Keys (comma-separated)
                              </label>
                              <input
                                type="text"
                                disabled={readOnly}
                                value={(block.excludeKeys ?? []).join(', ')}
                                onChange={(e) =>
                                  updateBlock(idx, {
                                    ...block,
                                    excludeKeys: e.target.value
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                placeholder="internal_flag, temp"
                                className={`${INPUT_CLASS} font-mono`}
                              />
                            </div>
                          )}

                          {block.kind === 'supplyList' && (
                            <label className="inline-flex items-center gap-2 text-xs text-[#E6EDF3] cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={readOnly}
                                checked={block.onlyPositive !== false}
                                onChange={(e) =>
                                  updateBlock(idx, {
                                    ...block,
                                    onlyPositive: e.target.checked,
                                  })
                                }
                                className="accent-[#10B981]"
                              />
                              <span>Only show supplies with amount &gt; 0</span>
                            </label>
                          )}

                          {renderConditionEditor(
                            'Visible When',
                            block.visibleWhen,
                            (next) =>
                              updateBlock(idx, {
                                ...block,
                                visibleWhen: next,
                              })
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Sticky Live Preview Column */}
              <aside className="w-80 shrink-0 border-l border-[#1F2A38] bg-[#0B0F14] flex flex-col min-h-0">
                <div className="p-3 border-b border-[#1F2A38] bg-[#111720] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#E6EDF3]">
                      Live Preview
                    </span>
                    <span className="font-mono text-[10px] text-[#8B98A9]">
                      {selectedCustom.width ?? 256}px ·{' '}
                      {selectedCustom.role ?? 'popover'}
                    </span>
                  </div>
                  <select
                    value={previewCell?.id ?? ''}
                    onChange={(e) => setPreviewCellId(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-[11px] text-[#E6EDF3]"
                  >
                    {manifest.cellTypes.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        Context cell: {ct.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex items-start justify-center">
                  <div
                    style={{
                      width: `${Math.min(288, Math.max(200, selectedCustom.width ?? 256))}px`,
                    }}
                    className="bg-[#111720] border border-[#2D3C4E] rounded-lg shadow-2xl overflow-hidden"
                  >
                    {/* Preview Header */}
                    <div className="px-3.5 py-2.5 border-b border-[#1F2A38] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedCustom.showSwatch && previewCell && (
                          <div
                            className="w-5 h-5 rounded-[2px] border border-white/15 shrink-0 overflow-hidden"
                            style={{ backgroundColor: previewCell.defaultColor }}
                          >
                            {previewSprite && (
                              <img
                                src={previewSprite.dataUrl}
                                alt=""
                                className="w-full h-full"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            )}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-[#E6EDF3] truncate">
                          {formatUiTemplate(
                            selectedCustom.title,
                            previewTplCtx
                          ) || selectedCustom.id}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[#8B98A9] shrink-0">
                        (4, 4)
                      </span>
                    </div>

                    {/* Preview Body */}
                    <div className="p-3.5 space-y-2.5">
                      {selectedCustom.subtitle && (
                        <p className="text-[11px] text-[#8B98A9] leading-snug">
                          {formatUiTemplate(
                            selectedCustom.subtitle,
                            previewTplCtx
                          )}
                        </p>
                      )}

                      {selectedCustom.blocks.map((block, idx) => {
                        if (
                          !evaluateUiConditions(
                            block.visibleWhen,
                            previewTplCtx
                          )
                        ) {
                          return null;
                        }

                        if (block.kind === 'text') {
                          return (
                            <p
                              key={idx}
                              className={`text-xs leading-snug ${TONE_TEXT[block.tone ?? 'default']}`}
                            >
                              {formatUiTemplate(block.text, previewTplCtx)}
                            </p>
                          );
                        }

                        if (block.kind === 'stat') {
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="text-[#8B98A9]">
                                {formatUiTemplate(block.label, previewTplCtx)}
                              </span>
                              <span
                                className={`font-mono tabular-nums font-semibold ${TONE_TEXT[block.tone ?? 'default']}`}
                              >
                                {formatUiTemplate(block.value, previewTplCtx)}
                              </span>
                            </div>
                          );
                        }

                        if (block.kind === 'button') {
                          const disabled =
                            block.disabledWhen &&
                            block.disabledWhen.length > 0 &&
                            evaluateUiConditions(
                              block.disabledWhen,
                              previewTplCtx
                            );
                          return (
                            <div
                              key={idx}
                              className={`w-full px-3 py-1.5 text-xs font-semibold rounded-md text-center ${
                                disabled
                                  ? 'bg-[#17202B] text-[#8B98A9]/60 border border-[#1F2A38]'
                                  : buttonVariantClass(block.variant)
                              }`}
                            >
                              {formatUiTemplate(block.label, previewTplCtx)}
                            </div>
                          );
                        }

                        if (block.kind === 'buttonRow') {
                          return (
                            <div
                              key={idx}
                              className="grid gap-1.5"
                              style={{
                                gridTemplateColumns: `repeat(${Math.max(1, block.buttons.length)}, minmax(0, 1fr))`,
                              }}
                            >
                              {block.buttons.map((b, bi) => (
                                <div
                                  key={bi}
                                  className={`px-2 py-1.5 text-xs font-semibold rounded-md text-center truncate ${buttonVariantClass(b.variant)}`}
                                >
                                  {formatUiTemplate(b.label, previewTplCtx)}
                                </div>
                              ))}
                            </div>
                          );
                        }

                        if (block.kind === 'selectList') {
                          const items =
                            block.source === 'globalVars'
                              ? manifest.globalState.variables
                                  .filter((v) => v.access !== 'private')
                                  .filter((v) =>
                                    block.filterTag
                                      ? (v.tags ?? []).includes(block.filterTag)
                                      : true
                                  )
                                  .filter((v) =>
                                    block.filterHasCap ? Boolean(v.hasCap) : true
                                  )
                                  .map((v) => ({
                                    value: v.id,
                                    label: v.name,
                                    color: v.color,
                                  }))
                              : (block.options ?? []);
                          const selectedVal = block.selectedStateKey
                            ? String(
                                previewTplCtx.getState(block.selectedStateKey)
                              )
                            : '';

                          return (
                            <div key={idx} className="space-y-1">
                              {block.label && (
                                <div className="text-[11px] text-[#8B98A9]">
                                  {formatUiTemplate(block.label, previewTplCtx)}
                                </div>
                              )}
                              <div className="space-y-1">
                                {items.slice(0, 4).map((opt) => {
                                  const isSel = opt.value === selectedVal;
                                  return (
                                    <div
                                      key={opt.value}
                                      className={`px-2.5 py-1.5 rounded border text-xs flex items-center justify-between ${
                                        isSel
                                          ? 'bg-[#17202B] border-[#10B981] text-[#E6EDF3]'
                                          : 'bg-[#0B0F14] border-[#1F2A38] text-[#8B98A9]'
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5 truncate">
                                        {opt.color && (
                                          <span
                                            className="w-2 h-2 rounded-[1px]"
                                            style={{
                                              backgroundColor: opt.color,
                                            }}
                                          />
                                        )}
                                        {opt.label}
                                      </span>
                                      {isSel && (
                                        <Check className="w-3 h-3 text-[#10B981]" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        if (block.kind === 'cellStateList') {
                          const visibleFields = (
                            previewCell?.stateSchema ?? []
                          ).filter(
                            (f) =>
                              f.access !== 'private' &&
                              !(block.excludeKeys ?? []).includes(f.key)
                          );
                          return (
                            <div
                              key={idx}
                              className="space-y-1 pt-1.5 border-t border-[#1F2A38] text-xs"
                            >
                              {visibleFields.length === 0 ? (
                                <div className="text-[11px] text-[#8B98A9]">
                                  No public state fields
                                </div>
                              ) : (
                                visibleFields.map((f) => (
                                  <div
                                    key={f.key}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <span className="text-[#8B98A9]">
                                      {f.label ?? f.key}
                                    </span>
                                    <span className="font-mono tabular-nums text-[#E6EDF3]">
                                      {String(f.initialValue)}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          );
                        }

                        if (block.kind === 'supplyList') {
                          return (
                            <div
                              key={idx}
                              className="space-y-1 pt-1.5 border-t border-[#1F2A38] text-xs"
                            >
                              {manifest.supplies.length === 0 ? (
                                <div className="text-[11px] text-[#8B98A9]">
                                  No supplies configured
                                </div>
                              ) : (
                                manifest.supplies.slice(0, 4).map((s) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <span className="text-[#8B98A9]">
                                      {s.name}
                                    </span>
                                    <span
                                      className="font-mono tabular-nums font-semibold"
                                      style={{ color: s.color }}
                                    >
                                      2
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <NodeGraphEditor
              graph={selectedCustom.graph ?? { nodes: [], edges: [] }}
              scope="interface"
              manifest={manifest}
              readOnly={readOnly}
              onChange={(nextGraph) =>
                updateCustomInterface(selectedCustom.id, (i) => ({
                  ...i,
                  graph: nextGraph,
                }))
              }
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-[#8B98A9]">
          Select an interface template or create a custom interface.
        </div>
      )}
    </div>
  );
}
