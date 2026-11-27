import { Check } from 'lucide-react';
import { SimulationCore } from '../engine/SimulationCore';
import {
  CellPickerOption,
  CellTypeId,
  ConfirmLine,
  evaluateUiConditions,
  formatUiTemplate,
  InterfaceId,
  RuntimeValue,
  UiButtonDef,
} from '../engine/sdk';
import { t } from '../i18n';
import { CellPopover } from './CellPopover';

export interface ActiveInterfaceState {
  cellX: number;
  cellY: number;
  screenX: number;
  screenY: number;
  interfaceId: InterfaceId;
  params: Record<string, unknown>;
}

interface InterfacePopoverProps {
  active: ActiveInterfaceState;
  core: SimulationCore;
  containerWidth: number;
  containerHeight: number;
  onResolve: (result: RuntimeValue) => void;
  onCancel: () => void;
  onTriggerAction: (
    interfaceId: InterfaceId,
    actionId: string,
    value?: RuntimeValue
  ) => void;
  onHoverCellOption: (cellTypeId: CellTypeId | null) => void;
}

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
    return 'text-[#E6EDF3] bg-[#F43F5E] hover:bg-[#E11D48]';
  }
  if (variant === 'secondary') {
    return 'text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E]';
  }
  return 'text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572]';
}

export function InterfacePopover({
  active,
  core,
  containerWidth,
  containerHeight,
  onResolve,
  onCancel,
  onTriggerAction,
  onHoverCellOption,
}: InterfacePopoverProps) {
  const { cellX, cellY, screenX, screenY, interfaceId, params } = active;
  const snapshot = core.getCellSnapshot(cellX, cellY);
  if (!snapshot) return null;

  const currentSpriteUrl = snapshot.visual.spriteId
    ? core.spriteById.get(snapshot.visual.spriteId)?.dataUrl
    : undefined;

  // ==========================================================================
  // 1. Built-in: @builtin/cell_picker
  // ==========================================================================
  if (interfaceId === '@builtin/cell_picker') {
    const title =
      typeof params.title === 'string' && params.title
        ? params.title
        : `Select (${snapshot.cellType.name})`;
    const options = Array.isArray(params.options)
      ? (params.options as CellPickerOption[])
      : [];

    const estimatedHeight = 56 + Math.max(1, options.length) * 66;

    return (
      <CellPopover
        title={title}
        cellX={cellX}
        cellY={cellY}
        screenX={screenX}
        screenY={screenY}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
        width={276}
        estimatedHeight={estimatedHeight}
        ariaLabel={`${title} (${cellX}, ${cellY})`}
        closeAriaLabel={t('common.close')}
        onClose={onCancel}
      >
        <div className="p-1.5 flex flex-col gap-1">
          {options.map((opt, idx) => {
            const def = core.cellTypeById.get(opt.cellId);
            if (!def) return null;

            const sprite = def.defaultSpriteId
              ? core.spriteById.get(def.defaultSpriteId)
              : undefined;

            const missingReqs: string[] = [];
            for (const req of opt.requires ?? []) {
              const have = Number(core.getGlobalValue(req.varId));
              if (have < req.min) {
                const v = core.globalVarById.get(req.varId);
                missingReqs.push(`${v?.shortName ?? v?.name ?? req.varId} ${have}/${req.min}`);
              }
            }
            const disabled = Boolean(opt.disabled) || missingReqs.length > 0;

            return (
              <button
                key={`${opt.cellId}-${idx}`}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onHoverCellOption(null);
                  onResolve(opt.cellId);
                }}
                onMouseEnter={() => onHoverCellOption(def.id)}
                onMouseLeave={() => onHoverCellOption(null)}
                onFocus={() => onHoverCellOption(def.id)}
                onBlur={() => onHoverCellOption(null)}
                className={`w-full text-left px-2.5 py-2 rounded-md transition-colors flex items-start gap-2.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                  disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-[#17202B] focus-visible:bg-[#17202B] cursor-pointer'
                }`}
              >
                {sprite ? (
                  <img
                    src={sprite.dataUrl}
                    alt=""
                    className="w-7 h-7 rounded-[3px] shrink-0 border border-white/10 bg-[#0B0F14] mt-0.5"
                    style={{ imageRendering: 'pixelated' }}
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="w-6 h-6 mt-0.5 rounded-[3px] shrink-0 border border-white/15"
                    style={{ backgroundColor: def.defaultColor }}
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-[#E6EDF3] truncate">
                      {opt.label ?? def.name}
                    </span>
                  </span>
                  {opt.badge && (
                    <span
                      className={`block font-mono tabular-nums text-[11px] mt-0.5 ${
                        missingReqs.length > 0
                          ? 'text-[#F43F5E]'
                          : TONE_TEXT[opt.badgeTone ?? 'muted']
                      }`}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {missingReqs.length > 0 ? (
                    <span className="block text-[11px] text-[#F43F5E] mt-0.5 leading-snug">
                      Missing: {missingReqs.join(', ')}
                    </span>
                  ) : opt.subtitle ? (
                    <span className="block text-[11px] text-[#8B98A9] mt-0.5 leading-snug">
                      {opt.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </CellPopover>
    );
  }

  // ==========================================================================
  // 2. Built-in: @builtin/confirm
  // ==========================================================================
  if (interfaceId === '@builtin/confirm') {
    const title =
      typeof params.title === 'string' && params.title
        ? params.title
        : `Confirm (${snapshot.cellType.name})`;
    const message = typeof params.message === 'string' ? params.message : '';
    const lines = Array.isArray(params.lines) ? (params.lines as ConfirmLine[]) : [];
    const warnings = Array.isArray(params.warnings) ? (params.warnings as string[]) : [];
    const confirmLabel =
      typeof params.confirmLabel === 'string' ? params.confirmLabel : 'Confirm';
    const cancelLabel =
      typeof params.cancelLabel === 'string' ? params.cancelLabel : 'Cancel';
    const danger = Boolean(params.danger);

    return (
      <CellPopover
        title={title}
        spriteUrl={currentSpriteUrl}
        swatchColor={snapshot.cellType.defaultColor}
        cellX={cellX}
        cellY={cellY}
        screenX={screenX}
        screenY={screenY}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
        width={276}
        estimatedHeight={190 + lines.length * 18 + warnings.length * 24}
        role="alertdialog"
        ariaLabel={`${title} (${cellX}, ${cellY})`}
        closeAriaLabel={t('common.close')}
        onClose={onCancel}
      >
        <div className="p-3.5 space-y-3">
          {message && (
            <p className="text-xs text-[#8B98A9] leading-relaxed">{message}</p>
          )}

          {lines.length > 0 && (
            <div className="space-y-1 text-xs">
              {lines.map((line, i) => (
                <div key={i} className={TONE_TEXT[line.tone ?? 'default']}>
                  {line.text}
                </div>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-[#F59E0B] leading-snug">
                  {w}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 text-xs font-semibold text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => onResolve(true)}
              className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                danger
                  ? 'text-[#E6EDF3] bg-[#F43F5E] hover:bg-[#E11D48]'
                  : 'text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572]'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </CellPopover>
    );
  }

  // ==========================================================================
  // 3. Built-in: @builtin/inspector (as clickable popover)
  // ==========================================================================
  if (interfaceId === '@builtin/inspector') {
    return (
      <CellPopover
        title={snapshot.cellType.name}
        spriteUrl={currentSpriteUrl}
        swatchColor={snapshot.cellType.defaultColor}
        cellX={cellX}
        cellY={cellY}
        screenX={screenX}
        screenY={screenY}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
        width={248}
        estimatedHeight={180}
        ariaLabel={`${snapshot.cellType.name} (${cellX}, ${cellY})`}
        closeAriaLabel={t('common.close')}
        onClose={onCancel}
      >
        <div className="p-3.5 space-y-2.5 text-xs">
          {snapshot.cellType.description && (
            <p className="text-[11px] text-[#8B98A9] leading-snug">
              {snapshot.cellType.description}
            </p>
          )}
          {snapshot.visibleState.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[#1F2A38]">
              {snapshot.visibleState.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-2">
                  <span className="text-[#8B98A9]">{f.label}</span>
                  <span className="font-mono tabular-nums text-[#E6EDF3]">
                    {String(f.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {snapshot.supplies.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[#1F2A38]">
              {snapshot.supplies.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2">
                  <span className="text-[#8B98A9]">{s.name}</span>
                  <span
                    className="font-mono tabular-nums font-semibold"
                    style={{ color: s.amount > 0 ? s.color : '#8B98A9' }}
                  >
                    {s.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CellPopover>
    );
  }

  // ==========================================================================
  // 4. Custom Node-Powered InterfaceManifest
  // ==========================================================================
  const iface = core.interfaceById.get(interfaceId);
  if (!iface) return null;

  const tplCtx = core.getUiTemplateContext(cellX, cellY, params);
  const title = formatUiTemplate(iface.title, tplCtx) || snapshot.cellType.name;
  const visibleBlocks = iface.blocks.filter((b) =>
    evaluateUiConditions(b.visibleWhen, tplCtx)
  );

  const handleButtonPress = (btn: UiButtonDef) => {
    if (btn.actionId) {
      onTriggerAction(iface.id, btn.actionId);
    } else if (btn.closeResult !== undefined) {
      onResolve(btn.closeResult);
    } else {
      onCancel();
    }
  };

  return (
    <CellPopover
      title={title}
      spriteUrl={iface.showSwatch ? currentSpriteUrl : undefined}
      swatchColor={iface.showSwatch ? snapshot.cellType.defaultColor : undefined}
      cellX={cellX}
      cellY={cellY}
      screenX={screenX}
      screenY={screenY}
      containerWidth={containerWidth}
      containerHeight={containerHeight}
      width={iface.width ?? 256}
      estimatedHeight={Math.min(380, 72 + visibleBlocks.length * 44)}
      role={iface.role === 'modal' ? 'alertdialog' : 'dialog'}
      ariaLabel={`${title} (${cellX}, ${cellY})`}
      closeAriaLabel={t('common.close')}
      onClose={onCancel}
    >
      <div className="p-3.5 space-y-2.5">
        {iface.subtitle && (
          <p className="text-[11px] text-[#8B98A9] leading-snug">
            {formatUiTemplate(iface.subtitle, tplCtx)}
          </p>
        )}

        {visibleBlocks.map((block, idx) => {
          if (block.kind === 'text') {
            return (
              <p
                key={idx}
                className={`text-xs leading-snug ${TONE_TEXT[block.tone ?? 'default']}`}
              >
                {formatUiTemplate(block.text, tplCtx)}
              </p>
            );
          }

          if (block.kind === 'stat') {
            return (
              <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-[#8B98A9]">
                  {formatUiTemplate(block.label, tplCtx)}
                </span>
                <span
                  className={`font-mono tabular-nums font-semibold ${TONE_TEXT[block.tone ?? 'default']}`}
                >
                  {formatUiTemplate(block.value, tplCtx)}
                </span>
              </div>
            );
          }

          if (block.kind === 'button') {
            const disabled =
              block.disabledWhen !== undefined &&
              block.disabledWhen.length > 0 &&
              evaluateUiConditions(block.disabledWhen, tplCtx);

            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => handleButtonPress(block)}
                className={`w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                  disabled
                    ? 'text-[#8B98A9] bg-[#0B0F14] border border-[#1F2A38] opacity-55 cursor-not-allowed'
                    : `${buttonVariantClass(block.variant)} cursor-pointer`
                }`}
              >
                {formatUiTemplate(block.label, tplCtx)}
              </button>
            );
          }

          if (block.kind === 'buttonRow') {
            const visibleBtns = block.buttons.filter((b) =>
              evaluateUiConditions(b.visibleWhen, tplCtx)
            );
            if (visibleBtns.length === 0) return null;
            return (
              <div
                key={idx}
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(3, visibleBtns.length)}, minmax(0, 1fr))`,
                }}
              >
                {visibleBtns.map((btn, bIdx) => {
                  const disabled =
                    btn.disabledWhen !== undefined &&
                    btn.disabledWhen.length > 0 &&
                    evaluateUiConditions(btn.disabledWhen, tplCtx);
                  return (
                    <button
                      key={bIdx}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleButtonPress(btn)}
                      className={`inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                        disabled
                          ? 'text-[#8B98A9] bg-[#0B0F14] border border-[#1F2A38] opacity-55 cursor-not-allowed'
                          : `${buttonVariantClass(btn.variant)} cursor-pointer`
                      }`}
                    >
                      {formatUiTemplate(btn.label, tplCtx)}
                    </button>
                  );
                })}
              </div>
            );
          }

          if (block.kind === 'selectList') {
            const selectedVal = block.selectedStateKey
              ? String(tplCtx.getState(block.selectedStateKey))
              : '';

            const items: {
              value: string;
              label: string;
              subtitle?: string;
              color?: string;
            }[] =
              block.source === 'globalVars'
                ? core.manifest.globalState.variables
                    .filter((v) => {
                      if (v.access === 'private') return false;
                      if (block.filterHasCap && !v.hasCap) return false;
                      if (block.filterTag && !(v.tags ?? []).includes(block.filterTag)) {
                        return false;
                      }
                      return true;
                    })
                    .map((v) => {
                      const val = core.getGlobalValue(v.id);
                      const cap = v.hasCap ? core.getGlobalCap(v.id) : null;
                      return {
                        value: v.id,
                        label: v.name,
                        subtitle: cap !== null ? `${String(val)}/${cap}` : String(val),
                        color: v.color,
                      };
                    })
                : (block.options ?? []);

            return (
              <div key={idx} className="space-y-1.5 pt-1 border-t border-[#1F2A38]">
                {block.label && (
                  <div className="text-[11px] text-[#8B98A9]">{block.label}</div>
                )}
                <div className="flex flex-col gap-1">
                  {items.map((item) => {
                    const isSelected = selectedVal === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() =>
                          onTriggerAction(iface.id, block.actionId, item.value)
                        }
                        aria-pressed={isSelected}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#17202B] border-[#10B981] text-[#E6EDF3]'
                            : 'bg-[#0B0F14] border-[#1F2A38] text-[#8B98A9] hover:text-[#E6EDF3] hover:border-[#2D3C4E]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          {item.color && (
                            <span
                              className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                              style={{ backgroundColor: item.color }}
                              aria-hidden="true"
                            />
                          )}
                          <span className="font-medium truncate">{item.label}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 shrink-0">
                          {item.subtitle && (
                            <span className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
                              {item.subtitle}
                            </span>
                          )}
                          {isSelected && (
                            <Check
                              className="w-3.5 h-3.5 text-[#10B981]"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (block.kind === 'supplyList') {
            const list = block.onlyPositive
              ? snapshot.supplies.filter((s) => s.amount > 0)
              : snapshot.supplies;
            if (list.length === 0) return null;
            return (
              <div key={idx} className="space-y-1 pt-2 border-t border-[#1F2A38] text-xs">
                {list.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <span className="text-[#8B98A9]">{s.name}</span>
                    <span
                      className="font-mono tabular-nums font-semibold"
                      style={{ color: s.amount > 0 ? s.color : '#8B98A9' }}
                    >
                      {s.amount}
                    </span>
                  </div>
                ))}
              </div>
            );
          }

          if (block.kind === 'cellStateList') {
            const excluded = new Set(block.excludeKeys ?? []);
            const fields = snapshot.visibleState.filter((f) => !excluded.has(f.key));
            if (fields.length === 0) return null;
            return (
              <div key={idx} className="space-y-1 pt-2 border-t border-[#1F2A38] text-xs">
                {fields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-2">
                    <span className="text-[#8B98A9]">{f.label}</span>
                    <span className="font-mono tabular-nums text-[#E6EDF3]">
                      {String(f.value)}
                    </span>
                  </div>
                ))}
              </div>
            );
          }

          return null;
        })}
      </div>
    </CellPopover>
  );
}
