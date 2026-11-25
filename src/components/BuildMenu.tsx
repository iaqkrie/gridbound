import {
  AffordabilityCheck,
  CellTypeId,
  ResolvedCellType,
  ResourceId,
  RulesetManifest,
  StatusTone,
  SupplyId,
} from '../engine/sdk';
import { t } from '../i18n';
import { CellPopover } from './CellPopover';

export interface BuildMenuState {
  cellX: number;
  cellY: number;
  screenX: number;
  screenY: number;
  options: CellTypeId[];
}

interface BuildMenuProps {
  menu: BuildMenuState;
  manifest: RulesetManifest;
  cellTypes: readonly ResolvedCellType[];
  currentResources: Record<ResourceId, number>;
  resourceCaps: Record<ResourceId, number | null>;
  localSupplies: Record<SupplyId, number>;
  checkAffordability: (cellTypeId: CellTypeId) => AffordabilityCheck;
  containerWidth: number;
  containerHeight: number;
  onSelect: (cellTypeId: CellTypeId) => void;
  onHoverOption: (cellTypeId: CellTypeId | null) => void;
  onClose: () => void;
}

const TONE_CLASS: Record<StatusTone, string> = {
  positive: 'text-[#10B981]',
  warning: 'text-[#F59E0B]',
  danger: 'text-[#F43F5E]',
  neutral: 'text-[#8B98A9]',
};

export function BuildMenu({
  menu,
  manifest,
  cellTypes,
  currentResources,
  resourceCaps,
  localSupplies,
  checkAffordability,
  containerWidth,
  containerHeight,
  onSelect,
  onHoverOption,
  onClose,
}: BuildMenuProps) {
  const optionDefs = menu.options
    .map((id) => cellTypes.find((c) => c.id === id))
    .filter((c): c is ResolvedCellType => Boolean(c));

  const formatCostSummary = (def: ResolvedCellType): string => {
    const parts: string[] = [];
    if (def.buildCost) {
      for (const [resId, cost] of Object.entries(def.buildCost)) {
        if (cost <= 0) continue;
        const name =
          manifest.resources.find((r) => r.id === resId)?.shortName ??
          manifest.resources.find((r) => r.id === resId)?.name ??
          resId;
        parts.push(`${cost} ${name}`);
      }
    }
    if (def.onBuildEffect) {
      for (const [resId, delta] of Object.entries(def.onBuildEffect)) {
        if (!delta) continue;
        const name =
          manifest.resources.find((r) => r.id === resId)?.shortName ??
          manifest.resources.find((r) => r.id === resId)?.name ??
          resId;
        const sign = delta > 0 ? '+' : '−';
        parts.push(`${sign}${Math.abs(delta)} ${name}`);
      }
    }
    return parts.join(' · ');
  };

  return (
    <CellPopover
      title={t('build.title')}
      cellX={menu.cellX}
      cellY={menu.cellY}
      screenX={menu.screenX}
      screenY={menu.screenY}
      containerWidth={containerWidth}
      containerHeight={containerHeight}
      width={268}
      estimatedHeight={52 + optionDefs.length * 72}
      ariaLabel={`${t('build.title')} (${menu.cellX}, ${menu.cellY})`}
      closeAriaLabel={t('common.close')}
      onClose={onClose}
    >
      <div className="p-1.5 flex flex-col gap-1">
        {optionDefs.map((def) => {
          const afford = checkAffordability(def.id);
          const preview = afford.ok
            ? (def.behavior?.module.getBuildPreview?.(
                {
                  x: menu.cellX,
                  y: menu.cellY,
                  cellType: def,
                  state: {},
                  supplies: localSupplies,
                  resources: currentResources,
                  resourceCaps,
                  manifest,
                },
                def.behavior.params
              ) ?? null)
            : {
                text: t('build.missing', {
                  list: afford.missing
                    .map((m) => `${m.resourceName} ${m.have}/${m.need}`)
                    .join(', '),
                }),
                tone: 'danger' as const,
              };

          return (
            <button
              key={def.id}
              type="button"
              disabled={!afford.ok}
              onClick={() => afford.ok && onSelect(def.id)}
              onMouseEnter={() => onHoverOption(def.id)}
              onMouseLeave={() => onHoverOption(null)}
              onFocus={() => onHoverOption(def.id)}
              onBlur={() => onHoverOption(null)}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-start gap-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                afford.ok
                  ? 'hover:bg-[#17202B] focus-visible:bg-[#17202B] cursor-pointer'
                  : 'opacity-55 cursor-not-allowed'
              }`}
            >
              <span
                className="w-3 h-3 mt-0.5 rounded-[3px] shrink-0 border border-white/15"
                style={{ backgroundColor: def.visual.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-[#E6EDF3] leading-tight">
                  {def.name}
                </span>
                <span className="block font-mono tabular-nums text-[11px] text-[#8B98A9] mt-0.5 leading-snug">
                  {formatCostSummary(def)}
                </span>
                {preview && (
                  <span
                    className={`block text-[11px] mt-0.5 leading-snug ${
                      TONE_CLASS[preview.tone]
                    }`}
                  >
                    {preview.text}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </CellPopover>
  );
}
