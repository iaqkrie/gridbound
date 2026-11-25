import { ArrowLeft, SkipForward } from 'lucide-react';
import { ResourceManifest, SimulationStats } from '../engine/sdk';
import { t } from '../i18n';

interface TopBarProps {
  saveName: string;
  resources: readonly ResourceManifest[];
  stats: SimulationStats;
  onRequestExit: () => void;
  onNextTurn: () => void;
}

export function TopBar({
  saveName,
  resources,
  stats,
  onRequestExit,
  onNextTurn,
}: TopBarProps) {
  return (
    <header className="h-14 shrink-0 bg-[#111720] border-b border-[#1F2A38] px-4 flex items-center justify-between gap-4 select-none">
      {/* Zone 1: Menu button + Save title */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <button
          type="button"
          onClick={onRequestExit}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] rounded px-1.5 py-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('common.menu')}</span>
        </button>
        <span className="text-[#1F2A38]" aria-hidden="true">
          /
        </span>
        <span className="text-sm font-semibold text-[#E6EDF3] whitespace-nowrap truncate max-w-[140px]">
          {saveName}
        </span>
      </div>

      {/* Zone 2: Global Resources & Cycle Counter */}
      <div className="flex items-center gap-4 text-xs whitespace-nowrap overflow-x-auto no-scrollbar">
        {resources.map((res) => {
          const amount = stats.resources[res.id] ?? 0;
          const cap = stats.resourceCaps[res.id] ?? null;
          const delta = stats.projectedDelta[res.id] ?? 0;
          const breakdown = stats.projectedBreakdown[res.id];

          const hasBreakdownActivity =
            breakdown && (breakdown.gained > 0 || breakdown.consumed > 0);
          const isCappedOverflow = cap !== null && amount >= cap && delta > 0;
          const tooltipParts = [
            cap !== null
              ? `${res.name}: ${amount} / ${cap}`
              : `${res.name}: ${amount}`,
          ];
          if (hasBreakdownActivity) {
            tooltipParts.push(
              t('hud.cycleBreakdown', {
                gained: breakdown.gained,
                consumed: breakdown.consumed,
              })
            );
          }

          return (
            <div
              key={res.id}
              className="flex items-baseline gap-1.5 shrink-0"
              title={tooltipParts.join(' · ')}
            >
              <span
                className="w-1.5 h-1.5 rounded-[1px] self-center shrink-0"
                style={{ backgroundColor: res.color }}
                aria-hidden="true"
              />
              <span className="text-[#8B98A9]">
                {res.shortName ?? res.name}
              </span>
              <span
                className={`font-mono tabular-nums text-sm font-semibold ${
                  amount < 0
                    ? 'text-[#F43F5E]'
                    : isCappedOverflow
                      ? 'text-[#F59E0B]'
                      : 'text-[#E6EDF3]'
                }`}
              >
                {amount}
                {cap !== null && (
                  <span className="text-[#8B98A9] font-normal text-xs">
                    /{cap}
                  </span>
                )}
              </span>
              {delta !== 0 ? (
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    delta > 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'
                  }`}
                >
                  {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                </span>
              ) : hasBreakdownActivity ? (
                <span className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
                  0
                </span>
              ) : null}
            </div>
          );
        })}

        <span className="text-[#1F2A38] shrink-0" aria-hidden="true">
          ·
        </span>

        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-[#8B98A9]">{t('common.cycle')}</span>
          <span className="font-mono tabular-nums text-sm font-semibold text-[#E6EDF3]">
            {stats.cycle}
          </span>
        </div>
      </div>

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onNextTurn}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111720] focus-visible:ring-[#10B981]"
        >
          <span>{t('common.nextCycle')}</span>
          <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
