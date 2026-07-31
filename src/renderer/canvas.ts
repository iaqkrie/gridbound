import { getCoords } from "../core/grid";
import type { GameState } from "../core/types";

const typeColors: Record<string, string> = {
    "core:empty": "#525252",
    "core:water": "#2980b9",
    "core:wall": "#cb8f18"
}

export function renderWorld (
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cellSize: number
) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let i = 0; i < state.cells.length; i++) {
        const cell = state.cells[i];
        const coords = getCoords(i, state.width);

        const color = typeColors[cell.typeId] || "#ff00ff";

        ctx.fillStyle = color;

        ctx.fillRect(
            coords.x * cellSize,
            coords.y * cellSize,
            cellSize - 1,
            cellSize - 1
        );
    }
}
