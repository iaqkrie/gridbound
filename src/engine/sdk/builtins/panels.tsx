import { Check, UserMinus, UserPlus } from 'lucide-react';
import { t } from '../../../i18n';
import { CellPanelProps, ResourceId, SupplyId } from '../types';

// ============================================================================
// 1. builtin:workerPanel — Generic TSX panel for worker-assignable producers
// ============================================================================

export interface WorkerPanelParams {
  workerResourceId?: ResourceId;
  workerStateKey?: string;
  requiredSupplyId?: SupplyId;
  requiredSupplyAmount?: number;
  outputResourceId?: ResourceId;
  outputAmount?: number;
}

export function WorkerCellPanel({
  x,
  y,
  cellType,
  cellState,
  localSupplies,
  world,
  params,
  onMutated,
}: CellPanelProps<WorkerPanelParams>) {
  const cfg: WorkerPanelParams = {
    ...(cellType.behavior?.params as WorkerPanelParams | undefined),
    ...params,
  };

  const workerResourceId = cfg.workerResourceId ?? '';
  const key = cfg.workerStateKey ?? 'worker';
  const hasWorker = Number(cellState[key] ?? 0) >= 1;
  const idleCycles = Number(cellState.idleCycles ?? 0);
  const freeWorkers = workerResourceId ? world.getResource(workerResourceId) : 0;

  const reqSupplyId = cfg.requiredSupplyId;
  const reqSupplyAmt = cfg.requiredSupplyAmount ?? 1;
  const reqSupplyDef = reqSupplyId
    ? world.manifest.supplies.find((s) => s.id === reqSupplyId)
    : undefined;
  const reqSupplyVal = reqSupplyId ? (localSupplies[reqSupplyId] ?? 0) : 0;
  const hasReqSupply = !reqSupplyId || reqSupplyVal >= reqSupplyAmt;

  const outputResDef = cfg.outputResourceId
    ? world.manifest.resources.find((r) => r.id === cfg.outputResourceId)
    : undefined;
  const isProducing = hasWorker && hasReqSupply;

  const handleAssign = () => {
    if (hasWorker || !workerResourceId) return;
    if (!world.consumeResource(workerResourceId, 1)) return;
    world.patchCellState(x, y, { [key]: 1, idleCycles: 0 });
    world.clearNotificationsAt(x, y);
    onMutated('build');
  };

  const handleUnassign = () => {
    if (!hasWorker || !workerResourceId) return;
    world.patchCellState(x, y, { [key]: 0 });
    world.addResource(workerResourceId, 1);
    onMutated('erase');
  };

  return (
    <div className="p-3.5 space-y-3">
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#8B98A9]">{t('panel.worker')}</span>
          <span
            className={`font-mono tabular-nums font-semibold ${
              hasWorker ? 'text-[#10B981]' : 'text-[#F43F5E]'
            }`}
          >
            {hasWorker
              ? t('panel.workerAssigned')
              : t('panel.workerUnassigned')}
          </span>
        </div>

        {reqSupplyDef && (
          <div className="flex items-center justify-between">
            <span className="text-[#8B98A9]">{reqSupplyDef.name}</span>
            <span
              className="font-mono tabular-nums"
              style={{
                color: hasReqSupply ? reqSupplyDef.color : '#F43F5E',
              }}
            >
              {reqSupplyVal}
            </span>
          </div>
        )}

        {outputResDef && cfg.outputAmount !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-[#8B98A9]">{t('panel.output')}</span>
            <span
              className="font-mono tabular-nums font-semibold"
              style={{ color: isProducing ? outputResDef.color : '#8B98A9' }}
            >
              {isProducing
                ? `+${cfg.outputAmount} ${outputResDef.name}`
                : `0 ${outputResDef.name}`}
            </span>
          </div>
        )}

        {!hasWorker && idleCycles > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[#8B98A9]">{t('panel.idle')}</span>
            <span className="font-mono tabular-nums text-[#F59E0B]">
              {t('panel.idleCycles', { count: idleCycles })}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-[#1F2A38]">
        {hasWorker ? (
          <button
            type="button"
            onClick={handleUnassign}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
          >
            <UserMinus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('panel.removeWorker')}</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={freeWorkers < 1}
            onClick={handleAssign}
            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
              freeWorkers >= 1
                ? 'text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] cursor-pointer'
                : 'text-[#8B98A9] bg-[#0B0F14] border border-[#1F2A38] opacity-60 cursor-not-allowed'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {freeWorkers >= 1
                ? t('panel.assignWorker', { free: freeWorkers })
                : t('panel.noFreeWorkers')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 2. builtin:storagePanel — Generic TSX panel for selecting stored resource
// ============================================================================

export interface StoragePanelParams {
  bonusAmount?: number;
  resourceTag?: string;
  stateKey?: string;
}

export function StorageCellPanel({
  x,
  y,
  cellType,
  cellState,
  world,
  params,
  onMutated,
}: CellPanelProps<StoragePanelParams>) {
  const cfg: StoragePanelParams = {
    ...(cellType.behavior?.params as StoragePanelParams | undefined),
    ...params,
  };

  const bonusAmount = cfg.bonusAmount ?? 0;
  const key = cfg.stateKey ?? 'storageResource';
  const selectedId = String(cellState[key] ?? '');
  const resources = world.getResources();
  const caps = world.getResourceCaps();

  const eligible = world.manifest.resources.filter(
    (r) =>
      r.kind === 'capped' &&
      (!cfg.resourceTag || (r.tags ?? []).includes(cfg.resourceTag))
  );

  const handleSelect = (resId: ResourceId) => {
    world.patchCellState(x, y, { [key]: resId });
    world.reconcileResourceCaps();
    onMutated('click');
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between text-[11px] text-[#8B98A9]">
        <span>{t('panel.storageCapBonus')}</span>
        <span className="font-mono tabular-nums font-semibold text-[#E6EDF3]">
          +{bonusAmount}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {eligible.map((res) => {
          const active = selectedId === res.id;
          const currentVal = resources[res.id] ?? 0;
          const maxVal =
            caps[res.id] ?? (res.kind === 'capped' ? res.initialMax : 0);

          return (
            <button
              key={res.id}
              type="button"
              onClick={() => handleSelect(res.id)}
              aria-pressed={active}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md border text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
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
                  {currentVal}/{maxVal}
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
