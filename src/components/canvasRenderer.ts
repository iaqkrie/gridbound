import { SimulationCore } from '../engine/SimulationCore';
import {
  CellTypeId,
  GridCoordinate,
  ResolvedVisualIndicator,
  ResolvedVisualState,
  SupplyId,
  SupplyManifest,
  SupplyOverlayMode,
  getIconDef,
} from '../engine/sdk';

export const BASE_CELL_SIZE = 28;

export interface CameraState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface GridRenderParams {
  ctx: CanvasRenderingContext2D;
  viewportWidth: number;
  viewportHeight: number;
  dpr: number;
  camera: CameraState;
  core: SimulationCore;
  overlayMode: SupplyOverlayMode;
  activeSupplyId: SupplyId | null;
  selectedCell: GridCoordinate | null;
  highlightedCell: GridCoordinate | null;
  hoveredCell: GridCoordinate | null;
  previewCellTypeId: CellTypeId | null;
}

interface VisibleBounds {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

function drawSupplyHeatmap(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  supplyBuf: Int16Array,
  supplyDef: SupplyManifest,
  bounds: VisibleBounds,
  offsetX: number,
  offsetY: number,
  cellSize: number
): void {
  const maxExp = Math.max(1, supplyDef.maxExpected);
  for (let y = bounds.startY; y <= bounds.endY; y++) {
    const row = y * core.width;
    const py = offsetY + y * cellSize;
    for (let x = bounds.startX; x <= bounds.endX; x++) {
      const val = supplyBuf[row + x];
      if (val <= 0) continue;
      const intensity = Math.min(1, val / maxExp);
      const alpha = 0.1 + intensity * 0.28;
      ctx.fillStyle = hexToRgba(supplyDef.color, alpha);
      ctx.fillRect(offsetX + x * cellSize, py, cellSize, cellSize);
    }
  }
}

function drawGridHairlines(
  ctx: CanvasRenderingContext2D,
  bounds: VisibleBounds,
  offsetX: number,
  offsetY: number,
  cellSize: number
): void {
  if (cellSize < 7) return;
  ctx.strokeStyle = '#17202B';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = bounds.startX; x <= bounds.endX + 1; x++) {
    const px = Math.round(offsetX + x * cellSize) + 0.5;
    ctx.moveTo(px, offsetY + bounds.startY * cellSize);
    ctx.lineTo(px, offsetY + (bounds.endY + 1) * cellSize);
  }
  for (let y = bounds.startY; y <= bounds.endY + 1; y++) {
    const py = Math.round(offsetY + y * cellSize) + 0.5;
    ctx.moveTo(offsetX + bounds.startX * cellSize, py);
    ctx.lineTo(offsetX + (bounds.endX + 1) * cellSize, py);
  }
  ctx.stroke();
}

function drawCellFrame(
  ctx: CanvasRenderingContext2D,
  visual: ResolvedVisualState,
  px: number,
  py: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number,
  fullTileFill = false
): void {
  const color = visual.color;
  const active = !visual.dim;

  if (fullTileFill) {
    ctx.fillStyle = hexToRgba(color, active ? 0.3 : 0.12);
    ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
  } else {
    ctx.fillStyle = hexToRgba(color, active ? 0.24 : 0.1);
    ctx.fillRect(innerX, innerY, innerSize, innerSize);
  }

  ctx.strokeStyle = active ? color : hexToRgba(color, 0.55);
  ctx.lineWidth = Math.max(1, cellSize * (fullTileFill ? 0.042 : 0.058));
  if (visual.border === 'dashed') {
    ctx.setLineDash([3, 2]);
  }
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);
  ctx.setLineDash([]);
}

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  color: string,
  active: boolean,
  px: number,
  py: number,
  cellSize: number,
  innerSize: number
): void {
  if (cellSize < 12) return;
  const text = glyph.trim().slice(0, 2);
  if (!text) return;
  const fontSize = Math.max(
    9,
    Math.round(innerSize * (text.length > 1 ? 0.44 : 0.56))
  );
  ctx.save();
  ctx.font = `700 ${fontSize}px "JetBrains Mono", "Manrope", sans-serif`;
  ctx.fillStyle = active ? lightenHex(color, 0.35) : hexToRgba(color, 0.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, px + cellSize / 2, py + cellSize / 2 + 0.5);
  ctx.restore();
}

function drawSvgPath24(
  ctx: CanvasRenderingContext2D,
  pathData: string,
  fillPathData: string | undefined,
  strokeColor: string,
  fillColor: string | undefined,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  const scale = (innerSize * 0.78) / 24;
  ctx.save();
  ctx.translate(innerX + innerSize * 0.11, innerY + innerSize * 0.11);
  ctx.scale(scale, scale);
  if (fillPathData && fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill(new Path2D(fillPathData));
  }
  if (pathData) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.85;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(pathData));
  }
  ctx.restore();
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  visual: ResolvedVisualState,
  px: number,
  py: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  const active = !visual.dim;
  const color = visual.color;
  const iconDef = getIconDef(visual.icon);
  const fullTileFill = visual.fullTile ?? Boolean(iconDef?.defaultFullTile);

  drawCellFrame(
    ctx,
    visual,
    px,
    py,
    cellSize,
    innerX,
    innerY,
    innerSize,
    fullTileFill
  );

  // 1. Explicit text glyph takes priority when set
  if (visual.glyph && visual.glyph.trim().length > 0) {
    drawGlyph(ctx, visual.glyph, color, active, px, py, cellSize, innerSize);
    return;
  }

  // 2. Custom SVG path override
  if (visual.svgPath) {
    if (cellSize < 13) return;
    drawSvgPath24(
      ctx,
      visual.svgPath,
      undefined,
      active ? lightenHex(color, 0.25) : hexToRgba(color, 0.5),
      undefined,
      innerX,
      innerY,
      innerSize
    );
    return;
  }

  // 3. Built-in 34-icon vector registry
  if (iconDef && iconDef.id !== 'empty') {
    if (cellSize < 12) return;
    const strokeColor = active
      ? lightenHex(color, 0.35)
      : hexToRgba(color, 0.48);
    const fillColor = iconDef.fillPath
      ? hexToRgba(color, active ? 0.5 : 0.22)
      : undefined;
    drawSvgPath24(
      ctx,
      iconDef.path,
      iconDef.fillPath,
      strokeColor,
      fillColor,
      innerX,
      innerY,
      innerSize
    );
    return;
  }

  // 4. Fallback solid square when no icon/glyph set
  if (!iconDef && cellSize >= 18) {
    ctx.fillStyle = active
      ? hexToRgba(color, 0.55)
      : hexToRgba(color, 0.22);
    const m = innerSize * 0.26;
    ctx.fillRect(innerX + m, innerY + m, innerSize - m * 2, innerSize - m * 2);
  }
}

function drawIndicators(
  ctx: CanvasRenderingContext2D,
  indicators: readonly ResolvedVisualIndicator[],
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  if (cellSize < 14 || indicators.length === 0) return;

  for (const ind of indicators) {
    if (ind.kind === 'dot') {
      const markerR = Math.max(2, cellSize * 0.085);
      const inset = markerR + Math.max(2, cellSize * 0.05);
      let mx = innerX + innerSize - inset;
      let my = innerY + innerSize - inset;
      if (ind.position === 'topLeft') {
        mx = innerX + inset;
        my = innerY + inset;
      } else if (ind.position === 'bottomLeft') {
        mx = innerX + inset;
        my = innerY + innerSize - inset;
      }

      ctx.beginPath();
      ctx.arc(mx, my, markerR, 0, Math.PI * 2);
      if (ind.filled) {
        ctx.fillStyle = ind.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = ind.color;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    } else if (ind.kind === 'bar') {
      const m = innerSize * 0.22;
      const boxSize = innerSize - m * 2;
      const barH = Math.max(2.5, boxSize * 0.36);
      ctx.fillStyle = ind.color;
      ctx.fillRect(
        innerX + m + 1.5,
        innerY + m + boxSize - barH - 1.5,
        Math.max(1, boxSize - 3),
        barH
      );
    }
  }
}

function drawCells(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  bounds: VisibleBounds,
  offsetX: number,
  offsetY: number,
  cellSize: number
): void {
  const gridBuf = core.getCellIndexBuffer();
  const cellTypes = core.getCellTypes();
  const defaultId = core.manifest.defaultCellTypeId;
  const pad = Math.max(1.5, cellSize * 0.11);

  for (let y = bounds.startY; y <= bounds.endY; y++) {
    const row = y * core.width;
    const py = offsetY + y * cellSize;
    for (let x = bounds.startX; x <= bounds.endX; x++) {
      const cellType = cellTypes[gridBuf[row + x]];
      if (
        cellType.id === defaultId &&
        cellType.visual.icon === 'empty' &&
        !cellType.visual.glyph &&
        !cellType.visual.svgPath &&
        !cellType.visual.fullTile &&
        (!cellType.visual.rules || cellType.visual.rules.length === 0)
      ) {
        continue;
      }

      const px = offsetX + x * cellSize;
      const innerX = px + pad;
      const innerY = py + pad;
      const innerSize = Math.max(2, cellSize - pad * 2);
      const visual = core.resolveVisualAt(x, y);

      if (visual.substrateColor) {
        ctx.fillStyle = hexToRgba(visual.substrateColor, 0.2);
        ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      }

      drawIcon(ctx, visual, px, py, cellSize, innerX, innerY, innerSize);
      drawIndicators(ctx, visual.indicators, cellSize, innerX, innerY, innerSize);
    }
  }
}

function drawSupplyNumbers(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  supplyBuf: Int16Array,
  supplyDef: SupplyManifest,
  bounds: VisibleBounds,
  offsetX: number,
  offsetY: number,
  cellSize: number
): void {
  if (cellSize < 18) return;

  const gridBuf = core.getCellIndexBuffer();
  const cellTypes = core.getCellTypes();
  const defaultId = core.manifest.defaultCellTypeId;

  const emptyFontSize = Math.max(10, Math.min(20, Math.round(cellSize * 0.28)));
  const badgeFontSize = Math.max(9, Math.min(13, Math.round(cellSize * 0.2)));
  const emptyTextColor = lightenHex(supplyDef.color, 0.45);
  const pad = Math.max(1.5, cellSize * 0.11);
  const innerInset = Math.max(2, Math.round(cellSize * 0.045));
  const showBadges = cellSize >= 28;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let y = bounds.startY; y <= bounds.endY; y++) {
    const row = y * core.width;
    const py = offsetY + y * cellSize;
    const cy = py + cellSize / 2;
    for (let x = bounds.startX; x <= bounds.endX; x++) {
      const val = supplyBuf[row + x];
      if (val <= 0) continue;
      const cellType = cellTypes[gridBuf[row + x]];
      const px = offsetX + x * cellSize;
      const text = String(val);

      if (cellType.id === defaultId) {
        ctx.font = `600 ${emptyFontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = emptyTextColor;
        ctx.fillText(text, px + cellSize / 2, cy);
      } else if (showBadges) {
        ctx.font = `600 ${badgeFontSize}px "JetBrains Mono", monospace`;
        const textW = ctx.measureText(text).width;
        const badgeH = badgeFontSize + 4;
        const badgeW = Math.max(badgeH, Math.ceil(textW) + 6);
        const innerRight = px + cellSize - pad;
        const innerTop = py + pad;
        const bx = innerRight - badgeW - innerInset;
        const by = innerTop + innerInset;

        ctx.fillStyle = 'rgba(11, 15, 20, 0.88)';
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 3);
        ctx.fill();

        ctx.strokeStyle = hexToRgba(supplyDef.color, 0.45);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#E6EDF3';
        ctx.fillText(text, bx + badgeW / 2, by + badgeH / 2 + 0.5);
      }
    }
  }
}

function drawBuildPreview(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  selectedCell: GridCoordinate,
  previewCellTypeId: CellTypeId,
  offsetX: number,
  offsetY: number,
  cellSize: number
): void {
  const previewType = core.getCellTypeById(previewCellTypeId);
  if (!previewType) return;

  const affected = core.getEmissionPreviewCoords(
    selectedCell.x,
    selectedCell.y,
    previewCellTypeId
  );
  if (affected.length === 0) return;

  const previewBadge = core.getBuildPreview(
    selectedCell.x,
    selectedCell.y,
    previewCellTypeId
  );
  const previewActive = previewBadge?.tone !== 'danger';
  const previewColor = previewType.visual.color;

  ctx.save();
  if (!previewActive) {
    ctx.setLineDash([4, 3]);
  }
  for (const coord of affected) {
    const px = offsetX + coord.x * cellSize;
    const py = offsetY + coord.y * cellSize;
    ctx.fillStyle = hexToRgba(previewColor, previewActive ? 0.22 : 0.08);
    ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    ctx.strokeStyle = hexToRgba(previewColor, previewActive ? 0.85 : 0.45);
    ctx.lineWidth = 1.25;
    ctx.strokeRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
  }
  ctx.restore();
}

export function renderGridScene({
  ctx,
  viewportWidth: vw,
  viewportHeight: vh,
  dpr,
  camera,
  core,
  overlayMode,
  activeSupplyId,
  selectedCell,
  highlightedCell,
  hoveredCell,
  previewCellTypeId,
}: GridRenderParams): void {
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#0B0F14';
  ctx.fillRect(0, 0, vw, vh);

  const { offsetX, offsetY, zoom } = camera;
  const cellSize = BASE_CELL_SIZE * zoom;
  const boardW = core.width * cellSize;
  const boardH = core.height * cellSize;

  ctx.fillStyle = '#0E141C';
  ctx.fillRect(offsetX, offsetY, boardW, boardH);

  const bounds: VisibleBounds = {
    startX: Math.max(0, Math.floor(-offsetX / cellSize)),
    endX: Math.min(core.width - 1, Math.ceil((vw - offsetX) / cellSize)),
    startY: Math.max(0, Math.floor(-offsetY / cellSize)),
    endY: Math.min(core.height - 1, Math.ceil((vh - offsetY) / cellSize)),
  };

  const activeSupplyDef = activeSupplyId
    ? core.manifest.supplies.find((s) => s.id === activeSupplyId)
    : undefined;
  const supplyBuf = activeSupplyId
    ? core.getSupplyBuffer(activeSupplyId)
    : undefined;

  if (
    (overlayMode === 'heatmap' || overlayMode === 'numbers') &&
    supplyBuf &&
    activeSupplyDef
  ) {
    drawSupplyHeatmap(
      ctx,
      core,
      supplyBuf,
      activeSupplyDef,
      bounds,
      offsetX,
      offsetY,
      cellSize
    );
  }

  drawGridHairlines(ctx, bounds, offsetX, offsetY, cellSize);
  drawCells(ctx, core, bounds, offsetX, offsetY, cellSize);

  if (overlayMode === 'numbers' && supplyBuf && activeSupplyDef) {
    drawSupplyNumbers(
      ctx,
      core,
      supplyBuf,
      activeSupplyDef,
      bounds,
      offsetX,
      offsetY,
      cellSize
    );
  }

  if (selectedCell && previewCellTypeId) {
    drawBuildPreview(
      ctx,
      core,
      selectedCell,
      previewCellTypeId,
      offsetX,
      offsetY,
      cellSize
    );
  }

  ctx.save();
  ctx.strokeStyle = '#3B4D63';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    Math.round(offsetX) + 0.5,
    Math.round(offsetY) + 0.5,
    Math.round(boardW),
    Math.round(boardH)
  );
  ctx.restore();

  if (highlightedCell) {
    const hx = offsetX + highlightedCell.x * cellSize;
    const hy = offsetY + highlightedCell.y * cellSize;
    ctx.fillStyle = 'rgba(244, 63, 94, 0.16)';
    ctx.fillRect(hx, hy, cellSize, cellSize);
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(hx - 1, hy - 1, cellSize + 2, cellSize + 2);
  }

  if (selectedCell) {
    const sx = offsetX + selectedCell.x * cellSize;
    const sy = offsetY + selectedCell.y * cellSize;
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2);
  }

  if (
    hoveredCell &&
    (!selectedCell ||
      hoveredCell.x !== selectedCell.x ||
      hoveredCell.y !== selectedCell.y)
  ) {
    const hx = offsetX + hoveredCell.x * cellSize;
    const hy = offsetY + hoveredCell.y * cellSize;
    ctx.strokeStyle = 'rgba(230, 237, 243, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hx + 0.75, hy + 0.75, cellSize - 1.5, cellSize - 1.5);
  }

  ctx.restore();
}
