import { t } from '../../../i18n';
import {
  CellBehaviorModule,
  CellStateData,
  CellTypeId,
  ResourceId,
  SupplyId,
} from '../types';

function getResourceName(
  resources: readonly { id: string; name: string }[],
  id: string
): string {
  return resources.find((r) => r.id === id)?.name ?? id;
}

function getSupplyName(
  supplies: readonly { id: string; name: string }[],
  id: string
): string {
  return supplies.find((s) => s.id === id)?.name ?? id;
}

// ============================================================================
// 1. builtin:producer — Configurable resource producer (optional supply & worker)
// ============================================================================

export interface ProducerBehaviorParams {
  outputResourceId: ResourceId;
  outputAmount: number;
  requiredSupplyId?: SupplyId;
  requiredSupplyAmount?: number;
  workerResourceId?: ResourceId;
  workerStateKey?: string;
  idleWarningCycles?: number;
}

export const producerBehavior: CellBehaviorModule<ProducerBehaviorParams> = {
  createInitialState: (params): CellStateData => {
    const key = params.workerStateKey ?? 'worker';
    return params.workerResourceId ? { [key]: 0, idleCycles: 0 } : {};
  },

  isActive: (ctx, params) => {
    const reqAmt = params.requiredSupplyAmount ?? 1;
    const hasSupply =
      !params.requiredSupplyId ||
      (ctx.supplies[params.requiredSupplyId] ?? 0) >= reqAmt;
    const key = params.workerStateKey ?? 'worker';
    const hasWorker =
      !params.workerResourceId || Number(ctx.state[key] ?? 0) >= 1;
    return hasSupply && hasWorker;
  },

  onCycle: (ctx, params) => {
    const reqAmt = params.requiredSupplyAmount ?? 1;
    const hasSupply =
      !params.requiredSupplyId ||
      (ctx.supplies[params.requiredSupplyId] ?? 0) >= reqAmt;

    const key = params.workerStateKey ?? 'worker';
    const usesWorker = Boolean(params.workerResourceId);
    const worker = usesWorker ? Number(ctx.state[key] ?? 0) : 1;
    const hasWorker = !usesWorker || worker >= 1;
    const active = hasSupply && hasWorker;

    const nextIdle = hasWorker ? 0 : Number(ctx.state.idleCycles ?? 0) + 1;
    const warnAt = params.idleWarningCycles ?? 2;

    const notification =
      usesWorker && !hasWorker && nextIdle >= warnAt
        ? {
            severity: 'warning' as const,
            title: t('behavior.idleTitle', { name: ctx.cellType.name }),
            message: t('behavior.idleMessage', { cycles: nextIdle }),
          }
        : null;

    return {
      nextTypeId: ctx.cellType.id,
      nextState: usesWorker ? { [key]: worker, idleCycles: nextIdle } : undefined,
      producedResources: active
        ? { [params.outputResourceId]: params.outputAmount }
        : undefined,
      canEmit: active,
      notification,
    };
  },

  onDemolish: (ctx, params) => {
    if (!params.workerResourceId) return;
    const key = params.workerStateKey ?? 'worker';
    const assigned = Number(ctx.state[key] ?? 0);
    if (assigned > 0) {
      ctx.world.addResource(params.workerResourceId, assigned);
    }
  },

  getStatusBadge: (ctx, params) => {
    if (!params.workerResourceId) return null;
    const key = params.workerStateKey ?? 'worker';
    const worker = Number(ctx.state[key] ?? 0);
    return {
      text: t('behavior.workerBadge', { count: worker }),
      tone: worker >= 1 ? 'positive' : 'warning',
    };
  },

  getBuildPreview: (ctx, params) => {
    const outName = getResourceName(
      ctx.manifest.resources,
      params.outputResourceId
    );
    if (params.requiredSupplyId) {
      const reqAmt = params.requiredSupplyAmount ?? 1;
      const supName = getSupplyName(
        ctx.manifest.supplies,
        params.requiredSupplyId
      );
      const hasSupply = (ctx.supplies[params.requiredSupplyId] ?? 0) >= reqAmt;
      if (!hasSupply) {
        return {
          text: t('behavior.noSupply', { supply: supName }),
          tone: 'danger',
        };
      }
      return {
        text: t('behavior.supplyReady', {
          supply: supName,
          amount: params.outputAmount,
          resource: outName,
        }),
        tone: 'positive',
      };
    }

    return {
      text: t('behavior.outputPerCycle', {
        amount: params.outputAmount,
        resource: outName,
      }),
      tone: 'positive',
    };
  },

  explainCycle: (ctx, params) => {
    const key = params.workerStateKey ?? 'worker';
    const outName = getResourceName(
      ctx.manifest.resources,
      params.outputResourceId
    );
    if (params.workerResourceId && Number(ctx.state[key] ?? 0) < 1) {
      return {
        nextTypeId: ctx.cellType.id,
        label: t('behavior.noWorker'),
        tone: 'danger',
      };
    }
    if (params.requiredSupplyId) {
      const reqAmt = params.requiredSupplyAmount ?? 1;
      const supName = getSupplyName(
        ctx.manifest.supplies,
        params.requiredSupplyId
      );
      if ((ctx.supplies[params.requiredSupplyId] ?? 0) < reqAmt) {
        return {
          nextTypeId: ctx.cellType.id,
          label: t('behavior.noSupplyCycle', { supply: supName }),
          tone: 'danger',
        };
      }
    }
    return {
      nextTypeId: ctx.cellType.id,
      label: t('behavior.outputPerCycle', {
        amount: params.outputAmount,
        resource: outName,
      }),
      tone: 'positive',
    };
  },

  getDemolishInfo: (ctx, params) => {
    if (!params.workerResourceId) return {};
    const key = params.workerStateKey ?? 'worker';
    const assigned = Number(ctx.state[key] ?? 0);
    if (assigned <= 0) return {};
    return {
      lines: [
        {
          label: t('behavior.workerFreed'),
          value: `+${assigned}`,
          tone: 'positive',
        },
      ],
    };
  },
};

// ============================================================================
// 2. builtin:consumer — Consumes global resource with starvation grace period
// ============================================================================

export interface ConsumerBehaviorParams {
  consumeResourceId: ResourceId;
  consumeAmount: number;
  incomeResourceId?: ResourceId;
  incomeAmount?: number;
  maxStarveCycles: number;
  starveToCellTypeId: CellTypeId;
  reclaimResourceId?: ResourceId;
  reclaimAmount?: number;
  reclaimStateKey?: string;
}

function handleResourceReclaim(
  world: Parameters<NonNullable<CellBehaviorModule['onDemolish']>>[0]['world'],
  params: ConsumerBehaviorParams
): void {
  if (!params.reclaimResourceId) return;
  const amount = params.reclaimAmount ?? 1;
  const stateKey = params.reclaimStateKey ?? 'worker';

  for (let n = 0; n < amount; n++) {
    if (world.getResource(params.reclaimResourceId) >= 1) {
      world.consumeResource(params.reclaimResourceId, 1);
    } else {
      const occupied = world.findCells(
        (c) => Number(c.state[stateKey] ?? 0) >= 1
      );
      const target = occupied[occupied.length - 1];
      if (target) {
        const cur = Number(target.state[stateKey] ?? 0);
        world.patchCellState(target.x, target.y, {
          [stateKey]: Math.max(0, cur - 1),
        });
      }
    }
  }
}

export const consumerBehavior: CellBehaviorModule<ConsumerBehaviorParams> = {
  createInitialState: () => ({ hunger: 0 }),

  getConsumePriority: (state) => Number(state.hunger ?? 0),

  onCycle: (ctx, params) => {
    const avail = ctx.resources[params.consumeResourceId] ?? 0;
    const hunger = Number(ctx.state.hunger ?? 0);

    if (avail >= params.consumeAmount) {
      return {
        nextTypeId: ctx.cellType.id,
        nextState: { hunger: 0 },
        consumedResources: { [params.consumeResourceId]: params.consumeAmount },
        producedResources:
          params.incomeResourceId && params.incomeAmount
            ? { [params.incomeResourceId]: params.incomeAmount }
            : undefined,
        notification: null,
      };
    }

    if (hunger >= params.maxStarveCycles) {
      return {
        nextTypeId: params.starveToCellTypeId,
        notification: null,
      };
    }

    const nextHunger = hunger + 1;
    const resName = getResourceName(
      ctx.manifest.resources,
      params.consumeResourceId
    );
    const notification =
      nextHunger >= params.maxStarveCycles
        ? {
            severity: 'danger' as const,
            title: t('behavior.starveTitle', {
              current: nextHunger,
              max: params.maxStarveCycles,
            }),
            message: t('behavior.starveMessage', { resource: resName }),
          }
        : null;

    return {
      nextTypeId: ctx.cellType.id,
      nextState: { hunger: nextHunger },
      notification,
    };
  },

  onDemolish: (ctx, params) => {
    handleResourceReclaim(ctx.world, params);
  },

  onTickLost: (ctx, params) => {
    handleResourceReclaim(ctx.world, params);
  },

  getStatusBadge: (ctx, params) => {
    const hunger = Number(ctx.state.hunger ?? 0);
    if (hunger <= 0) return null;
    return {
      text: t('behavior.hungerBadge', {
        current: hunger,
        max: params.maxStarveCycles,
      }),
      tone: hunger >= params.maxStarveCycles ? 'danger' : 'warning',
    };
  },

  getBuildPreview: (ctx, params) => {
    const resName = getResourceName(
      ctx.manifest.resources,
      params.consumeResourceId
    );
    const have = ctx.resources[params.consumeResourceId] ?? 0;
    const incomeStr =
      params.incomeResourceId && params.incomeAmount
        ? ` · +${params.incomeAmount} ${getResourceName(ctx.manifest.resources, params.incomeResourceId)}`
        : '';

    if (have >= params.consumeAmount) {
      return {
        text: t('behavior.stockAvailable', {
          consume: params.consumeAmount,
          resource: resName,
          income: incomeStr,
        }),
        tone: 'positive',
      };
    }
    return {
      text: t('behavior.stockEmpty', { resource: resName }),
      tone: 'warning',
    };
  },

  explainCycle: (ctx, params) => {
    const avail = ctx.resources[params.consumeResourceId] ?? 0;
    const hunger = Number(ctx.state.hunger ?? 0);
    const resName = getResourceName(
      ctx.manifest.resources,
      params.consumeResourceId
    );

    if (avail >= params.consumeAmount) {
      const incomeStr =
        params.incomeResourceId && params.incomeAmount
          ? ` · +${params.incomeAmount} ${getResourceName(ctx.manifest.resources, params.incomeResourceId)}`
          : '';
      return {
        nextTypeId: ctx.cellType.id,
        label: t('behavior.stockAvailable', {
          consume: params.consumeAmount,
          resource: resName,
          income: incomeStr,
        }),
        tone: 'positive',
      };
    }
    if (hunger >= params.maxStarveCycles) {
      return {
        nextTypeId: params.starveToCellTypeId,
        label: t('behavior.willCollapse'),
        tone: 'danger',
      };
    }
    return {
      nextTypeId: ctx.cellType.id,
      label: t('behavior.hungerProgress', {
        resource: resName,
        current: hunger,
        next: hunger + 1,
        max: params.maxStarveCycles,
      }),
      tone: 'danger',
    };
  },

  getDemolishInfo: (ctx, params) => {
    if (!params.reclaimResourceId) return {};
    const amount = params.reclaimAmount ?? 1;
    const resName = getResourceName(
      ctx.manifest.resources,
      params.reclaimResourceId
    );
    const free = ctx.resources[params.reclaimResourceId] ?? 0;
    const warnings = free < amount ? [t('behavior.reclaimWarning')] : [];

    return {
      lines: [{ label: resName, value: `−${amount}`, tone: 'danger' }],
      warnings,
    };
  },
};

// ============================================================================
// 3. builtin:storage — Expands max capacity of one chosen capped resource
// ============================================================================

export interface StorageBehaviorParams {
  bonusAmount: number;
  resourceTag?: string;
  stateKey?: string;
}

export const storageBehavior: CellBehaviorModule<StorageBehaviorParams> = {
  createInitialState: (params) => ({
    [params.stateKey ?? 'storageResource']: '',
  }),

  getCapBonus: (state, params) => {
    const key = params.stateKey ?? 'storageResource';
    const resId = String(state[key] ?? '');
    if (!resId) return null;
    return { [resId]: params.bonusAmount };
  },

  isActive: (ctx, params) => {
    const key = params.stateKey ?? 'storageResource';
    return String(ctx.state[key] ?? '').length > 0;
  },

  onCycle: (ctx, params) => {
    const key = params.stateKey ?? 'storageResource';
    return {
      nextTypeId: ctx.cellType.id,
      nextState: { [key]: String(ctx.state[key] ?? '') },
    };
  },

  getStatusBadge: (ctx, params) => {
    const key = params.stateKey ?? 'storageResource';
    const resId = String(ctx.state[key] ?? '');
    if (!resId) return { text: t('behavior.storageNone'), tone: 'warning' };
    const name = getResourceName(ctx.manifest.resources, resId);
    return { text: `${name} +${params.bonusAmount}`, tone: 'positive' };
  },

  getBuildPreview: (_ctx, params) => ({
    text: t('behavior.storageCapPreview', { amount: params.bonusAmount }),
    tone: 'positive',
  }),

  explainCycle: (ctx, params) => {
    const key = params.stateKey ?? 'storageResource';
    const resId = String(ctx.state[key] ?? '');
    if (!resId) {
      return {
        nextTypeId: ctx.cellType.id,
        label: t('behavior.storageSelect'),
        tone: 'warning',
      };
    }
    const name = getResourceName(ctx.manifest.resources, resId);
    return {
      nextTypeId: ctx.cellType.id,
      label: t('behavior.storageActive', {
        amount: params.bonusAmount,
        resource: name,
      }),
      tone: 'positive',
    };
  },

  getDemolishInfo: (ctx, params) => {
    const key = params.stateKey ?? 'storageResource';
    const resId = String(ctx.state[key] ?? '');
    if (!resId) return {};
    const curCap = ctx.resourceCaps[resId];
    if (curCap === null || curCap === undefined) return {};
    const nextCap = curCap - params.bonusAmount;
    const curVal = ctx.resources[resId] ?? 0;
    if (curVal <= nextCap) return {};

    const name = getResourceName(ctx.manifest.resources, resId);
    return {
      warnings: [
        t('behavior.storageOverflowWarning', {
          excess: curVal - nextCap,
          resource: name,
        }),
      ],
    };
  },
};
