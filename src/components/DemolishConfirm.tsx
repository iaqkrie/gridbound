import { Trash2 } from 'lucide-react';
import {
  DemolishInfo,
  ResolvedCellType,
  ResourceManifest,
  StatusTone,
} from '../engine/sdk';
import { t } from '../i18n';
import { CellPopover } from './CellPopover';

export interface DemolishMenuState {
  cellX: number;
  cellY: number;
  screenX: number;
  screenY: number;
  cellType: ResolvedCellType;
}

interface DemolishConfirmProps {
  menu: DemolishMenuState;
  resources: readonly ResourceManifest[];
  demolishInfo: DemolishInfo;
  containerWidth: number;
  containerHeight: number;
  onConfirm: () => void;
  onClose: () => void;
}

const TONE_CLASS: Record<StatusTone, string> = {
  positive: 'text-[#10B981]',
  warning: 'text-[#F59E0B]',
  danger: 'text-[#F43F5E]',
  neutral: 'text-[#8B98A9]',
};

export function DemolishConfirm({
  menu,
  resources,
  demolishInfo,
  containerWidth,
  containerHeight,
  onConfirm,
  onClose,
}: DemolishConfirmProps) {
  const refundEntries = Object.entries(
    menu.cellType.onDemolishEffect ?? {}
  ).filter(([, val]) => val !== 0);
  const extraLines = demolishInfo.lines ?? [];
  const warnings = demolishInfo.warnings ?? [];

  return (
    <CellPopover
      title={t('demolish.title', { name: menu.cellType.name })}
      cellX={menu.cellX}
      cellY={menu.cellY}
      screenX={menu.screenX}
      screenY={menu.screenY}
      containerWidth={containerWidth}
      containerHeight={containerHeight}
      width={248}
      estimatedHeight={172}
      role="alertdialog"
      ariaLabel={t('demolish.aria', { name: menu.cellType.name })}
      closeAriaLabel={t('common.close')}
      onClose={onClose}
    >
      <div className="p-3.5 space-y-3">
        {(refundEntries.length > 0 || extraLines.length > 0) && (
          <div className="space-y-1">
            {refundEntries.map(([resId, delta]) => {
              const resDef = resources.find((r) => r.id === resId);
              const sign = delta > 0 ? '+' : '−';
              const absVal = Math.abs(delta);
              return (
                <div
                  key={resId}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-[#8B98A9]">
                    {resDef?.name ?? resId}
                  </span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      delta > 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'
                    }`}
                  >
                    {sign}
                    {absVal}
                  </span>
                </div>
              );
            })}

            {extraLines.map((line, idx) => (
              <div
                key={`${line.label}-${idx}`}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-[#8B98A9]">{line.label}</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    TONE_CLASS[line.tone ?? 'neutral']
                  }`}
                >
                  {line.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {warnings.map((text, idx) => (
          <p key={idx} className="text-[11px] text-[#F59E0B] leading-snug">
            {text}
          </p>
        ))}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] rounded-md transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#E6EDF3] bg-[#F43F5E] hover:bg-[#E11D48] rounded-md transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('demolish.confirm')}</span>
          </button>
        </div>
      </div>
    </CellPopover>
  );
}
