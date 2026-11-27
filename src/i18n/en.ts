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
  'menu.importJson': 'Import JSON',
  'menu.deleteRuleset': 'Remove {name}',
  'menu.importErrorTitle': 'Invalid ruleset JSON',
  'menu.mapSize': 'Map Size',
  'menu.seed': 'Seed',
  'menu.seedPlaceholder': 'Random',
  'menu.randomizeSeed': 'Randomize seed',
  'menu.startGame': 'Start Game',
  'menu.saves': 'Saves',
  'menu.noSaves': 'No saves yet',
  'menu.continue': 'Continue',
  'menu.rulesetMissing': 'Ruleset missing',
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

  // Interface Blocks (Options & Exit Previews)
  'build.missing': 'Need: {list}',
  'demolish.reclaimWarning': '{count} {key} will be unassigned',
  'demolish.capOverflowWarning': '{excess} {resource} will be lost',

  // Engine Core Fallbacks
  'core.outOfBounds': 'Out of bounds',
  'core.unknownCell': 'Unknown cell type',
  'core.insufficient': 'Missing: {list}',
  'core.transitionTo': 'Becomes {name}',

  // Declarative Inspection & Previews
  'inspect.needSupply': 'No {name}',
  'inspect.needResource': 'No {name}',
  'inspect.needState': 'Needs {key}',
  'inspect.inactive': 'Inactive',
  'inspect.selectResource': 'Select resource',
  'inspect.capBonusPreview': '+{amount} max cap',

  // Declarative Panel Fallbacks
  'panel.assign': 'Assign',
  'panel.remove': 'Remove',
  'panel.noneAvailable': 'None available',
} as const;

export type TranslationKey = keyof typeof en;
export type TranslationDict = Record<TranslationKey, string>;
