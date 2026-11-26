import { Check, Minus, Plus } from 'lucide-react';
import { SimulationCore } from '../engine/SimulationCore';
import {
  CellTypeManifest,
  PanelBlock,
  StatusTone,
  evaluateConditions,
  evaluateCycleRules,
  formatCycleDeltaSummary,
  formatTemplate,
} from '../engine/sdk';
import { t } from '../i18n';
import { SoundKind } from '../utils/sound';

interface CellPanelViewProps {
  core: SimulationCore;
  x: number;
  y: number;
  cellType: CellTypeManifest;
  onMutated: (sound?: SoundKind) => void;
  onClose: () => void;
}

const TONE_CLASS: Record<StatusTone, string> = {
  positive: 'text-[#10B981]',
  warning: 'text-[#F59E0B]',
  danger: 'text-[#F43F5E]',
  neutral: 'text-[#E6EDF3]',
};

export function CellPanelView({
  core,
  x,
  y,
  cellType,
  onMutated,
  onClose,
}: CellPanelViewProps) {
  const blocks: readonly PanelBlock[] = cellType.panel ?? [];
  if (blocks.length === 0) return null;

  const evalCtx = core.createEvalContext(x, y, { cellType });
  const cycleOutcome = evaluateCycleRules(cellType, evalCtx);
  const cycleOutputText = formatCycleDeltaSummary(cycleOutcome, core.manifest);

  const statBlocks = blocks.filter(
    (b): b is Extract<PanelBlock, { type: 'stat' }> =>
      b.type === 'stat' && evaluateConditions(b.when, evalCtx)
  );
  const interactiveBlocks = blocks.filter((b) => b.type !== 'stat');

  return (
    <div className="p-3.5 space-y-3">
      {statBlocks.length > 0 && (
        <div className="space-y-1.5 text-xs">
          {statBlocks.map((block, idx) => {
            let valueText: string;
            let tone: StatusTone = block.tone ?? 'neutral';

            if (block.value === 'cycleOutput') {
              valueText = cycleOutputText || '0';
              tone = cycleOutputText ? 'positive' : 'neutral';
            } else {
              valueText = formatTemplate(block.value, evalCtx);
            }

            if (block.toneWhen) {
              for (const rule of block.toneWhen) {
                if (evaluateConditions(rule.when, evalCtx)) {
                  tone = rule.tone;
                  break;
                }
              }
            }

            return (
              <div
                key={`${block.label}-${idx}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-[#8B98A9]">{block.label}</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${TONE_CLASS[tone]}`}
                >
                  {valueText}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {interactiveBlocks.map((block, idx) => {
        if (block.type === 'transfer') {
          const step = block.step ?? 1;
          const current = Number(evalCtx.state[block.stateKey] ?? 0);
          const freePool = core.getResource(block.resource);
          const canInc = current + step <= block.max && freePool >= step;
          const canDec = current - step >= block.min;
          const isSingleToggle = block.max - block.min === step;

          return (
            <div
              key={`transfer-${block.stateKey}-${idx}`}
              className={
                statBlocks.length > 0 || idx > 0
                  ? 'pt-2.5 border-t border-[#1F2A38] space-y-2'
                  : 'space-y-2'
              }
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8B98A9]">{block.label}</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    current > block.min ? 'text-[#10B981]' : 'text-[#F43F5E]'
                  }`}
                >
                  {current} / {block.max}
                </span>
              </div>

              {isSingleToggle ? (
                current > block.min ? (
                  <button
                    type="button"
                    disabled={!canDec}
                    onClick={() => {
                      if (
                        core.transferPanelResource(
                          x,
                          y,
                          block.resource,
                          block.stateKey,
                          -step,
                          block.min,
                          block.max
                        )
                      ) {
                        onMutated('erase');
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
                  >
                    <span>{block.removeLabel ?? t('panel.remove')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canInc}
                    onClick={() => {
                      if (
                        core.transferPanelResource(
                          x,
                          y,
                          block.resource,
                          block.stateKey,
                          step,
                          block.min,
                          block.max,
                          block.resetKeys,
                          block.clearNotifications
                        )
                      ) {
                        onMutated('build');
                      }
                    }}
                    className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                      canInc
                        ? 'text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] cursor-pointer'
                        : 'text-[#8B98A9] bg-[#0B0F14] border border-[#1F2A38] opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <span>
                      {canInc
                        ? `${block.assignLabel ?? t('panel.assign')} (${freePool})`
                        : t('panel.noneAvailable')}
                    </span>
                  </button>
                )
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canDec}
                    onClick={() => {
                      if (
                        core.transferPanelResource(
                          x,
                          y,
                          block.resource,
                          block.stateKey,
                          -step,
                          block.min,
                          block.max
                        )
                      ) {
                        onMutated('erase');
                      }
                    }}
                    className={`inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                      canDec
                        ? 'text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border-[#2D3C4E] cursor-pointer'
                        : 'text-[#8B98A9] bg-[#0B0F14] border-[#1F2A38] opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{step}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canInc}
                    onClick={() => {
                      if (
                        core.transferPanelResource(
                          x,
                          y,
                          block.resource,
                          block.stateKey,
                          step,
                          block.min,
                          block.max,
                          block.resetKeys,
                          block.clearNotifications
                        )
                      ) {
                        onMutated('build');
                      }
                    }}
                    className={`inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                      canInc
                        ? 'text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] cursor-pointer'
                        : 'text-[#8B98A9] bg-[#0B0F14] border border-[#1F2A38] opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{step}</span>
                  </button>
                </div>
              )}
            </div>
          );
        }

        if (block.type === 'resourceSelect') {
          const selectedId = String(evalCtx.state[block.stateKey] ?? '');
          const resources = core.getResources();
          const caps = core.getResourceCaps();
          const eligible = core.manifest.resources.filter(
            (r) =>
              (!block.kind || r.kind === block.kind) &&
              (!block.tag || (r.tags ?? []).includes(block.tag))
          );

          return (
            <div
              key={`res-select-${block.stateKey}-${idx}`}
              className={
                statBlocks.length > 0 || idx > 0
                  ? 'pt-2.5 border-t border-[#1F2A38] space-y-2'
                  : 'space-y-2'
              }
            >
              {(block.label || block.bonusText) && (
                <div className="flex items-center justify-between text-[11px] text-[#8B98A9]">
                  <span>{block.label ?? ''}</span>
                  {block.bonusText && (
                    <span className="font-mono tabular-nums font-semibold text-[#E6EDF3]">
                      {block.bonusText}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1">
                {eligible.map((res) => {
                  const active = selectedId === res.id;
                  const currentVal = resources[res.id] ?? 0;
                  const maxVal =
                    caps[res.id] ??
                    (res.kind === 'capped' ? res.initialMax : null);

                  return (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => {
                        core.selectPanelResource(x, y, block.stateKey, res.id);
                        onMutated('click');
                      }}
                      aria-pressed={active}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md border text-xs transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                        active
                          ? 'bg-[#17202B] border-[#10B981] text-[#E6EDF3]'
                          : 'bg-[#0B0F14] border-[#1F2A38] text-[#8B98A9] hover:text-[#E6EDF3] hover:border-[#2D3C4E]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                          style={{ backgroundColor: res.color }}
                          aria-hidden="true"
                        />
                        <span className="font-medium truncate">{res.name}</span>
                      </span>

                      <span className="inline-flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
                          {maxVal !== null
                            ? `${currentVal}/${maxVal}`
                            : currentVal}
                        </span>
                        {active && (
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

        if (block.type === 'actionButton') {
          const condOk = evaluateConditions(block.when, evalCtx);
          const costOk = core.canAffordCost(block.cost).ok;
          const enabled = condOk && costOk;
          const toneStyle =
            block.tone === 'danger'
              ? 'text-[#E6EDF3] bg-[#F43F5E] hover:bg-[#E11D48]'
              : block.tone === 'neutral'
                ? 'text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E]'
                : 'text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572]';

          return (
            <div
              key={`action-${block.label}-${idx}`}
              className={
                statBlocks.length > 0 || idx > 0
                  ? 'pt-2.5 border-t border-[#1F2A38]'
                  : ''
              }
            >
              <button
                type="button"
                disabled={!enabled}
                onClick={() => {
                  if (!enabled) return;
                  if (core.executePanelAction(x, y, block.cost, block.do)) {
                    onMutated(block.sound ?? 'build');
                    if (block.closeAfter) {
                      onClose();
                    }
                  }
                }}
                className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                  enabled
                    ? `${toneStyle} cursor-pointer`
                    : 'text-[#8B98A9] bg-[#0B0F14] border border-[#1F2A38] opacity-60 cursor-not-allowed'
                }`}
              >
                <span>{formatTemplate(block.label, evalCtx)}</span>
              </button>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
