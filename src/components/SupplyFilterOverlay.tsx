import { Layers } from 'lucide-react';
import {
  SupplyId,
  SupplyManifest,
  SupplyOverlayMode,
} from '../engine/sdk';
import { t } from '../i18n';

interface SupplyFilterOverlayProps {
  supplies: readonly SupplyManifest[];
  activeSupplyId: SupplyId | null;
  overlayMode: SupplyOverlayMode;
  onSelectSupply: (supplyId: SupplyId) => void;
  onChangeOverlayMode: (mode: SupplyOverlayMode) => void;
}

export function SupplyFilterOverlay({
  supplies,
  activeSupplyId,
  overlayMode,
  onSelectSupply,
  onChangeOverlayMode,
}: SupplyFilterOverlayProps) {
  if (supplies.length === 0) return null;

  const isOff = overlayMode === 'off';

  const handleToggleSupply = (supplyId: SupplyId) => {
    if (!isOff && activeSupplyId === supplyId) {
      onChangeOverlayMode('off');
      return;
    }
    onSelectSupply(supplyId);
    if (isOff) {
      onChangeOverlayMode('heatmap');
    }
  };

  return (
    <div
      role="region"
      aria-label={t('hud.layers')}
      className="pointer-events-auto absolute top-3.5 left-3.5 z-20 flex flex-col gap-1.5 bg-[#111720]/95 border border-[#1F2A38] rounded-lg p-2 backdrop-blur-sm select-none"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#8B98A9]">
          <Layers className="w-3 h-3" aria-hidden="true" />
          <span>{t('hud.layers')}</span>
        </span>

        {!isOff && (
          <div className="flex items-center gap-0.5 bg-[#0B0F14] p-0.5 rounded border border-[#1F2A38]">
            <button
              type="button"
              onClick={() => onChangeOverlayMode('heatmap')}
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                overlayMode === 'heatmap'
                  ? 'bg-[#17202B] text-[#E6EDF3]'
                  : 'text-[#8B98A9] hover:text-[#E6EDF3]'
              }`}
            >
              {t('hud.layerHeatmap')}
            </button>
            <button
              type="button"
              onClick={() => onChangeOverlayMode('numbers')}
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                overlayMode === 'numbers'
                  ? 'bg-[#17202B] text-[#E6EDF3]'
                  : 'text-[#8B98A9] hover:text-[#E6EDF3]'
              }`}
            >
              {t('hud.layerNumbers')}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {supplies.map((s) => {
          const active = !isOff && activeSupplyId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleToggleSupply(s.id)}
              aria-pressed={active}
              className={`flex items-center justify-between gap-4 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                active
                  ? 'bg-[#17202B] text-[#E6EDF3] border border-[#2D3C4E]'
                  : 'text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B]/50 border border-transparent'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span>{s.name}</span>
              </span>
              {active && (
                <span className="text-[10px] text-[#10B981] font-mono">
                  {t('common.on')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
