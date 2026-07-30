import { Registry } from "../registry";
import { World } from "../world";
import type { CellDefinition } from "../types";

const emptyCell: CellDefinition<{}> = {
    id: 'core:empty',
    createState: () => ({})
};

interface FarmState {
    wheat: number
}
const farmCell: CellDefinition<FarmState> = {
    id: 'core:farm',
    createState: () => ({ wheat: 0 }),
    onCycle: (ctx) => {
        ctx.state.wheat += 1;
    }
};

const registry = new Registry();
registry.registerCell(emptyCell);
registry.registerCell(farmCell);

const world = new World(2, 2, registry, 'core:empty');

console.log('--- Default state ---');
console.log(world.state.cells);

world.state.cells[0].typeId = 'core:farm';
world.state.cells[0].state = farmCell.createState();

console.log('\n--- Farm builded ---');
console.log(world.state.cells);

world.nextCycle();

console.log('\n--- After 1 cycle ---');
console.log(world.state.cells);

world.nextCycle();
world.nextCycle();

console.log('\n--- After 3 cycle ---');
console.log(world.state.cells);
