import { Registry } from "./registry";
import { getCoords, getIndex, isValidCoord } from "./grid";
import type { GameState, ResourceGrid, CycleContext, ClickContext } from "./types";

export class World {
    public state: GameState;

    private registry: Registry;

    private nextResources: ResourceGrid = new Map();
    private pendingTransformations: Map<number, string> = new Map();

    constructor (width: number, height: number, registry: Registry, defaultTypeId: string) {
        this.state = {
            width,
            height,
            cells: [],
            resources: new Map()
        };

        this.registry = registry

        const defaultDef = this.registry.getCell(defaultTypeId);
        if (!defaultDef) {
            throw new Error(`Type "${defaultTypeId}" not found in registry`);
        }

        for (let i = 0; i < width * height; i++) {
            this.state.cells.push({
                typeId: defaultTypeId,
                state: defaultDef.createState()
            });
        }
    }

    nextCycle () {
        this.nextResources.clear();
        for (const [resId, layer] of this.state.resources.entries()) {
            const nextLayer = new Float32Array(layer.length);
            const resDef = this.registry.getResource(resId);
            const decayRule = resDef?.decayRule;

            for (let i = 0; i < layer.length; i++) {
                nextLayer[i] = decayRule ? decayRule(layer[i]) : layer[i];
            }

            this.nextResources.set(resId, nextLayer);
        }

        for (let i = 0; i < this.state.cells.length; i++) {
            const cell = this.state.cells[i];
            const definition = this.registry.getCell(cell.typeId);

            if (definition && definition.onCycle) {
                const context: CycleContext<any> = {
                    state: cell.state,
                    index: i,

                    addResource: (resourceId: string, amount: number) => {
                        const layer = this.getOrCreateResourceLayer(this.nextResources, resourceId)
                        layer[i] += amount;
                    },

                    transformTo: (newTypeId: string) => {
                        this.pendingTransformations.set(i, newTypeId);
                    }
                }

                definition.onCycle(context);
            }
        }

        this.state.resources = this.nextResources;
        this.nextResources = new Map();

        for (const [index, newTypeId] of this.pendingTransformations.entries()) {
            const newDef = this.registry.getCell(newTypeId);
            if (newDef) {
                this.state.cells[index] = {
                    typeId: newTypeId,
                    state: newDef.createState()
                };
            }
        }
    }

    interactCell (index: number) {
        const cell = this.state.cells[index];
        const definition = this.registry.getCell(cell.typeId);

        if (definition && definition.onClick) {
            const context: ClickContext<any> = {
                state: cell.state,
                index: index,

                transformTo: (newTypeId: string) => {
                    const newDef = this.registry.getCell(newTypeId);
                    if (newDef) {
                        this.state.cells[index] = {
                            typeId: newTypeId,
                            state: newDef.createState()
                        }
                    }
                }
            };

            definition.onClick(context);
        }
    }

    private getOrCreateResourceLayer (grid: ResourceGrid, resourceId: string): Float32Array {
        if (!grid.has(resourceId)) {
            grid.set(resourceId, new Float32Array(this.state.width * this.state.height));
        }

        return grid.get(resourceId)!;
    }
}
