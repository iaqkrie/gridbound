export type IconCategory = 'Terrain' | 'Industry' | 'Civic' | 'Special';

export type CellIcon =
  // Terrain
  | 'empty'
  | 'solid'
  | 'water'
  | 'forest'
  | 'mountain'
  | 'sand'
  | 'lava'
  | 'swamp'
  | 'crystal'
  // Industry & Energy
  | 'farm'
  | 'sawmill'
  | 'quarry'
  | 'factory'
  | 'mine'
  | 'power'
  | 'windmill'
  | 'pipe'
  | 'solar'
  // Civic & Logistics
  | 'house'
  | 'warehouse'
  | 'road'
  | 'bridge'
  | 'tower'
  | 'market'
  | 'lab'
  | 'hospital'
  // Special & Hazards
  | 'fire'
  | 'biohazard'
  | 'shield'
  | 'sword'
  | 'star'
  | 'flag'
  | 'portal'
  | 'gear';

export interface IconDefinition {
  id: CellIcon;
  label: string;
  category: IconCategory;
  /** SVG path in a 24x24 viewBox (empty string for 'empty') */
  path: string;
  /** Optional filled polygon/rect inside 24x24 viewBox */
  fillPath?: string;
  /** Default full-tile fill style (used for terrain unless overridden by visual.fullTile) */
  defaultFullTile?: boolean;
}

export const ICON_CATEGORIES: readonly IconCategory[] = [
  'Terrain',
  'Industry',
  'Civic',
  'Special',
];

export const ICON_REGISTRY: readonly IconDefinition[] = [
  // Terrain
  {
    id: 'empty',
    label: 'Empty',
    category: 'Terrain',
    path: '',
  },
  {
    id: 'solid',
    label: 'Block',
    category: 'Terrain',
    path: 'M6 6 H18 V18 H6 Z',
    fillPath: 'M7 7 H17 V17 H7 Z',
  },
  {
    id: 'water',
    label: 'Water',
    category: 'Terrain',
    path: 'M3 9 Q7.5 6 12 9 T21 9 M3 15 Q7.5 12 12 15 T21 15',
    defaultFullTile: true,
  },
  {
    id: 'forest',
    label: 'Forest',
    category: 'Terrain',
    path: 'M7 12 L12 4 L17 12 M5 17 L12 9 L19 17 M12 17 V21',
    defaultFullTile: true,
  },
  {
    id: 'mountain',
    label: 'Mountain',
    category: 'Terrain',
    path: 'M3 19 L10 6 L16.5 19 M12.5 13 L16.5 8.5 L21 19',
    defaultFullTile: true,
  },
  {
    id: 'sand',
    label: 'Dunes',
    category: 'Terrain',
    path: 'M3 15 Q9 10 15 15 T21 15 M4 19 H20 M8 9 H10 M15 8 H17',
    defaultFullTile: true,
  },
  {
    id: 'lava',
    label: 'Magma',
    category: 'Terrain',
    path: 'M4 18 Q8 13 12 17 T20 15 M7 11 L10 7 L13 11 L16 6 L18 11',
    defaultFullTile: true,
  },
  {
    id: 'swamp',
    label: 'Marsh',
    category: 'Terrain',
    path: 'M3 17 H21 M8 17 V9 M8 12 L5 9 M15 17 V7 M15 11 L18 8',
    defaultFullTile: true,
  },
  {
    id: 'crystal',
    label: 'Crystal',
    category: 'Terrain',
    path: 'M12 3 L18 10 L15 20 H9 L6 10 Z M12 3 L12 20 M6 10 H18',
  },

  // Industry & Energy
  {
    id: 'farm',
    label: 'Farm',
    category: 'Industry',
    path: 'M5 7 H19 M5 12 H19 M5 17 H19',
  },
  {
    id: 'sawmill',
    label: 'Sawmill',
    category: 'Industry',
    path: 'M12 6 A6 6 0 1 0 12.01 6 Z M4 12 H20 M12 4 V20',
  },
  {
    id: 'quarry',
    label: 'Quarry',
    category: 'Industry',
    path: 'M5 8 H12 V13 H19 M5 16 H15',
  },
  {
    id: 'factory',
    label: 'Factory',
    category: 'Industry',
    path: 'M4 20 V11 L10 14 V11 L16 14 V6 H20 V20 Z',
  },
  {
    id: 'mine',
    label: 'Mine',
    category: 'Industry',
    path: 'M4 19 L17 6 M13 5 L19 11 M6 12 L12 18',
  },
  {
    id: 'power',
    label: 'Power',
    category: 'Industry',
    path: 'M13 3 L5 13 H11 L10 21 L19 11 H13 Z',
  },
  {
    id: 'windmill',
    label: 'Windmill',
    category: 'Industry',
    path: 'M12 11 L12 21 M9 21 H15 M12 11 L6 5 M12 11 L18 5 M12 11 L6 16 M12 11 L18 16',
  },
  {
    id: 'pipe',
    label: 'Conduit',
    category: 'Industry',
    path: 'M3 10 H21 M3 14 H21 M9 7 V17 M15 7 V17',
  },
  {
    id: 'solar',
    label: 'Solar',
    category: 'Industry',
    path: 'M4 7 H20 V17 H4 Z M4 12 H20 M9.5 7 V17 M14.5 7 V17',
  },

  // Civic & Logistics
  {
    id: 'house',
    label: 'House',
    category: 'Civic',
    path: 'M4 12 L12 5 L20 12 M7 12 V19 H17 V12',
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    category: 'Civic',
    path: 'M5 5 H19 V19 H5 Z',
  },
  {
    id: 'road',
    label: 'Road',
    category: 'Civic',
    path: 'M7 3 V21 M17 3 V21 M12 5 V9 M12 15 V19',
  },
  {
    id: 'bridge',
    label: 'Bridge',
    category: 'Civic',
    path: 'M3 10 H21 M5 10 V19 M19 10 V19 M5 17 Q12 11 19 17',
  },
  {
    id: 'tower',
    label: 'Tower',
    category: 'Civic',
    path: 'M7 20 L9 6 H15 L17 20 Z M8 6 V4 H11 V6 M13 6 V4 H16 V6 M9 13 H15',
  },
  {
    id: 'market',
    label: 'Market',
    category: 'Civic',
    path: 'M4 10 L6 5 H18 L20 10 Z M6 10 V19 H18 V10 M10 19 V14 H14 V19',
  },
  {
    id: 'lab',
    label: 'Lab',
    category: 'Civic',
    path: 'M9 4 H15 M10 4 V10 L5 19 H19 L14 10 V4 M8 15 H16',
  },
  {
    id: 'hospital',
    label: 'Medbay',
    category: 'Civic',
    path: 'M9 4 H15 V9 H20 V15 H15 V20 H9 V15 H4 V9 H9 Z',
  },

  // Special & Hazards
  {
    id: 'fire',
    label: 'Fire',
    category: 'Special',
    path: 'M12 3 C15 7 18 10 18 14 A6 6 0 1 1 6 14 C6 11 8 9 9 7 C9 10 11 10 12 3 Z',
  },
  {
    id: 'biohazard',
    label: 'Hazard',
    category: 'Special',
    path: 'M12 10 A2 2 0 1 0 12.01 10 Z M8 7 A5 5 0 0 1 16 7 M6 15 A5 5 0 0 1 9 10 M18 15 A5 5 0 0 0 15 10',
  },
  {
    id: 'shield',
    label: 'Shield',
    category: 'Special',
    path: 'M12 3 L19 6 V12 C19 16.5 16 19.5 12 21 C8 19.5 5 16.5 5 12 V6 Z',
  },
  {
    id: 'sword',
    label: 'Combat',
    category: 'Special',
    path: 'M19 5 L8 16 M19 5 L15 5 L5 15 M7 13 L11 17 M5 19 L8 16',
  },
  {
    id: 'star',
    label: 'Star',
    category: 'Special',
    path: 'M12 3 L14.8 9 L21 9.8 L16.5 14.2 L17.6 20.5 L12 17.5 L6.4 20.5 L7.5 14.2 L3 9.8 L9.2 9 Z',
  },
  {
    id: 'flag',
    label: 'Flag',
    category: 'Special',
    path: 'M6 20 V4 M6 5 H18 L15 9.5 L18 14 H6',
  },
  {
    id: 'portal',
    label: 'Portal',
    category: 'Special',
    path: 'M12 4 A8 8 0 1 0 12.01 4 Z M12 8 A4 4 0 1 0 12.01 8 Z',
  },
  {
    id: 'gear',
    label: 'Gear',
    category: 'Special',
    path: 'M12 8 A4 4 0 1 0 12.01 8 Z M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.6 5.6 L7.8 7.8 M16.2 16.2 L18.4 18.4 M18.4 5.6 L16.2 7.8 M7.8 16.2 L5.6 18.4',
  },
];

const ICON_MAP = new Map<CellIcon, IconDefinition>(
  ICON_REGISTRY.map((def) => [def.id, def])
);

export const CELL_ICONS: readonly CellIcon[] = ICON_REGISTRY.map((d) => d.id);

export function getIconDef(icon?: CellIcon): IconDefinition | undefined {
  if (!icon) return undefined;
  return ICON_MAP.get(icon);
}
