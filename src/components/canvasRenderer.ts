import { SimulationCore } from '../engine/SimulationCore';
import {
  CellTypeId,
  GridCoordinate,
  ResolvedCellType,
  SupplyId,
  SupplyManifest,
  SupplyOverlayMode,
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

function drawWorkerMarker(
  ctx: CanvasRenderingContext2D,
  hasWorker: boolean,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  const markerR = Math.max(2, cellSize * 0.09);
  const mx = innerX + innerSize - markerR - 2;
  const my = innerY + innerSize - markerR - 2;
  ctx.beginPath();
  ctx.arc(mx, my, markerR, 0, Math.PI * 2);
  if (hasWorker) {
    ctx.fillStyle = '#10B981';
    ctx.fill();
  } else {
    ctx.strokeStyle = '#8B98A9';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
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

function drawWaterGlyph(
  ctx: CanvasRenderingContext2D,
  color: string,
  px: number,
  py: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  ctx.fillStyle = hexToRgba(color, 0.34);
  ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
  ctx.strokeStyle = hexToRgba(color, 0.72);
  ctx.lineWidth = Math.max(1, cellSize * 0.045);
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);

  if (cellSize < 14) return;

  ctx.strokeStyle = hexToRgba('#7DD3FC', 0.9);
  ctx.lineWidth = Math.max(1, cellSize * 0.055);
  const margin = innerSize * 0.2;
  const waveW = innerSize - margin * 2;
  const amp = Math.max(1.2, innerSize * 0.07);
  const rows = [innerY + innerSize * 0.38, innerY + innerSize * 0.66];
  ctx.beginPath();
  for (const ry of rows) {
    const x0 = innerX + margin;
    ctx.moveTo(x0, ry);
    ctx.quadraticCurveTo(x0 + waveW * 0.25, ry - amp, x0 + waveW * 0.5, ry);
    ctx.quadraticCurveTo(x0 + waveW * 0.75, ry + amp, x0 + waveW, ry);
  }
  ctx.stroke();
}

function drawForestGlyph(
  ctx: CanvasRenderingContext2D,
  color: string,
  px: number,
  py: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  ctx.fillStyle = hexToRgba('#15803D', 0.28);
  ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
  ctx.strokeStyle = hexToRgba(color, 0.45);
  ctx.lineWidth = Math.max(1, cellSize * 0.04);
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);

  if (cellSize < 12) return;

  const cx = px + cellSize / 2;
  const topY = innerY + innerSize * 0.16;
  const midY = innerY + innerSize * 0.48;
  const botY = innerY + innerSize * 0.74;
  const trunkY = innerY + innerSize * 0.88;

  ctx.strokeStyle = hexToRgba('#4ADE80', 0.92);
  ctx.lineWidth = Math.max(1.1, cellSize * 0.055);
  ctx.beginPath();
  ctx.moveTo(cx - innerSize * 0.22, midY);
  ctx.lineTo(cx, topY);
  ctx.lineTo(cx + innerSize * 0.22, midY);
  ctx.moveTo(cx - innerSize * 0.3, botY);
  ctx.lineTo(cx, innerY + innerSize * 0.36);
  ctx.lineTo(cx + innerSize * 0.3, botY);
  ctx.moveTo(cx, botY);
  ctx.lineTo(cx, trunkY);
  ctx.stroke();
}

function drawMountainGlyph(
  ctx: CanvasRenderingContext2D,
  color: string,
  px: number,
  py: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  ctx.fillStyle = hexToRgba(color, 0.28);
  ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
  ctx.strokeStyle = hexToRgba('#94A3B8', 0.45);
  ctx.lineWidth = Math.max(1, cellSize * 0.04);
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);

  if (cellSize < 12) return;

  const baseY = innerY + innerSize * 0.78;
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = Math.max(1.1, cellSize * 0.055);
  ctx.beginPath();
  ctx.moveTo(innerX + innerSize * 0.12, baseY);
  ctx.lineTo(innerX + innerSize * 0.42, innerY + innerSize * 0.22);
  ctx.lineTo(innerX + innerSize * 0.7, baseY);
  ctx.moveTo(innerX + innerSize * 0.52, innerY + innerSize * 0.52);
  ctx.lineTo(innerX + innerSize * 0.68, innerY + innerSize * 0.34);
  ctx.lineTo(innerX + innerSize * 0.88, baseY);
  ctx.stroke();
}

function drawFarmGlyph(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  color: string,
  x: number,
  y: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  const state = core.getCellStateAt(x, y);
  const hasWorker = Number(state.worker ?? 0) >= 1;
  const active = core.isCellActiveAt(x, y);

  ctx.fillStyle = hexToRgba(color, active ? 0.24 : 0.1);
  ctx.fillRect(innerX, innerY, innerSize, innerSize);
  ctx.strokeStyle = active ? color : hexToRgba(color, 0.55);
  ctx.lineWidth = Math.max(1, cellSize * 0.06);
  if (!active) ctx.setLineDash([3, 2]);
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);
  ctx.setLineDash([]);

  if (cellSize < 14) return;

  ctx.strokeStyle = hexToRgba(color, active ? 0.9 : 0.42);
  ctx.lineWidth = Math.max(1, cellSize * 0.055);
  const lines = 3;
  const margin = innerSize * 0.22;
  const usable = innerSize - margin * 2;
  ctx.beginPath();
  for (let i = 0; i < lines; i++) {
    const ly = innerY + margin + (usable * i) / Math.max(1, lines - 1);
    ctx.moveTo(innerX + margin, ly);
    ctx.lineTo(innerX + innerSize - margin, ly);
  }
  ctx.stroke();

  drawWorkerMarker(ctx, hasWorker, cellSize, innerX, innerY, innerSize);
}

function drawSawmillGlyph(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  color: string,
  x: number,
  y: number,
  px: number,
  py: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  const state = core.getCellStateAt(x, y);
  const hasWorker = Number(state.worker ?? 0) >= 1;
  const active = core.isCellActiveAt(x, y);

  ctx.fillStyle = hexToRgba('#15803D', 0.16);
  ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);

  ctx.fillStyle = hexToRgba(color, active ? 0.26 : 0.1);
  ctx.fillRect(innerX, innerY, innerSize, innerSize);
  ctx.strokeStyle = active ? color : hexToRgba(color, 0.55);
  ctx.lineWidth = Math.max(1, cellSize * 0.06);
  if (!active) ctx.setLineDash([3, 2]);
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);
  ctx.setLineDash([]);

  if (cellSize < 14) return;

  const cx = innerX + innerSize * 0.46;
  const cy = innerY + innerSize * 0.46;
  const r = innerSize * 0.22;
  ctx.strokeStyle = hexToRgba('#FBBF24', active ? 0.92 : 0.45);
  ctx.lineWidth = Math.max(1.1, cellSize * 0.055);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r * 1.35, cy);
  ctx.lineTo(cx + r * 1.35, cy);
  ctx.moveTo(cx, cy - r * 1.35);
  ctx.lineTo(cx, cy + r * 1.35);
  ctx.stroke();

  drawWorkerMarker(ctx, hasWorker, cellSize, innerX, innerY, innerSize);
}

function drawQuarryGlyph(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  color: string,
  x: number,
  y: number,
  px: number,
  py: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  const state = core.getCellStateAt(x, y);
  const hasWorker = Number(state.worker ?? 0) >= 1;
  const active = core.isCellActiveAt(x, y);

  ctx.fillStyle = hexToRgba('#475569', 0.22);
  ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);

  ctx.fillStyle = hexToRgba(color, active ? 0.26 : 0.1);
  ctx.fillRect(innerX, innerY, innerSize, innerSize);
  ctx.strokeStyle = active ? '#CBD5E1' : hexToRgba('#94A3B8', 0.55);
  ctx.lineWidth = Math.max(1, cellSize * 0.06);
  if (!active) ctx.setLineDash([3, 2]);
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);
  ctx.setLineDash([]);

  if (cellSize < 14) return;

  const m = innerSize * 0.22;
  ctx.strokeStyle = hexToRgba('#E2E8F0', active ? 0.92 : 0.45);
  ctx.lineWidth = Math.max(1.1, cellSize * 0.055);
  ctx.beginPath();
  ctx.moveTo(innerX + m, innerY + innerSize * 0.34);
  ctx.lineTo(innerX + innerSize * 0.5, innerY + innerSize * 0.34);
  ctx.lineTo(innerX + innerSize * 0.5, innerY + innerSize * 0.54);
  ctx.lineTo(innerX + innerSize - m, innerY + innerSize * 0.54);
  ctx.moveTo(innerX + m, innerY + innerSize * 0.68);
  ctx.lineTo(innerX + innerSize * 0.62, innerY + innerSize * 0.68);
  ctx.stroke();

  drawWorkerMarker(ctx, hasWorker, cellSize, innerX, innerY, innerSize);
}

function drawWarehouseGlyph(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  color: string,
  x: number,
  y: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  const state = core.getCellStateAt(x, y);
  const resId = String(state.storageResource ?? '');
  const resDef = resId
    ? core.manifest.resources.find((r) => r.id === resId)
    : undefined;
  const active = Boolean(resDef);
  const accent = resDef?.color ?? color;

  ctx.fillStyle = hexToRgba(color, active ? 0.24 : 0.12);
  ctx.fillRect(innerX, innerY, innerSize, innerSize);
  ctx.strokeStyle = active ? color : hexToRgba(color, 0.55);
  ctx.lineWidth = Math.max(1, cellSize * 0.06);
  if (!active) ctx.setLineDash([3, 2]);
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);
  ctx.setLineDash([]);

  if (cellSize < 14) return;

  const m = innerSize * 0.22;
  const boxSize = innerSize - m * 2;
  ctx.strokeStyle = hexToRgba('#E6EDF3', active ? 0.85 : 0.45);
  ctx.lineWidth = Math.max(1, cellSize * 0.05);
  ctx.strokeRect(innerX + m, innerY + m, boxSize, boxSize);

  if (active) {
    const barH = Math.max(2.5, boxSize * 0.36);
    ctx.fillStyle = accent;
    ctx.fillRect(
      innerX + m + 1.5,
      innerY + m + boxSize - barH - 1.5,
      Math.max(1, boxSize - 3),
      barH
    );
  }
}

function drawHouseGlyph(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  color: string,
  x: number,
  y: number,
  px: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  const state = core.getCellStateAt(x, y);
  const hunger = Number(state.hunger ?? 0);
  const critical = hunger >= 3;
  const hungry = hunger > 0 && hunger < 3;
  const strokeColor = critical ? '#F43F5E' : hungry ? '#F59E0B' : color;

  ctx.fillStyle = hexToRgba(strokeColor, critical ? 0.22 : 0.2);
  ctx.fillRect(innerX, innerY, innerSize, innerSize);

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(1, cellSize * 0.06);
  if (critical) ctx.setLineDash([3, 2]);
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);
  ctx.setLineDash([]);

  if (cellSize < 14) return;

  const cx = px + cellSize / 2;
  const topY = innerY + innerSize * 0.22;
  const midY = innerY + innerSize * 0.52;
  const botY = innerY + innerSize * 0.78;
  const halfW = innerSize * 0.28;

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(1.2, cellSize * 0.065);
  ctx.beginPath();
  ctx.moveTo(cx - halfW, midY);
  ctx.lineTo(cx, topY);
  ctx.lineTo(cx + halfW, midY);
  ctx.lineTo(cx + halfW * 0.75, midY);
  ctx.lineTo(cx + halfW * 0.75, botY);
  ctx.lineTo(cx - halfW * 0.75, botY);
  ctx.lineTo(cx - halfW * 0.75, midY);
  ctx.closePath();
  ctx.stroke();
}

function drawCustomSvgGlyph(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  cellType: ResolvedCellType,
  x: number,
  y: number,
  cellSize: number,
  innerX: number,
  innerY: number,
  innerSize: number
): void {
  const active = core.isCellActiveAt(x, y);
  const color = cellType.visual.color;

  ctx.fillStyle = hexToRgba(color, active ? 0.24 : 0.1);
  ctx.fillRect(innerX, innerY, innerSize, innerSize);
  ctx.strokeStyle = active ? color : hexToRgba(color, 0.55);
  ctx.lineWidth = Math.max(1, cellSize * 0.06);
  if (!active) ctx.setLineDash([3, 2]);
  ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);
  ctx.setLineDash([]);

  if (!cellType.visual.svgPath || cellSize < 14) return;
  const path = new Path2D(cellType.visual.svgPath);
  const scale = (innerSize * 0.72) / 24;
  ctx.save();
  ctx.translate(innerX + innerSize * 0.14, innerY + innerSize * 0.14);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke(path);
  ctx.restore();
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
      if (cellType.id === defaultId) continue;

      const px = offsetX + x * cellSize;
      const innerX = px + pad;
      const innerY = py + pad;
      const innerSize = Math.max(2, cellSize - pad * 2);
      const color = cellType.visual.color;

      if (cellType.visual.substrateColor) {
        ctx.fillStyle = hexToRgba(cellType.visual.substrateColor, 0.2);
        ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      }

      if (cellType.visual.svgPath) {
        drawCustomSvgGlyph(
          ctx,
          core,
          cellType,
          x,
          y,
          cellSize,
          innerX,
          innerY,
          innerSize
        );
        continue;
      }

      switch (cellType.visual.glyph) {
        case 'water':
          drawWaterGlyph(ctx, color, px, py, cellSize, innerX, innerY, innerSize);
          break;
        case 'forest':
          drawForestGlyph(ctx, color, px, py, cellSize, innerX, innerY, innerSize);
          break;
        case 'mountain':
          drawMountainGlyph(ctx, color, px, py, cellSize, innerX, innerY, innerSize);
          break;
        case 'farm':
          drawFarmGlyph(ctx, core, color, x, y, cellSize, innerX, innerY, innerSize);
          break;
        case 'sawmill':
          drawSawmillGlyph(ctx, core, color, x, y, px, py, cellSize, innerX, innerY, innerSize);
          break;
        case 'quarry':
          drawQuarryGlyph(ctx, core, color, x, y, px, py, cellSize, innerX, innerY, innerSize);
          break;
        case 'warehouse':
          drawWarehouseGlyph(ctx, core, color, x, y, cellSize, innerX, innerY, innerSize);
          break;
        case 'house':
          drawHouseGlyph(ctx, core, color, x, y, px, cellSize, innerX, innerY, innerSize);
          break;
        default:
          ctx.fillStyle = color;
          ctx.fillRect(innerX, innerY, innerSize, innerSize);
          if (cellSize >= 18) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.fillRect(
              innerX,
              innerY,
              innerSize,
              Math.max(1.5, innerSize * 0.12)
            );
          }
          break;
      }
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

  const localSupplies = core.getLocalSupplies(selectedCell.x, selectedCell.y);
  const previewBadge = previewType.behavior?.module.getBuildPreview
    ? previewType.behavior.module.getBuildPreview(
        {
          x: selectedCell.x,
          y: selectedCell.y,
          cellType: previewType,
          state: {},
          supplies: localSupplies,
          resources: core.getResources(),
          resourceCaps: core.getResourceCaps(),
          manifest: core.manifest,
        },
        previewType.behavior.params
      )
    : null;
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
  ctx.strokeStyle = core.boundaryMode === 'toroidal' ? '#2D3C4E' : '#3B4D63';
  ctx.lineWidth = 1.5;
  if (core.boundaryMode === 'toroidal') {
    ctx.setLineDash([6, 4]);
  }
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
