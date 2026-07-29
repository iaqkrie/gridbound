import { Registry } from "./registry";
import { getCoords, getIndex, isValidCoord } from "./grid";
import type { GameState, ResourceGrid, CycleContext } from "./types";

export class World {
    public state: GameState;

    private registry: Registry;

    private nextResources: ResourceGrid = new Map();

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

    private getOrCreateResourceLayer (grid: ResourceGrid, resourceId: string): Float32Array {
        if (!grid.has(resourceId)) {
            grid.set(resourceId, new Float32Array(this.state.width * this.state.height));
        }

        return grid.get(resourceId)!;
    }

    nextCycle () {
        this.nextResources.clear();
        for (const [resId, layer] of this.state.resources.entries()) {
            this.nextResources.set(resId, new Float32Array(layer));
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
                    }
                }

                definition.onCycle(context);
            }
        }

        this.state.resources = this.nextResources;
        this.nextResources = new Map();
    }
}
