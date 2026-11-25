import { X } from 'lucide-react';
import { t } from '../i18n';

interface ExitConfirmModalProps {
  saveName: string;
  cycle: number;
  onSaveAndExit: () => void;
  onExitWithoutSaving: () => void;
  onCancel: () => void;
}

export function ExitConfirmModal({
  saveName,
  cycle,
  onSaveAndExit,
  onExitWithoutSaving,
  onCancel,
}: ExitConfirmModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('exit.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs px-4"
    >
      <div className="w-full max-w-xs bg-[#111720] border border-[#2D3C4E] rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1F2A38]">
          <h2 className="text-sm font-semibold text-[#E6EDF3]">
            {t('exit.title')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('common.close')}
            className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-xs text-[#8B98A9] font-mono tabular-nums">
            {t('exit.meta', { name: saveName, cycle })}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onSaveAndExit}
              className="w-full px-4 py-2.5 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors cursor-pointer"
            >
              {t('exit.saveAndExit')}
            </button>
            <button
              type="button"
              onClick={onExitWithoutSaving}
              className="w-full px-4 py-2 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
            >
              {t('exit.withoutSaving')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-4 py-2 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] rounded-md transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
