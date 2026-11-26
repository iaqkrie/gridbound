import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Action,
  CellStateValue,
  CompareOp,
  Condition,
  NeighborhoodType,
  NotificationSeverity,
  Rule,
  RulesetManifest,
  StatusTone,
} from '../../engine/sdk';
import {
  COMPARE_OPS,
  INPUT_CLS,
  MONO_INPUT_CLS,
  SELECT_CLS,
  createDefaultAction,
  createDefaultCondition,
  createDefaultRule,
  moveArrayItem,
} from './editorHelpers';

interface ConditionListEditorProps {
  conditions: Condition[];
  manifest: RulesetManifest;
  stateKeys: string[];
  stateKeyListId: string;
  depth?: number;
  onChange: (next: Condition[]) => void;
}

function parseStateInputValue(raw: string): CellStateValue {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

export function ConditionListEditor({
  conditions,
  manifest,
  stateKeys,
  stateKeyListId,
  depth = 0,
  onChange,
}: ConditionListEditorProps) {
  const updateAt = (idx: number, next: Condition) => {
    const copy = [...conditions];
    copy[idx] = next;
    onChange(copy);
  };

  const removeAt = (idx: number) => {
    onChange(conditions.filter((_, i) => i !== idx));
  };

  const addCondition = () => {
    const preferred: Condition['type'] =
      manifest.supplies.length > 0
        ? 'supply'
        : stateKeys.length > 0
          ? 'state'
          : manifest.resources.length > 0
            ? 'resource'
            : 'neighbors';
    onChange([
      ...conditions,
      createDefaultCondition(preferred, manifest, stateKeys),
    ]);
  };

  return (
    <div className="space-y-1.5">
      {conditions.map((cond, idx) => (
        <ConditionRow
          key={idx}
          condition={cond}
          manifest={manifest}
          stateKeys={stateKeys}
          stateKeyListId={stateKeyListId}
          depth={depth}
          onChange={(next) => updateAt(idx, next)}
          onRemove={() => removeAt(idx)}
        />
      ))}

      <button
        type="button"
        onClick={addCondition}
        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-dashed border-[#1F2A38] hover:border-[#2D3C4E] rounded transition-colors cursor-pointer"
      >
        <Plus className="w-3 h-3" aria-hidden="true" />
        <span>Add condition</span>
      </button>
    </div>
  );
}

interface ConditionRowProps {
  condition: Condition;
  manifest: RulesetManifest;
  stateKeys: string[];
  stateKeyListId: string;
  depth: number;
  onChange: (next: Condition) => void;
  onRemove: () => void;
}

function ConditionRow({
  condition,
  manifest,
  stateKeys,
  stateKeyListId,
  depth,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const handleTypeChange = (nextType: Condition['type']) => {
    onChange(createDefaultCondition(nextType, manifest, stateKeys));
  };

  return (
    <div className="bg-[#0B0F14] border border-[#1F2A38] rounded-md p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={condition.type}
          onChange={(e) => handleTypeChange(e.target.value as Condition['type'])}
          className={`${SELECT_CLS} font-medium`}
          aria-label="Condition type"
        >
          <option value="supply">Local supply</option>
          <option value="resource">Global resource</option>
          <option value="state">Cell state</option>
          <option value="neighbors">Neighbors</option>
          <option value="chance">Chance</option>
          {depth < 1 && <option value="not">NOT (...)</option>}
          {depth < 1 && <option value="any">ANY of (...)</option>}
        </select>

        {condition.type === 'supply' && (
          <>
            <select
              value={condition.id}
              onChange={(e) => onChange({ ...condition, id: e.target.value })}
              className={SELECT_CLS}
              aria-label="Supply"
            >
              {manifest.supplies.length === 0 && (
                <option value="">No supplies</option>
              )}
              {manifest.supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
            <select
              value={condition.op}
              onChange={(e) =>
                onChange({ ...condition, op: e.target.value as CompareOp })
              }
              className={`${SELECT_CLS} font-mono`}
              aria-label="Operator"
            >
              {COMPARE_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={condition.value}
              onChange={(e) =>
                onChange({ ...condition, value: Number(e.target.value) })
              }
              className={`${MONO_INPUT_CLS} w-20`}
              aria-label="Value"
            />
          </>
        )}

        {condition.type === 'resource' && (
          <>
            <select
              value={condition.id}
              onChange={(e) => onChange({ ...condition, id: e.target.value })}
              className={SELECT_CLS}
              aria-label="Resource"
            >
              {manifest.resources.length === 0 && (
                <option value="">No resources</option>
              )}
              {manifest.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id})
                </option>
              ))}
            </select>
            <select
              value={condition.op}
              onChange={(e) =>
                onChange({ ...condition, op: e.target.value as CompareOp })
              }
              className={`${SELECT_CLS} font-mono`}
              aria-label="Operator"
            >
              {COMPARE_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={condition.value}
              onChange={(e) =>
                onChange({ ...condition, value: Number(e.target.value) })
              }
              className={`${MONO_INPUT_CLS} w-20`}
              aria-label="Value"
            />
          </>
        )}

        {condition.type === 'state' && (
          <>
            <input
              type="text"
              list={stateKeyListId}
              value={condition.key}
              onChange={(e) => onChange({ ...condition, key: e.target.value })}
              placeholder="stateKey"
              className={`${MONO_INPUT_CLS} w-28`}
              aria-label="State key"
            />
            <select
              value={condition.op}
              onChange={(e) =>
                onChange({ ...condition, op: e.target.value as CompareOp })
              }
              className={`${SELECT_CLS} font-mono`}
              aria-label="Operator"
            >
              {COMPARE_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={String(condition.value)}
              onChange={(e) =>
                onChange({
                  ...condition,
                  value: parseStateInputValue(e.target.value),
                })
              }
              placeholder="0 / text / true"
              className={`${MONO_INPUT_CLS} w-24`}
              aria-label="Value"
            />
          </>
        )}

        {condition.type === 'neighbors' && (
          <>
            <select
              value={condition.cell}
              onChange={(e) => onChange({ ...condition, cell: e.target.value })}
              className={SELECT_CLS}
              aria-label="Neighbor cell type"
            >
              {manifest.cellTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
            <select
              value={condition.neighborhood ?? 'moore'}
              onChange={(e) =>
                onChange({
                  ...condition,
                  neighborhood: e.target.value as 'moore' | 'vonNeumann',
                })
              }
              className={SELECT_CLS}
              aria-label="Neighborhood"
            >
              <option value="moore">8-way</option>
              <option value="vonNeumann">4-way</option>
            </select>
            <span className="text-[11px] text-[#8B98A9]">r</span>
            <input
              type="number"
              min={1}
              max={6}
              value={condition.radius ?? 1}
              onChange={(e) =>
                onChange({
                  ...condition,
                  radius: Math.max(1, Number(e.target.value)),
                })
              }
              className={`${MONO_INPUT_CLS} w-14`}
              aria-label="Radius"
            />
            <select
              value={condition.op}
              onChange={(e) =>
                onChange({ ...condition, op: e.target.value as CompareOp })
              }
              className={`${SELECT_CLS} font-mono`}
              aria-label="Operator"
            >
              {COMPARE_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={condition.value}
              onChange={(e) =>
                onChange({ ...condition, value: Number(e.target.value) })
              }
              className={`${MONO_INPUT_CLS} w-16`}
              aria-label="Count"
            />
          </>
        )}

        {condition.type === 'chance' && (
          <>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={condition.probability}
              onChange={(e) =>
                onChange({
                  ...condition,
                  probability: Math.max(0, Math.min(1, Number(e.target.value))),
                })
              }
              className={`${MONO_INPUT_CLS} w-20`}
              aria-label="Probability"
            />
            <span className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
              ({Math.round(condition.probability * 100)}%)
            </span>
          </>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove condition"
          className="ml-auto p-1 text-[#8B98A9] hover:text-[#F43F5E] rounded cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {condition.type === 'not' && (
        <div className="pl-3 border-l border-[#1F2A38]">
          <ConditionRow
            condition={condition.condition}
            manifest={manifest}
            stateKeys={stateKeys}
            stateKeyListId={stateKeyListId}
            depth={depth + 1}
            onChange={(inner) => onChange({ ...condition, condition: inner })}
            onRemove={onRemove}
          />
        </div>
      )}

      {condition.type === 'any' && (
        <div className="pl-3 border-l border-[#1F2A38]">
          <ConditionListEditor
            conditions={condition.conditions}
            manifest={manifest}
            stateKeys={stateKeys}
            stateKeyListId={stateKeyListId}
            depth={depth + 1}
            onChange={(inner) => onChange({ ...condition, conditions: inner })}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Action List & Row Editor
// ============================================================================

interface ActionListEditorProps {
  actions: Action[];
  manifest: RulesetManifest;
  stateKeys: string[];
  allStateKeys: string[];
  stateKeyListId: string;
  allStateKeyListId: string;
  allowUiActions: boolean;
  onChange: (next: Action[]) => void;
}

export function ActionListEditor({
  actions,
  manifest,
  stateKeys,
  allStateKeys,
  stateKeyListId,
  allStateKeyListId,
  allowUiActions,
  onChange,
}: ActionListEditorProps) {
  const updateAt = (idx: number, next: Action) => {
    const copy = [...actions];
    copy[idx] = next;
    onChange(copy);
  };

  const removeAt = (idx: number) => {
    onChange(actions.filter((_, i) => i !== idx));
  };

  const addAction = () => {
    const defaultType: Action['type'] = allowUiActions
      ? 'openPanel'
      : manifest.resources.length > 0
        ? 'addResource'
        : 'setState';
    onChange([
      ...actions,
      createDefaultAction(defaultType, manifest, stateKeys),
    ]);
  };

  return (
    <div className="space-y-1.5">
      {actions.map((act, idx) => (
        <ActionRow
          key={idx}
          action={act}
          manifest={manifest}
          stateKeys={stateKeys}
          allStateKeys={allStateKeys}
          stateKeyListId={stateKeyListId}
          allStateKeyListId={allStateKeyListId}
          allowUiActions={allowUiActions}
          onChange={(next) => updateAt(idx, next)}
          onRemove={() => removeAt(idx)}
        />
      ))}

      <button
        type="button"
        onClick={addAction}
        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-dashed border-[#1F2A38] hover:border-[#2D3C4E] rounded transition-colors cursor-pointer"
      >
        <Plus className="w-3 h-3" aria-hidden="true" />
        <span>Add action</span>
      </button>
    </div>
  );
}

interface ActionRowProps {
  action: Action;
  manifest: RulesetManifest;
  stateKeys: string[];
  allStateKeys: string[];
  stateKeyListId: string;
  allStateKeyListId: string;
  allowUiActions: boolean;
  onChange: (next: Action) => void;
  onRemove: () => void;
}

function ActionRow({
  action,
  manifest,
  stateKeys,
  stateKeyListId,
  allStateKeyListId,
  allowUiActions,
  onChange,
  onRemove,
}: ActionRowProps) {
  const handleTypeChange = (nextType: Action['type']) => {
    onChange(createDefaultAction(nextType, manifest, stateKeys));
  };

  const toggleBuildOption = (cellId: string) => {
    if (action.type !== 'openBuildMenu') return;
    const exists = action.options.includes(cellId);
    const next = exists
      ? action.options.filter((id) => id !== cellId)
      : [...action.options, cellId];
    onChange({ ...action, options: next });
  };

  return (
    <div className="bg-[#0B0F14] border border-[#1F2A38] rounded-md p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={action.type}
          onChange={(e) => handleTypeChange(e.target.value as Action['type'])}
          className={`${SELECT_CLS} font-medium`}
          aria-label="Action type"
        >
          {allowUiActions && (
            <optgroup label="UI Interaction">
              <option value="openBuildMenu">Open build menu</option>
              <option value="openPanel">Open cell panel</option>
              <option value="openDemolishConfirm">Open demolish confirm</option>
            </optgroup>
          )}
          <optgroup label="Resources">
            <option value="addResource">Add resource</option>
            <option value="consumeResource">Consume resource</option>
            <option value="refundStateToResource">Refund state → resource</option>
            <option value="reclaimResource">Reclaim resource</option>
          </optgroup>
          <optgroup label="Spatial Supplies">
            <option value="emitSupply">Emit supply</option>
            <option value="consumeSupply">Consume supply</option>
          </optgroup>
          <optgroup label="Cell & Alerts">
            <option value="setState">Set cell state</option>
            <option value="addState">Add to cell state</option>
            <option value="transform">Transform cell</option>
            <option value="notify">Send notification</option>
          </optgroup>
        </select>

        {(action.type === 'addResource' || action.type === 'consumeResource') && (
          <>
            <select
              value={action.id}
              onChange={(e) => onChange({ ...action, id: e.target.value })}
              className={SELECT_CLS}
              aria-label="Resource"
            >
              {manifest.resources.length === 0 && (
                <option value="">No resources</option>
              )}
              {manifest.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={action.amount}
              onChange={(e) =>
                onChange({ ...action, amount: Number(e.target.value) })
              }
              className={`${MONO_INPUT_CLS} w-20`}
              aria-label="Amount"
            />
          </>
        )}

        {action.type === 'consumeSupply' && (
          <>
            <select
              value={action.id}
              onChange={(e) => onChange({ ...action, id: e.target.value })}
              className={SELECT_CLS}
              aria-label="Supply"
            >
              {manifest.supplies.length === 0 && (
                <option value="">No supplies</option>
              )}
              {manifest.supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={action.amount}
              onChange={(e) =>
                onChange({ ...action, amount: Number(e.target.value) })
              }
              className={`${MONO_INPUT_CLS} w-20`}
              aria-label="Amount"
            />
          </>
        )}

        {action.type === 'emitSupply' && (
          <>
            <select
              value={action.id}
              onChange={(e) => onChange({ ...action, id: e.target.value })}
              className={SELECT_CLS}
              aria-label="Supply"
            >
              {manifest.supplies.length === 0 && (
                <option value="">No supplies</option>
              )}
              {manifest.supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[#8B98A9]">+</span>
            <input
              type="number"
              min={1}
              value={action.amount}
              onChange={(e) =>
                onChange({ ...action, amount: Number(e.target.value) })
              }
              className={`${MONO_INPUT_CLS} w-16`}
              aria-label="Amount"
            />
            <span className="text-[11px] text-[#8B98A9]">r</span>
            <input
              type="number"
              min={0}
              max={8}
              value={action.radius}
              onChange={(e) =>
                onChange({ ...action, radius: Number(e.target.value) })
              }
              className={`${MONO_INPUT_CLS} w-14`}
              aria-label="Radius"
            />
            <select
              value={action.neighborhood}
              onChange={(e) =>
                onChange({
                  ...action,
                  neighborhood: e.target.value as NeighborhoodType,
                })
              }
              className={SELECT_CLS}
              aria-label="Shape"
            >
              <option value="moore">Square (8-way)</option>
              <option value="vonNeumann">Diamond (4-way)</option>
              <option value="self">Self only</option>
            </select>
            <label className="inline-flex items-center gap-1 text-[11px] text-[#8B98A9] cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={action.includeSelf !== false}
                onChange={(e) =>
                  onChange({ ...action, includeSelf: e.target.checked })
                }
                className="accent-[#10B981]"
              />
              <span>Self</span>
            </label>
          </>
        )}

        {action.type === 'setState' && (
          <>
            <input
              type="text"
              list={stateKeyListId}
              value={action.key}
              onChange={(e) => onChange({ ...action, key: e.target.value })}
              placeholder="stateKey"
              className={`${MONO_INPUT_CLS} w-28`}
              aria-label="State key"
            />
            <span className="text-[11px] text-[#8B98A9]">=</span>
            <input
              type="text"
              value={String(action.value)}
              onChange={(e) =>
                onChange({
                  ...action,
                  value: parseStateInputValue(e.target.value),
                })
              }
              placeholder="value"
              className={`${MONO_INPUT_CLS} w-24`}
              aria-label="State value"
            />
          </>
        )}

        {action.type === 'addState' && (
          <>
            <input
              type="text"
              list={stateKeyListId}
              value={action.key}
              onChange={(e) => onChange({ ...action, key: e.target.value })}
              placeholder="stateKey"
              className={`${MONO_INPUT_CLS} w-28`}
              aria-label="State key"
            />
            <span className="text-[11px] text-[#8B98A9]">+=</span>
            <input
              type="number"
              value={action.amount}
              onChange={(e) =>
                onChange({ ...action, amount: Number(e.target.value) })
              }
              className={`${MONO_INPUT_CLS} w-16`}
              aria-label="Delta"
            />
            <input
              type="number"
              value={action.min ?? ''}
              placeholder="min"
              onChange={(e) =>
                onChange({
                  ...action,
                  min:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              className={`${MONO_INPUT_CLS} w-16`}
              aria-label="Min clamp"
            />
            <input
              type="number"
              value={action.max ?? ''}
              placeholder="max"
              onChange={(e) =>
                onChange({
                  ...action,
                  max:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              className={`${MONO_INPUT_CLS} w-16`}
              aria-label="Max clamp"
            />
          </>
        )}

        {action.type === 'transform' && (
          <>
            <span className="text-[11px] text-[#8B98A9]">→</span>
            <select
              value={action.to}
              onChange={(e) => onChange({ ...action, to: e.target.value })}
              className={SELECT_CLS}
              aria-label="Target cell type"
            >
              {manifest.cellTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </>
        )}

        {action.type === 'refundStateToResource' && (
          <>
            <input
              type="text"
              list={stateKeyListId}
              value={action.stateKey}
              onChange={(e) =>
                onChange({ ...action, stateKey: e.target.value })
              }
              placeholder="stateKey"
              className={`${MONO_INPUT_CLS} w-28`}
              aria-label="State key"
            />
            <span className="text-[11px] text-[#8B98A9]">→</span>
            <select
              value={action.resourceId}
              onChange={(e) =>
                onChange({ ...action, resourceId: e.target.value })
              }
              className={SELECT_CLS}
              aria-label="Target resource"
            >
              {manifest.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id})
                </option>
              ))}
            </select>
          </>
        )}

        {action.type === 'reclaimResource' && (
          <>
            <select
              value={action.resourceId}
              onChange={(e) =>
                onChange({ ...action, resourceId: e.target.value })
              }
              className={SELECT_CLS}
              aria-label="Resource"
            >
              {manifest.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.id})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={action.amount}
              onChange={(e) =>
                onChange({ ...action, amount: Number(e.target.value) })
              }
              className={`${MONO_INPUT_CLS} w-16`}
              aria-label="Amount"
            />
            <input
              type="text"
              list={allStateKeyListId}
              value={action.fallbackStateKey ?? ''}
              onChange={(e) =>
                onChange({
                  ...action,
                  fallbackStateKey: e.target.value || undefined,
                })
              }
              placeholder="evict stateKey"
              className={`${MONO_INPUT_CLS} w-28`}
              aria-label="Fallback eviction state key"
            />
          </>
        )}

        {action.type === 'notify' && (
          <>
            <select
              value={action.severity}
              onChange={(e) =>
                onChange({
                  ...action,
                  severity: e.target.value as NotificationSeverity,
                })
              }
              className={SELECT_CLS}
              aria-label="Severity"
            >
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
            <input
              type="text"
              value={action.title}
              onChange={(e) => onChange({ ...action, title: e.target.value })}
              placeholder="Title ({{state.key}})"
              className={`${INPUT_CLS} w-36`}
              aria-label="Notification title"
            />
            <input
              type="text"
              value={action.message}
              onChange={(e) => onChange({ ...action, message: e.target.value })}
              placeholder="Message"
              className={`${INPUT_CLS} flex-1 min-w-[140px]`}
              aria-label="Notification message"
            />
          </>
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove action"
          className="ml-auto p-1 text-[#8B98A9] hover:text-[#F43F5E] rounded cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {action.type === 'openBuildMenu' && (
        <div className="pt-1.5 border-t border-[#1F2A38]">
          <div className="text-[11px] text-[#8B98A9] mb-1.5">
            Buildable options (toggle cells):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {manifest.cellTypes.map((c) => {
              const selected = action.options.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleBuildOption(c.id)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#17202B] border-[#10B981] text-[#E6EDF3]'
                      : 'bg-[#111720] border-[#1F2A38] text-[#8B98A9] hover:text-[#E6EDF3]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-[2px] shrink-0"
                    style={{ backgroundColor: c.visual.color }}
                    aria-hidden="true"
                  />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Structured When / Do / Else Rule List Editor
// ============================================================================

interface RuleListEditorProps {
  rules: Rule[];
  manifest: RulesetManifest;
  stateKeys: string[];
  allStateKeys: string[];
  allowUiActions?: boolean;
  showInspectorMeta?: boolean;
  emptyHint?: string;
  onChange: (next: Rule[]) => void;
}

export function RuleListEditor({
  rules,
  manifest,
  stateKeys,
  allStateKeys,
  allowUiActions = false,
  showInspectorMeta = true,
  emptyHint = 'No rules configured for this event yet.',
  onChange,
}: RuleListEditorProps) {
  const stateKeyListId = 'editor-cell-state-keys';
  const allStateKeyListId = 'editor-all-state-keys';

  const updateRule = (idx: number, next: Rule) => {
    const copy = [...rules];
    copy[idx] = next;
    onChange(copy);
  };

  const handleAddRule = () => {
    onChange([
      ...rules,
      createDefaultRule(manifest, stateKeys, allowUiActions),
    ]);
  };

  const handleDuplicateRule = (idx: number) => {
    const clone: Rule = JSON.parse(JSON.stringify(rules[idx]));
    const copy = [...rules];
    copy.splice(idx + 1, 0, clone);
    onChange(copy);
  };

  const handleDeleteRule = (idx: number) => {
    onChange(rules.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
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

      {rules.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-[#1F2A38] rounded-md px-4 space-y-2.5">
          <p className="text-xs text-[#8B98A9]">{emptyHint}</p>
          <button
            type="button"
            onClick={handleAddRule}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Rule</span>
          </button>
        </div>
      ) : (
        <>
          {rules.map((rule, idx) => {
            const hasElse = Array.isArray(rule.else) && rule.else.length > 0;
            return (
              <div
                key={idx}
                className="bg-[#111720] border border-[#1F2A38] rounded-lg overflow-hidden"
              >
                {/* Rule Header */}
                <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#17202B]/70 border-b border-[#1F2A38]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums text-xs font-semibold text-[#E6EDF3]">
                      Rule #{idx + 1}
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-[#8B98A9] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(rule.stop)}
                        onChange={(e) =>
                          updateRule(idx, {
                            ...rule,
                            stop: e.target.checked || undefined,
                          })
                        }
                        className="accent-[#10B981]"
                      />
                      <span>Stop after match</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onChange(moveArrayItem(rules, idx, idx - 1))}
                      title="Move up"
                      aria-label="Move rule up"
                      className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === rules.length - 1}
                      onClick={() => onChange(moveArrayItem(rules, idx, idx + 1))}
                      title="Move down"
                      aria-label="Move rule down"
                      className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateRule(idx)}
                      title="Duplicate rule"
                      aria-label="Duplicate rule"
                      className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(idx)}
                      title="Delete rule"
                      aria-label="Delete rule"
                      className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Rule Body: When / Do / Else */}
                <div className="p-3.5 space-y-3">
                  {/* WHEN */}
                  <div className="grid grid-cols-1 md:grid-cols-[72px_1fr] gap-2 items-start">
                    <div className="text-[11px] font-semibold text-[#F59E0B] pt-1.5">
                      When
                    </div>
                    <ConditionListEditor
                      conditions={rule.when ?? []}
                      manifest={manifest}
                      stateKeys={stateKeys}
                      stateKeyListId={stateKeyListId}
                      onChange={(nextWhen) =>
                        updateRule(idx, {
                          ...rule,
                          when: nextWhen.length > 0 ? nextWhen : undefined,
                        })
                      }
                    />
                  </div>

                  {/* DO */}
                  <div className="grid grid-cols-1 md:grid-cols-[72px_1fr] gap-2 items-start pt-2.5 border-t border-[#1F2A38]">
                    <div className="text-[11px] font-semibold text-[#10B981] pt-1.5">
                      Do
                    </div>
                    <ActionListEditor
                      actions={rule.do}
                      manifest={manifest}
                      stateKeys={stateKeys}
                      allStateKeys={allStateKeys}
                      stateKeyListId={stateKeyListId}
                      allStateKeyListId={allStateKeyListId}
                      allowUiActions={allowUiActions}
                      onChange={(nextDo) => updateRule(idx, { ...rule, do: nextDo })}
                    />
                  </div>

                  {/* ELSE (optional) */}
                  {hasElse ? (
                    <div className="grid grid-cols-1 md:grid-cols-[72px_1fr] gap-2 items-start pt-2.5 border-t border-[#1F2A38]">
                      <div className="text-[11px] font-semibold text-[#8B98A9] pt-1.5">
                        Else
                      </div>
                      <ActionListEditor
                        actions={rule.else ?? []}
                        manifest={manifest}
                        stateKeys={stateKeys}
                        allStateKeys={allStateKeys}
                        stateKeyListId={stateKeyListId}
                        allStateKeyListId={allStateKeyListId}
                        allowUiActions={allowUiActions}
                        onChange={(nextElse) =>
                          updateRule(idx, {
                            ...rule,
                            else: nextElse.length > 0 ? nextElse : undefined,
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="pt-1 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateRule(idx, {
                            ...rule,
                            else: [
                              createDefaultAction(
                                'setState',
                                manifest,
                                stateKeys
                              ),
                            ],
                          })
                        }
                        className="text-[11px] text-[#8B98A9] hover:text-[#E6EDF3] cursor-pointer"
                      >
                        + Add Else branch
                      </button>
                    </div>
                  )}

                  {/* Optional Inspector Label & Tone */}
                  {showInspectorMeta && (
                    <div className="grid grid-cols-1 md:grid-cols-[72px_1fr] gap-2 items-center pt-2.5 border-t border-[#1F2A38]">
                      <div className="text-[11px] text-[#8B98A9]">Status</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={rule.label ?? ''}
                          onChange={(e) =>
                            updateRule(idx, {
                              ...rule,
                              label: e.target.value || undefined,
                            })
                          }
                          placeholder="Optional hover status label (e.g. No Food ({{state.hunger}}/3))"
                          className={`${INPUT_CLS} flex-1 min-w-[200px]`}
                        />
                        <select
                          value={rule.tone ?? 'neutral'}
                          onChange={(e) =>
                            updateRule(idx, {
                              ...rule,
                              tone: e.target.value as StatusTone,
                            })
                          }
                          className={SELECT_CLS}
                          aria-label="Status tone"
                        >
                          <option value="neutral">Neutral</option>
                          <option value="positive">Positive</option>
                          <option value="warning">Warning</option>
                          <option value="danger">Danger</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div>
            <button
              type="button"
              onClick={handleAddRule}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Rule</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
