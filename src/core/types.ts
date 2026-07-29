export type CellState = Record<string, any>;

export interface Cell {
    typeId: string;
    state: CellState;
}

export type ResourceGrid = Map<string, Float32Array>;

export interface GameState {
    width: number;
    height: number;
    cells: Cell[];
    resources: ResourceGrid;
}

export interface ResourceDefinition {
    id: string;

    decayRule?: (currentAmount: number) => number;
}

export interface CycleContext<TState extends CellState = CellState> {
    state: TState;
    index: number;

    addResource: (resourceId: string, amount: number) => void;

    transformTo: (newTypeId: string) => void;
}

export interface CellDefinition<TState extends CellState = CellState> {
    id: string;
    createState: () => TState;
    onCycle?: (ctx: CycleContext<TState>) => void;
}
