import { RulesetModuleMap } from '../types';
import {
  consumerBehavior,
  producerBehavior,
  storageBehavior,
} from './behaviors';
import { clustersWorldGenerator } from './generators';
import { StorageCellPanel, WorkerCellPanel } from './panels';

export const BUILTIN_MODULES: RulesetModuleMap = {
  generators: {
    'builtin:clusters': clustersWorldGenerator,
  },
  behaviors: {
    'builtin:producer': producerBehavior,
    'builtin:consumer': consumerBehavior,
    'builtin:storage': storageBehavior,
  },
  panels: {
    'builtin:workerPanel': WorkerCellPanel,
    'builtin:storagePanel': StorageCellPanel,
  },
};
