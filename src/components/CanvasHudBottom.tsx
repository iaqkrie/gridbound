import { Crosshair, Minus, Plus, Volume2, VolumeX } from 'lucide-react';
import { GridCoordinate } from '../engine/sdk';
import { t } from '../i18n';

interface CanvasHudBottomProps {
  hoveredCell: GridCoordinate | null;
  zoomPercent: number;
  soundEnabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCamera: () => void;
  onToggleSound: () => void;
}

export function CanvasHudBottom({
  hoveredCell,
  zoomPercent,
  soundEnabled,
  onZoomIn,
  onZoomOut,
  onResetCamera,
  onToggleSound,
}: CanvasHudBottomProps) {
  return (
    <div className="pointer-events-none absolute inset-x-3.5 bottom-3.5 z-20 flex items-end justify-between gap-3 select-none">
      {/* Bottom-Left: Hovered Cell Coordinates */}
      <div className="pointer-events-auto bg-[#111720]/90 border border-[#1F2A38] rounded-md px-2.5 py-1.5 backdrop-blur-sm text-[11px] font-mono tabular-nums text-[#8B98A9] min-w-[54px] text-center">
        {hoveredCell ? (
          <span className="text-[#E6EDF3]">
            {hoveredCell.x}, {hoveredCell.y}
          </span>
        ) : (
          <span>—</span>
        )}
      </div>

      {/* Bottom-Right: Sound toggle & Camera Zoom */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={soundEnabled ? t('hud.mute') : t('hud.unmute')}
          title={soundEnabled ? t('hud.mute') : t('hud.unmute')}
          className="p-2 bg-[#111720]/95 border border-[#1F2A38] rounded-lg text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B] transition-colors backdrop-blur-sm cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>

        <div className="flex items-center bg-[#111720]/95 border border-[#1F2A38] rounded-lg p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={onZoomOut}
            aria-label={t('hud.zoomOut')}
            title={t('hud.zoomOut')}
            className="p-1.5 text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B] rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
          >
            <Minus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <span className="px-2 text-[11px] font-mono tabular-nums text-[#E6EDF3] min-w-[46px] text-center">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label={t('hud.zoomIn')}
            title={t('hud.zoomIn')}
            className="p-1.5 text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B] rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <div className="w-px h-4 bg-[#1F2A38] mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={onResetCamera}
            aria-label={t('hud.resetCamera')}
            title={t('hud.resetCamera')}
            className="p-1.5 text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B] rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
          >
            <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
