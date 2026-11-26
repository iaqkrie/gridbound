import { CellInspection, StatusTone, SupplyManifest } from '../engine/sdk';

interface HoverCellCardProps {
  inspection: CellInspection | null;
  supplies: readonly SupplyManifest[];
}

const TONE_CLASS: Record<StatusTone, string> = {
  positive: 'text-[#10B981]',
  warning: 'text-[#F59E0B]',
  danger: 'text-[#F43F5E]',
  neutral: 'text-[#8B98A9]',
};

export function HoverCellCard({ inspection, supplies }: HoverCellCardProps) {
  if (!inspection) return null;

  const badge = inspection.statusBadge;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute top-3.5 right-3.5 z-20 w-56 bg-[#111720]/95 border border-[#1F2A38] rounded-lg p-3 backdrop-blur-sm select-none"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-[2px] shrink-0 border border-white/15"
            style={{
              backgroundColor:
                inspection.cellType.visual.icon === 'empty'
                  ? '#1E293B'
                  : inspection.cellType.visual.color,
            }}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-[#E6EDF3] truncate">
            {inspection.cellType.name}
          </span>
        </div>

        {badge && (
          <span
            className={`font-mono tabular-nums text-[11px] shrink-0 ${
              TONE_CLASS[badge.tone]
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>

      {supplies.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 pt-2 border-t border-[#1F2A38] text-[11px]">
          {supplies.map((s) => {
            const val = inspection.supplies[s.id] ?? 0;
            return (
              <span key={s.id} className="inline-flex items-center gap-1">
                <span className="text-[#8B98A9]">{s.name}:</span>
                <span
                  className="font-mono tabular-nums font-medium"
                  style={{ color: val > 0 ? s.color : '#8B98A9' }}
                >
                  {val}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {inspection.transitionLabel && (
        <div
          className={`mt-1.5 text-[11px] leading-snug ${
            TONE_CLASS[inspection.transitionTone]
          }`}
        >
          {inspection.transitionLabel}
        </div>
      )}
    </div>
  );
}
