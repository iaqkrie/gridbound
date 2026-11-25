export const en = {
  // Common
  'common.menu': 'Menu',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.cycle': 'Cycle',
  'common.nextCycle': 'Next Cycle',
  'common.on': 'ON',

  // Main Menu
  'menu.newGame': 'New Game',
  'menu.saveName': 'Save Name',
  'menu.ruleset': 'Ruleset',
  'menu.mapSize': 'Map Size',
  'menu.seed': 'Seed',
  'menu.seedPlaceholder': 'Random',
  'menu.randomizeSeed': 'Randomize seed',
  'menu.startGame': 'Start Game',
  'menu.saves': 'Saves',
  'menu.noSaves': 'No saves yet',
  'menu.continue': 'Continue',
  'menu.deleteSave': 'Delete save {name}',
  'menu.defaultSaveName': 'Colony #{n}',

  // Exit Modal
  'exit.title': 'Return to Menu',
  'exit.meta': '{name} · Cycle {cycle}',
  'exit.saveAndExit': 'Save & Exit',
  'exit.withoutSaving': 'Exit Without Saving',

  // Top Bar & HUD
  'hud.layers': 'Layers',
  'hud.layerHeatmap': 'Map',
  'hud.layerNumbers': 'Values',
  'hud.mute': 'Mute sound',
  'hud.unmute': 'Enable sound',
  'hud.zoomIn': 'Zoom in',
  'hud.zoomOut': 'Zoom out',
  'hud.resetCamera': 'Reset camera',
  'hud.notifications': 'Notifications',
  'hud.dismissNotification': 'Dismiss',
  'hud.moreNotifications': '+{count} more',
  'hud.cycleBreakdown': '+{gained} / −{consumed} per cycle',

  // Build & Demolish
  'build.title': 'Build',
  'build.missing': 'Need: {list}',
  'demolish.title': 'Demolish {name}?',
  'demolish.confirm': 'Demolish',
  'demolish.aria': 'Demolish {name}',

  // Engine Core Fallbacks
  'core.outOfBounds': 'Out of bounds',
  'core.unknownCell': 'Unknown cell type',
  'core.insufficient': 'Missing: {list}',
  'core.transitionTo': 'Becomes {name}',

  // Builtin Behaviors
  'behavior.idleTitle': '{name} idle',
  'behavior.idleMessage': 'No worker for {cycles} cycles',
  'behavior.workerBadge': 'W {count}/1',
  'behavior.noSupply': 'No {supply}',
  'behavior.supplyReady': '{supply} OK · +{amount} {resource}/cycle',
  'behavior.outputPerCycle': '+{amount} {resource}/cycle',
  'behavior.noWorker': 'No worker',
  'behavior.noSupplyCycle': 'No {supply}',
  'behavior.workerFreed': 'Worker freed',
  'behavior.starveTitle': 'Starving ({current}/{max})',
  'behavior.starveMessage': 'No {resource} — collapses next cycle',
  'behavior.hungerBadge': 'Hunger {current}/{max}',
  'behavior.stockAvailable': '−{consume} {resource}{income}',
  'behavior.stockEmpty': 'No {resource}',
  'behavior.willCollapse': 'Collapses next cycle',
  'behavior.hungerProgress': 'No {resource} ({current}→{next}/{max})',
  'behavior.reclaimWarning': '1 worker will be unassigned',
  'behavior.storageNone': 'Unset',
  'behavior.storageCapPreview': '+{amount} max cap',
  'behavior.storageSelect': 'Select resource',
  'behavior.storageActive': '+{amount} {resource} cap',
  'behavior.storageOverflowWarning': '{excess} {resource} will be lost',

  // Builtin Panels
  'panel.worker': 'Worker',
  'panel.workerAssigned': '1 / 1',
  'panel.workerUnassigned': '0 / 1',
  'panel.output': 'Output',
  'panel.idle': 'Idle',
  'panel.idleCycles': '{count} c.',
  'panel.assignWorker': 'Assign Worker ({free} free)',
  'panel.noFreeWorkers': 'No free workers',
  'panel.removeWorker': 'Remove Worker',
  'panel.storageCapBonus': 'Cap Bonus',
} as const;

export type TranslationKey = keyof typeof en;
export type TranslationDict = Record<TranslationKey, string>;
