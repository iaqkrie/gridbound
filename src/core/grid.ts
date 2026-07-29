export function getIndex (x: number, y: number, width: number): number {
    return y * width + x;
}

export function getCoords (index: number, width: number): { x: number; y: number } {
    return {
        x: index % width,
        y: Math.floor(index / width)
    };
}

export function isValidCoord (x: number, y: number, width: number, height: number): boolean {
    return x >= 0 && x < width && y >= 0 && y < height;
}
