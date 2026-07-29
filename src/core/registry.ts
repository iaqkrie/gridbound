import type { CellDefinition, ResourceDefinition } from "./types";

export class Registry {
    private cells = new Map<string, CellDefinition<any>>();
    private resources = new Map<string, ResourceDefinition>();

    registerCell (definition: CellDefinition<any>): void {
        this.cells.set(definition.id, definition);
    }

    getCell(id: string): CellDefinition<any> | undefined {
        return this.cells.get(id);
    }

    registerResource (definition: ResourceDefinition): void {
        this.resources.set(definition.id, definition);
    }

    getResource (id: string) {
        return this.resources.get(id);
    }
}
