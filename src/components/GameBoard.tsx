import styles from './styles/GameBoard.module.css'

import { Registry } from '../core/registry';
import { World } from '../core/world';
import { createEffect, createSignal } from 'solid-js'
import { renderWorld } from '../renderer/canvas';
import { getIndex } from '../core/grid';

const registry = new Registry();

registry.registerCell({
    id: "core:empty",
    createState: () => ({}),
    onCycle: (ctx) => {
        if (Math.random() > 0.5)
            ctx.transformTo("core:water");
    },
    onClick: (ctx) => {
        ctx.transformTo("core:wall");
    }
});
registry.registerCell({
    id: "core:water",
    createState: () => ({}),
    onCycle: (ctx) => {
        if (Math.random() > 0.5)
            ctx.transformTo("core:empty");
    }
});
registry.registerCell({
    id: "core:wall",
    createState: () => ({}),
    onClick: (ctx) => {
        ctx.transformTo("core:empty");
    }
})

export default function GameBoard () {
    let canvasRef!: HTMLCanvasElement;

    const CELL_SIZE = 32;
    const WIDTH = 12;
    const HEIGHT = 12;

    const world = new World(WIDTH, HEIGHT, registry, "core:empty");

    const [cycleTick, setCycleTick] = createSignal(0);

    const handleNextCycle = () => {
        world.nextCycle();
        setCycleTick((c) => c + 1);
    }

    const handleCanvasClick = (e: MouseEvent) => {
        if (!canvasRef) return;

        const rect = canvasRef.getBoundingClientRect();

        const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
        const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

        if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            const index = getIndex(x, y, WIDTH);
            
            world.interactCell(index);
            setCycleTick((c) => c + 1);
        }
    }

    createEffect(() => {
        cycleTick();

        if (canvasRef) {
            const ctx = canvasRef.getContext("2d");
            if (ctx) {
                renderWorld(ctx, world.state, CELL_SIZE);
            }
        }
    })

    return (
        <div>
            <canvas
                class={styles.gameCanvas}
                ref={canvasRef}
                width={WIDTH * CELL_SIZE}
                height={HEIGHT * CELL_SIZE}
                onclick={handleCanvasClick}
            />
            <button onClick={handleNextCycle}>Next</button>
        </div>
    )
}
