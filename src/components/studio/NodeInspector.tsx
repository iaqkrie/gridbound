import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  BUILTIN_INTERFACES,
  CellPickerOption,
  ConfirmLine,
  EmitArea,
  getNodeDefinition,
  GraphNode,
  GraphScope,
  RulesetManifest,
  StateFieldManifest,
} from '../../engine/sdk';
import { NumberInput } from './NumberInput';

interface NodeInspectorProps {
  node: GraphNode | null;
  scope: GraphScope;
  manifest: RulesetManifest;
  cellStateSchema?: StateFieldManifest[];
  readOnly?: boolean;
  onUpdateNode: (nodeId: string, nextData: Record<string, unknown>) => void;
  onDuplicateNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
}

const INPUT_CLASS =
  'w-full bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded px-2.5 py-1.5 text-xs text-[#E6EDF3] focus:outline-none disabled:opacity-60';

const LABEL_CLASS = 'block text-[11px] font-medium text-[#8B98A9] mb-1';

export function NodeInspector({
  node,
  scope,
  manifest,
  cellStateSchema,
  readOnly,
  onUpdateNode,
  onDuplicateNode,
  onDeleteNode,
}: NodeInspectorProps) {
  if (!node) {
    return (
      <aside className="w-72 shrink-0 border-l border-[#1F2A38] bg-[#111720] p-4 flex flex-col justify-center items-center text-center">
        <p className="text-xs text-[#8B98A9] leading-relaxed">
          Select a node on the canvas to inspect and edit its parameters.
        </p>
        <p className="text-[11px] text-[#8B98A9]/70 mt-2">
          Drag from an output pin to an input pin to connect. Click a wire to remove it.
        </p>
      </aside>
    );
  }

  const def = getNodeDefinition(node.type);
  const data = node.data ?? {};

  const setField = (key: string, value: unknown) => {
    if (readOnly) return;
    onUpdateNode(node.id, { ...data, [key]: value });
  };

  // Access-filtered Global Variables
  const isGlobalWrite =
    node.type === 'global.set' ||
    node.type === 'global.add' ||
    node.type === 'global.consume' ||
    node.type === 'global.addCap';

  const accessibleGlobalVars = manifest.globalState.variables.filter((v) => {
    if (scope === 'global') return true;
    if (v.access === 'private') return false;
    if (isGlobalWrite && v.access === 'readonly') return false;
    return true;
  });

  // Available Cell State fields
  const stateFields: StateFieldManifest[] = cellStateSchema
    ? cellStateSchema
    : Array.from(
        new Map(
          manifest.cellTypes
            .flatMap((c) => c.stateSchema)
            .filter((f) =>
              scope === 'interface'
                ? f.access !== 'private' &&
                  (node.type === 'cell.getState' || f.access === 'public')
                : true
            )
            .map((f) => [f.key, f])
        ).values()
      );

  const allInterfaces = [
    ...Object.values(BUILTIN_INTERFACES).map((b) => ({
      id: b.id,
      label: `${b.name} (Built-in)`,
    })),
    ...manifest.interfaces.map((i) => ({
      id: i.id,
      label: `${i.title} (${i.id})`,
    })),
  ];

  const renderSpecificFields = () => {
    switch (node.type) {
      case 'event.uiAction':
        return (
          <div>
            <label className={LABEL_CLASS}>Action ID</label>
            <input
              type="text"
              disabled={readOnly}
              value={String(data.actionId ?? '')}
              onChange={(e) => setField('actionId', e.target.value)}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        );

      case 'const.value': {
        const curVal = data.value ?? 0;
        const valType = typeof curVal;
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Value Type</label>
              <select
                disabled={readOnly}
                value={valType}
                onChange={(e) => {
                  const t = e.target.value;
                  if (t === 'number') setField('value', 0);
                  else if (t === 'boolean') setField('value', false);
                  else setField('value', '');
                }}
                className={INPUT_CLASS}
              >
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="string">String</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Value</label>
              {valType === 'boolean' ? (
                <select
                  disabled={readOnly}
                  value={curVal ? 'true' : 'false'}
                  onChange={(e) => setField('value', e.target.value === 'true')}
                  className={INPUT_CLASS}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : valType === 'number' ? (
                <NumberInput
                  disabled={readOnly}
                  value={Number(curVal)}
                  onChange={(v) => setField('value', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              ) : (
                <input
                  type="text"
                  disabled={readOnly}
                  value={String(curVal)}
                  onChange={(e) => setField('value', e.target.value)}
                  className={INPUT_CLASS}
                />
              )}
            </div>
          </div>
        );
      }

      case 'get.setupParam':
      case 'gen.setupParam':
        return (
          <div>
            <label className={LABEL_CLASS}>Setup Option</label>
            <select
              disabled={readOnly}
              value={String(data.paramId ?? '')}
              onChange={(e) => setField('paramId', e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">-- Select option --</option>
              <option value="width">width (Map Width)</option>
              <option value="height">height (Map Height)</option>
              {(manifest.setupOptions ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.id})
                </option>
              ))}
            </select>
          </div>
        );

      case 'get.uiParam':
        return (
          <div>
            <label className={LABEL_CLASS}>Param Key</label>
            <input
              type="text"
              disabled={readOnly}
              value={String(data.key ?? '')}
              onChange={(e) => setField('key', e.target.value)}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        );

      case 'math.op':
      case 'gen.math':
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Operation</label>
              <select
                disabled={readOnly}
                value={String(data.op ?? 'add')}
                onChange={(e) => setField('op', e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="add">Add (A + B)</option>
                <option value="sub">Subtract (A − B)</option>
                <option value="mul">Multiply (A × B)</option>
                <option value="div">Divide (A / B)</option>
                <option value="min">Min(A, B)</option>
                <option value="max">Max(A, B)</option>
                {node.type === 'math.op' && <option value="mod">Modulo (A % B)</option>}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL_CLASS}>Default A</label>
                <NumberInput
                  disabled={readOnly}
                  value={Number(data.a ?? 0)}
                  onChange={(v) => setField('a', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Default B</label>
                <NumberInput
                  disabled={readOnly}
                  value={Number(data.b ?? 0)}
                  onChange={(v) => setField('b', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            </div>
          </div>
        );

      case 'math.clamp':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLASS}>Min</label>
              <NumberInput
                disabled={readOnly}
                value={Number(data.min ?? 0)}
                onChange={(v) => setField('min', v)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Max</label>
              <NumberInput
                disabled={readOnly}
                value={Number(data.max ?? 100)}
                onChange={(v) => setField('max', v)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>
        );

      case 'math.round':
        return (
          <div>
            <label className={LABEL_CLASS}>Rounding Mode</label>
            <select
              disabled={readOnly}
              value={String(data.mode ?? 'floor')}
              onChange={(e) => setField('mode', e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="floor">Floor</option>
              <option value="round">Round</option>
              <option value="ceil">Ceil</option>
            </select>
          </div>
        );

      case 'logic.compare': {
        const bVal = data.b ?? 0;
        const bType = typeof bVal;
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Operator</label>
              <select
                disabled={readOnly}
                value={String(data.op ?? '==')}
                onChange={(e) => setField('op', e.target.value)}
                className={`${INPUT_CLASS} font-mono`}
              >
                <option value="==">==</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value=">=">&gt;=</option>
                <option value="<">&lt;</option>
                <option value="<=">&lt;=</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Literal B Type</label>
              <select
                disabled={readOnly}
                value={bType}
                onChange={(e) => {
                  const t = e.target.value;
                  if (t === 'number') setField('b', 0);
                  else if (t === 'boolean') setField('b', true);
                  else setField('b', '');
                }}
                className={INPUT_CLASS}
              >
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="string">String</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Default B</label>
              {bType === 'boolean' ? (
                <select
                  disabled={readOnly}
                  value={bVal ? 'true' : 'false'}
                  onChange={(e) => setField('b', e.target.value === 'true')}
                  className={INPUT_CLASS}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : bType === 'number' ? (
                <NumberInput
                  disabled={readOnly}
                  value={Number(bVal)}
                  onChange={(v) => setField('b', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              ) : (
                <input
                  type="text"
                  disabled={readOnly}
                  value={String(bVal)}
                  onChange={(e) => setField('b', e.target.value)}
                  className={INPUT_CLASS}
                />
              )}
            </div>
          </div>
        );
      }

      case 'logic.bool':
        return (
          <div>
            <label className={LABEL_CLASS}>Boolean Operator</label>
            <select
              disabled={readOnly}
              value={String(data.op ?? 'and')}
              onChange={(e) => setField('op', e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="and">AND (A && B)</option>
              <option value="or">OR (A || B)</option>
              <option value="not">NOT (!A)</option>
            </select>
          </div>
        );

      case 'flow.chance':
        return (
          <div>
            <label className={LABEL_CLASS}>Probability (0 – 1)</label>
            <NumberInput
              min={0}
              max={1}
              step={0.05}
              disabled={readOnly}
              value={Number(data.probability ?? 0.5)}
              onChange={(v) => setField('probability', v)}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        );

      case 'flow.switchString': {
        const cases = Array.isArray(data.cases) ? (data.cases as string[]) : [];
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={LABEL_CLASS}>Match Cases</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setField('cases', [...cases, `case_${cases.length}`])}
                  className="inline-flex items-center gap-1 text-[11px] text-[#10B981] hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Case
                </button>
              )}
            </div>
            {cases.map((c, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-[#8B98A9] w-10 shrink-0">
                  #{idx}
                </span>
                <input
                  type="text"
                  disabled={readOnly}
                  value={c}
                  onChange={(e) => {
                    const next = [...cases];
                    next[idx] = e.target.value;
                    setField('cases', next);
                  }}
                  className={`${INPUT_CLASS} font-mono`}
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() =>
                      setField(
                        'cases',
                        cases.filter((_, i) => i !== idx)
                      )
                    }
                    className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      }

      case 'string.format':
        return (
          <div>
            <label className={LABEL_CLASS}>Template (uses {'{a}'}, {'{b}'}, {'{c}'})</label>
            <input
              type="text"
              disabled={readOnly}
              value={String(data.template ?? '{a}')}
              onChange={(e) => setField('template', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        );

      case 'global.get':
      case 'global.getCap':
      case 'get.globalVarName':
      case 'global.set':
      case 'global.add':
      case 'global.consume':
      case 'global.addCap': {
        const list =
          node.type === 'global.getCap' || node.type === 'global.addCap'
            ? accessibleGlobalVars.filter((v) => v.hasCap)
            : accessibleGlobalVars;
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Global Variable (optional if wired)</label>
              <select
                disabled={readOnly}
                value={String(data.varId ?? '')}
                onChange={(e) => setField('varId', e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">-- Dynamic / Wired --</option>
                {list.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.id}) · {v.access}
                  </option>
                ))}
              </select>
            </div>
            {(node.type === 'global.add' || node.type === 'global.consume') && (
              <div>
                <label className={LABEL_CLASS}>Default Amount</label>
                <NumberInput
                  disabled={readOnly}
                  value={Number(data.amount ?? 1)}
                  onChange={(v) => setField('amount', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            )}
            {node.type === 'global.addCap' && (
              <div>
                <label className={LABEL_CLASS}>Cap Delta</label>
                <NumberInput
                  disabled={readOnly}
                  value={Number(data.delta ?? 1)}
                  onChange={(v) => setField('delta', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            )}
            {node.type === 'global.set' && (
              <div>
                <label className={LABEL_CLASS}>Default Value</label>
                <input
                  type="text"
                  disabled={readOnly}
                  value={String(data.value ?? '')}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    setField(
                      'value',
                      e.target.value !== '' && !Number.isNaN(num)
                        ? num
                        : e.target.value
                    );
                  }}
                  className={INPUT_CLASS}
                />
              </div>
            )}
          </div>
        );
      }

      case 'cell.getState':
      case 'cell.setState':
      case 'cell.addState': {
        const selectedKey = String(data.key ?? '');
        const matchedField = stateFields.find((f) => f.key === selectedKey);
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>State Field</label>
              {stateFields.length > 0 ? (
                <select
                  disabled={readOnly}
                  value={selectedKey}
                  onChange={(e) => setField('key', e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">-- Select state field --</option>
                  {stateFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label ?? f.key} ({f.key}) · {f.type}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled={readOnly}
                  value={selectedKey}
                  onChange={(e) => setField('key', e.target.value)}
                  placeholder="state key"
                  className={`${INPUT_CLASS} font-mono`}
                />
              )}
            </div>
            {node.type === 'cell.addState' && (
              <div>
                <label className={LABEL_CLASS}>Default Amount</label>
                <NumberInput
                  disabled={readOnly}
                  value={Number(data.amount ?? 1)}
                  onChange={(v) => setField('amount', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            )}
            {node.type === 'cell.setState' && (
              <div>
                <label className={LABEL_CLASS}>Default Value</label>
                {matchedField?.type === 'number' ? (
                  <NumberInput
                    disabled={readOnly}
                    value={Number(data.value ?? 0)}
                    onChange={(v) => setField('value', v)}
                    className={`${INPUT_CLASS} font-mono`}
                  />
                ) : matchedField?.type === 'boolean' ? (
                  <select
                    disabled={readOnly}
                    value={data.value ? 'true' : 'false'}
                    onChange={(e) => setField('value', e.target.value === 'true')}
                    className={INPUT_CLASS}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled={readOnly}
                    value={String(data.value ?? '')}
                    onChange={(e) => setField('value', e.target.value)}
                    className={INPUT_CLASS}
                  />
                )}
              </div>
            )}
          </div>
        );
      }

      case 'cell.setSprite': {
        const curSpriteId = data.spriteId ? String(data.spriteId) : '';
        const previewSprite = manifest.sprites.find((s) => s.id === curSpriteId);
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Sprite Asset (optional if wired)</label>
              <select
                disabled={readOnly}
                value={curSpriteId}
                onChange={(e) =>
                  setField('spriteId', e.target.value ? e.target.value : null)
                }
                className={INPUT_CLASS}
              >
                <option value="">None / Wired</option>
                {manifest.sprites.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} ({sp.id})
                  </option>
                ))}
              </select>
            </div>
            {previewSprite && (
              <div className="flex items-center gap-2.5 p-2 bg-[#0B0F14] border border-[#1F2A38] rounded">
                <img
                  src={previewSprite.dataUrl}
                  alt={previewSprite.name}
                  className="w-8 h-8 rounded-[2px] border border-white/10"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="text-xs text-[#E6EDF3] truncate">
                  {previewSprite.name}
                </span>
              </div>
            )}
          </div>
        );
      }

      case 'cell.setColor':
        return (
          <div>
            <label className={LABEL_CLASS}>Tint Color (hex, empty to clear)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                disabled={readOnly}
                value={
                  typeof data.color === 'string' && data.color.startsWith('#')
                    ? data.color
                    : '#10b981'
                }
                onChange={(e) => setField('color', e.target.value)}
                className="w-8 h-7 bg-transparent border border-[#1F2A38] rounded cursor-pointer"
              />
              <input
                type="text"
                disabled={readOnly}
                value={data.color ? String(data.color) : ''}
                onChange={(e) =>
                  setField('color', e.target.value.trim() || null)
                }
                placeholder="#rrggbb or empty"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>
        );

      case 'cell.setOpacity':
        return (
          <div>
            <label className={LABEL_CLASS}>Opacity (0 – 1)</label>
            <NumberInput
              min={0}
              max={1}
              step={0.1}
              disabled={readOnly}
              value={Number(data.opacity ?? 1)}
              onChange={(v) => setField('opacity', v)}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        );

      case 'cell.transform':
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Target Cell Type</label>
              <select
                disabled={readOnly}
                value={String(data.toId ?? '')}
                onChange={(e) => setField('toId', e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">-- Dynamic / Wired --</option>
                {manifest.cellTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name} ({ct.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Reason</label>
              <input
                type="text"
                disabled={readOnly}
                value={String(data.reason ?? '')}
                onChange={(e) => setField('reason', e.target.value)}
                placeholder="build, demolish, starved..."
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>
        );

      case 'supply.get':
      case 'supply.consume':
      case 'supply.emit': {
        const area = (data.area as EmitArea) ?? { shape: 'moore', radius: 1 };
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Supply</label>
              <select
                disabled={readOnly}
                value={String(data.supplyId ?? '')}
                onChange={(e) => setField('supplyId', e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">-- Select supply --</option>
                {manifest.supplies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
            </div>
            {node.type !== 'supply.get' && (
              <div>
                <label className={LABEL_CLASS}>Default Amount</label>
                <NumberInput
                  min={0}
                  disabled={readOnly}
                  value={Number(data.amount ?? 1)}
                  onChange={(v) => setField('amount', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            )}
            {node.type === 'supply.emit' && (
              <>
                <div>
                  <label className={LABEL_CLASS}>Area Shape</label>
                  <select
                    disabled={readOnly}
                    value={area.shape}
                    onChange={(e) => {
                      const sh = e.target.value;
                      if (sh === 'self') setField('area', { shape: 'self' });
                      else if (sh === 'moore')
                        setField('area', { shape: 'moore', radius: 1 });
                      else if (sh === 'vonNeumann')
                        setField('area', { shape: 'vonNeumann', radius: 1 });
                      else if (sh === 'relative')
                        setField('area', { shape: 'relative', dx: 0, dy: -1 });
                      else setField('area', { shape: 'coords', x: 0, y: 0 });
                    }}
                    className={INPUT_CLASS}
                  >
                    <option value="self">Self</option>
                    <option value="moore">Square Radius (Moore)</option>
                    <option value="vonNeumann">Diamond Radius (Manhattan)</option>
                    <option value="relative">Relative Offset (dx, dy)</option>
                    <option value="coords">Absolute Coords (x, y)</option>
                  </select>
                </div>
                {(area.shape === 'moore' || area.shape === 'vonNeumann') && (
                  <div className="space-y-2">
                    <div>
                      <label className={LABEL_CLASS}>Radius</label>
                      <NumberInput
                        min={0}
                        max={20}
                        integer
                        disabled={readOnly}
                        value={area.radius}
                        onChange={(radius) =>
                          setField('area', { ...area, radius })
                        }
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-[#E6EDF3] cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={data.includeSelf !== false}
                        onChange={(e) => setField('includeSelf', e.target.checked)}
                        className="accent-[#10B981]"
                      />
                      Include Self Tile
                    </label>
                  </div>
                )}
                {area.shape === 'relative' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL_CLASS}>dx</label>
                      <NumberInput
                        integer
                        disabled={readOnly}
                        value={area.dx}
                        onChange={(dx) => setField('area', { ...area, dx })}
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>dy</label>
                      <NumberInput
                        integer
                        disabled={readOnly}
                        value={area.dy}
                        onChange={(dy) => setField('area', { ...area, dy })}
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                  </div>
                )}
                {area.shape === 'coords' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL_CLASS}>X</label>
                      <NumberInput
                        integer
                        disabled={readOnly}
                        value={area.x}
                        onChange={(x) => setField('area', { ...area, x })}
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Y</label>
                      <NumberInput
                        integer
                        disabled={readOnly}
                        value={area.y}
                        onChange={(y) => setField('area', { ...area, y })}
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      }

      case 'world.reclaimCellState':
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Target State Key</label>
              <input
                type="text"
                disabled={readOnly}
                value={String(data.stateKey ?? 'worker')}
                onChange={(e) => setField('stateKey', e.target.value)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Amount</label>
              <NumberInput
                min={1}
                integer
                disabled={readOnly}
                value={Number(data.amount ?? 1)}
                onChange={(v) => setField('amount', v)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-[#E6EDF3] cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={Boolean(data.resetVisualToDefault)}
                onChange={(e) =>
                  setField('resetVisualToDefault', e.target.checked)
                }
                className="accent-[#10B981]"
              />
              Reset affected cell sprite to default
            </label>
          </div>
        );

      case 'notify.global':
      case 'notify.cell':
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Severity</label>
              <select
                disabled={readOnly}
                value={String(data.severity ?? 'info')}
                onChange={(e) => setField('severity', e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="danger">Danger</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Title</label>
              <input
                type="text"
                disabled={readOnly}
                value={String(data.title ?? '')}
                onChange={(e) => setField('title', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Message</label>
              <textarea
                rows={2}
                disabled={readOnly}
                value={String(data.message ?? '')}
                onChange={(e) => setField('message', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        );

      case 'ui.openInterface': {
        const ifaceId = String(data.interfaceId ?? '');
        const params = (data.params as Record<string, unknown>) ?? {};
        const setParam = (k: string, v: unknown) =>
          setField('params', { ...params, [k]: v });

        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Interface</label>
              <select
                disabled={readOnly}
                value={ifaceId}
                onChange={(e) => setField('interfaceId', e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">-- Select interface --</option>
                {allInterfaces.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {ifaceId === '@builtin/cell_picker' && (
              <div className="space-y-2.5 pt-2 border-t border-[#1F2A38]">
                <div>
                  <label className={LABEL_CLASS}>Picker Title</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={String(params.title ?? '')}
                    onChange={(e) => setParam('title', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className={LABEL_CLASS}>Options</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const opts = Array.isArray(params.options)
                          ? [...(params.options as CellPickerOption[])]
                          : [];
                        opts.push({
                          cellId: manifest.cellTypes[0]?.id ?? '',
                          label: manifest.cellTypes[0]?.name ?? 'Cell',
                          subtitle: '',
                          badge: '',
                        });
                        setParam('options', opts);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-[#10B981] hover:underline cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Option
                    </button>
                  )}
                </div>
                {(Array.isArray(params.options)
                  ? (params.options as CellPickerOption[])
                  : []
                ).map((opt, idx, arr) => (
                  <div
                    key={idx}
                    className="p-2 bg-[#0B0F14] border border-[#1F2A38] rounded space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <select
                        disabled={readOnly}
                        value={opt.cellId}
                        onChange={(e) => {
                          const next = [...arr];
                          const ct = manifest.cellTypes.find(
                            (c) => c.id === e.target.value
                          );
                          next[idx] = {
                            ...opt,
                            cellId: e.target.value,
                            label: ct?.name ?? opt.label,
                          };
                          setParam('options', next);
                        }}
                        className={INPUT_CLASS}
                      >
                        {manifest.cellTypes.map((ct) => (
                          <option key={ct.id} value={ct.id}>
                            {ct.name} ({ct.id})
                          </option>
                        ))}
                      </select>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setParam(
                              'options',
                              arr.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={opt.badge ?? ''}
                      onChange={(e) => {
                        const next = [...arr];
                        next[idx] = { ...opt, badge: e.target.value };
                        setParam('options', next);
                      }}
                      placeholder="Badge (e.g. 5 Money)"
                      className={INPUT_CLASS}
                    />
                    <input
                      type="text"
                      disabled={readOnly}
                      value={opt.subtitle ?? ''}
                      onChange={(e) => {
                        const next = [...arr];
                        next[idx] = { ...opt, subtitle: e.target.value };
                        setParam('options', next);
                      }}
                      placeholder="Subtitle description"
                      className={INPUT_CLASS}
                    />
                  </div>
                ))}
              </div>
            )}

            {ifaceId === '@builtin/confirm' && (
              <div className="space-y-2.5 pt-2 border-t border-[#1F2A38]">
                <div>
                  <label className={LABEL_CLASS}>Dialog Title</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={String(params.title ?? '')}
                    onChange={(e) => setParam('title', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Message</label>
                  <textarea
                    rows={2}
                    disabled={readOnly}
                    value={String(params.message ?? '')}
                    onChange={(e) => setParam('message', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL_CLASS}>Confirm Label</label>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={String(params.confirmLabel ?? 'Confirm')}
                      onChange={(e) => setParam('confirmLabel', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Cancel Label</label>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={String(params.cancelLabel ?? 'Cancel')}
                      onChange={(e) => setParam('cancelLabel', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-[#E6EDF3] cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={Boolean(params.danger)}
                    onChange={(e) => setParam('danger', e.target.checked)}
                    className="accent-[#F43F5E]"
                  />
                  Danger style confirm button
                </label>
                {Array.isArray(params.lines) && (
                  <div className="text-[11px] text-[#8B98A9]">
                    Info lines: {(params.lines as ConfirmLine[]).length} configured
                  </div>
                )}
              </div>
            )}

            {ifaceId &&
              ifaceId !== '@builtin/cell_picker' &&
              ifaceId !== '@builtin/confirm' &&
              ifaceId !== '@builtin/inspector' && (
                <div className="space-y-2 pt-2 border-t border-[#1F2A38]">
                  <div className="flex items-center justify-between">
                    <span className={LABEL_CLASS}>Custom Params</span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          setParam(`param_${Object.keys(params).length + 1}`, '')
                        }
                        className="inline-flex items-center gap-1 text-[11px] text-[#10B981] hover:underline cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    )}
                  </div>
                  {Object.entries(params).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-5 gap-1 items-center">
                      <span className="col-span-2 font-mono text-[11px] text-[#8B98A9] truncate">
                        {k}
                      </span>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={String(v ?? '')}
                        onChange={(e) => setParam(k, e.target.value)}
                        className={`col-span-2 ${INPUT_CLASS}`}
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...params };
                            delete next[k];
                            setField('params', next);
                          }}
                          className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer justify-self-end"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        );
      }

      // ── World Generator Nodes ──────────────────────────────────────────
      case 'gen.constNumber':
        return (
          <div>
            <label className={LABEL_CLASS}>Number</label>
            <NumberInput
              disabled={readOnly}
              value={Number(data.value ?? 0)}
              onChange={(v) => setField('value', v)}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        );

      case 'gen.noise':
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Scale</label>
              <NumberInput
                min={0.5}
                step={0.5}
                disabled={readOnly}
                value={Number(data.scale ?? 6)}
                onChange={(v) => setField('scale', v)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL_CLASS}>Octaves</label>
                <NumberInput
                  min={1}
                  max={5}
                  integer
                  disabled={readOnly}
                  value={Number(data.octaves ?? 2)}
                  onChange={(v) => setField('octaves', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Seed Offset</label>
                <NumberInput
                  integer
                  disabled={readOnly}
                  value={Number(data.seedOffset ?? 0)}
                  onChange={(v) => setField('seedOffset', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            </div>
          </div>
        );

      case 'gen.clusters':
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Target Coverage (0 – 1)</label>
              <NumberInput
                min={0}
                max={1}
                step={0.02}
                disabled={readOnly}
                value={Number(data.targetCoverage ?? 0.12)}
                onChange={(v) => setField('targetCoverage', v)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL_CLASS}>Cluster Size</label>
                <NumberInput
                  min={1}
                  integer
                  disabled={readOnly}
                  value={Number(data.clusterSize ?? 5)}
                  onChange={(v) => setField('clusterSize', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Seed Offset</label>
                <NumberInput
                  integer
                  disabled={readOnly}
                  value={Number(data.seedOffset ?? 0)}
                  onChange={(v) => setField('seedOffset', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            </div>
          </div>
        );

      case 'gen.scatter':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLASS}>Density (0 – 1)</label>
              <NumberInput
                min={0}
                max={1}
                step={0.02}
                disabled={readOnly}
                value={Number(data.density ?? 0.1)}
                onChange={(v) => setField('density', v)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Seed Offset</label>
              <NumberInput
                integer
                disabled={readOnly}
                value={Number(data.seedOffset ?? 0)}
                onChange={(v) => setField('seedOffset', v)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>
        );

      case 'gen.distanceFromLayer':
        return (
          <div>
            <label className={LABEL_CLASS}>Max Distance (tiles)</label>
            <NumberInput
              min={1}
              max={32}
              integer
              disabled={readOnly}
              value={Number(data.maxDistance ?? 5)}
              onChange={(v) => setField('maxDistance', v)}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
        );

      case 'gen.threshold':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLASS}>Min</label>
              <NumberInput
                step={0.05}
                min={0}
                max={1}
                disabled={readOnly}
                value={Number(data.min ?? 0.5)}
                onChange={(v) => setField('min', v)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Max</label>
              <NumberInput
                step={0.05}
                min={0}
                max={1}
                disabled={readOnly}
                value={Number(data.max ?? 1)}
                onChange={(v) => setField('max', v)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>
        );

      case 'gen.maskCombine':
        return (
          <div>
            <label className={LABEL_CLASS}>Combine Mode</label>
            <select
              disabled={readOnly}
              value={String(data.op ?? 'mul')}
              onChange={(e) => setField('op', e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="mul">Multiply (A × B)</option>
              <option value="add">Add (A + B)</option>
              <option value="sub">Subtract (A − B)</option>
              <option value="min">Min (Intersect)</option>
              <option value="max">Max (Union)</option>
            </select>
          </div>
        );

      case 'gen.fillLayer':
      case 'gen.paintLayer':
        return (
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLASS}>Cell Type</label>
              <select
                disabled={readOnly}
                value={String(data.cellTypeId ?? '')}
                onChange={(e) => setField('cellTypeId', e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">-- Select cell --</option>
                {manifest.cellTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name} ({ct.id})
                  </option>
                ))}
              </select>
            </div>
            {node.type === 'gen.paintLayer' && (
              <div>
                <label className={LABEL_CLASS}>Mask Threshold (0 – 1)</label>
                <NumberInput
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={readOnly}
                  value={Number(data.threshold ?? 0.5)}
                  onChange={(v) => setField('threshold', v)}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            )}
          </div>
        );

      default:
        return (
          <p className="text-[11px] text-[#8B98A9]">
            This node has no inline properties — connect its pins on the canvas.
          </p>
        );
    }
  };

  return (
    <aside className="w-72 shrink-0 border-l border-[#1F2A38] bg-[#111720] flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-[#1F2A38] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[#E6EDF3] truncate">
            {def?.label ?? node.type}
          </div>
          <div className="font-mono text-[10px] text-[#8B98A9] truncate mt-0.5">
            {node.type} · {node.id}
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onDuplicateNode(node.id)}
              title="Duplicate node"
              className="p-1.5 text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B] rounded cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteNode(node.id)}
              title="Delete node"
              className="p-1.5 text-[#8B98A9] hover:text-[#F43F5E] hover:bg-[#17202B] rounded cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {renderSpecificFields()}
      </div>
    </aside>
  );
}
