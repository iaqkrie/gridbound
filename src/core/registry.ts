import type { CellDefinition } from "./types";

export class Registry {
    private definitions = new Map<string, CellDefinition<any>>();

    register (definition: CellDefinition<any>): void {
        this.definitions.set(definition.id, definition);
    }

    get (id: string): CellDefinition<any> | undefined {
        return this.definitions.get(id);
    }
}
