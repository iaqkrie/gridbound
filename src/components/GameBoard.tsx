import styles from './styles/GameBoard.module.css'

import { onMount, createEffect } from 'solid-js'
import { state } from '../store'

const TILE_SIZE = 64;

export default function GameBoard () {
    let canvasRef!: HTMLCanvasElement;

    const drawWorld = () => {
        const ctx = canvasRef.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = 'grey'
        ctx.fillRect(0, 0, canvasRef.width, canvasRef.height)
        ctx.fillStyle = 'red';
        ctx.fillRect(100, 100, 300, 300);
    }

    onMount(() => {
        canvasRef.width = canvasRef.clientWidth;
        canvasRef.height = canvasRef.clientHeight;

        drawWorld();
    })

    return (
        <canvas class={styles.gameCanvas} ref={canvasRef}/>
    )
}
