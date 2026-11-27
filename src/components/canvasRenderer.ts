import { SimulationCore } from '../engine/SimulationCore';
import {
  CellTypeId,
  GridCoordinate,
  SupplyId,
  SupplyManifest,
  SupplyOverlayMode,
} from '../engine/sdk';
import { hexToRgba, lightenHex } from '../utils/color';

export const BASE_CELL_SIZE = 32;

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
  onSpriteLoaded?: () => void;
}

interface VisibleBounds {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

// ============================================================================
// 32×32 PNG Sprite Image Cache
// ============================================================================

interface CachedSprite {
  img: HTMLImageElement;
  loaded: boolean;
}

const SPRITE_IMAGE_CACHE = new Map<string, CachedSprite>();

function getSpriteImage(
  dataUrl: string,
  onLoaded?: () => void
): HTMLImageElement | null {
  let entry = SPRITE_IMAGE_CACHE.get(dataUrl);
  if (!entry) {
    const img = new Image();
    entry = { img, loaded: false };
    SPRITE_IMAGE_CACHE.set(dataUrl, entry);
    img.onload = () => {
      entry!.loaded = true;
      onLoaded?.();
    };
    img.src = dataUrl;
  }
  return entry.loaded && entry.img.complete && entry.img.naturalWidth > 0
    ? entry.img
    : null;
}

// ============================================================================
// Unified Numeric Supply Heatmap & Numbers
// ============================================================================

function drawSupplyHeatmap(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  supplyDef: SupplyManifest,
  bounds: VisibleBounds,
  offsetX: number,
  offsetY: number,
  cellSize: number
): void {
  const supplyBuf = core.getSupplyBuffer(supplyDef.id);
  if (!supplyBuf) return;
  const maxExp = Math.max(1, supplyDef.maxExpected);

  for (let y = bounds.startY; y <= bounds.endY; y++) {
    const row = y * core.width;
    const py = offsetY + y * cellSize;
    for (let x = bounds.startX; x <= bounds.endX; x++) {
      const val = supplyBuf[row + x];
      if (val <= 0) continue;
      const intensity = Math.min(1, val / maxExp);
      const alpha = 0.14 + intensity * 0.3;
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
  if (cellSize < 8) return;
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

// ============================================================================
// O(1) Runtime Cell Visual Renderer (32×32 PNG Sprites + Color/Opacity)
// ============================================================================

function drawCells(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  bounds: VisibleBounds,
  offsetX: number,
  offsetY: number,
  cellSize: number,
  onSpriteLoaded?: () => void
): void {
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  for (let y = bounds.startY; y <= bounds.endY; y++) {
    const py = offsetY + y * cellSize;
    for (let x = bounds.startX; x <= bounds.endX; x++) {
      const px = offsetX + x * cellSize;
      const ct = core.getCellTypeAt(x, y);
      const visual = core.getCellVisualAt(x, y);

      ctx.save();
      if (visual.opacity < 1) {
        ctx.globalAlpha = visual.opacity;
      }

      // 1. Tile base background color
      const baseColor = visual.tintColor ?? ct.defaultColor;
      ctx.fillStyle = hexToRgba(baseColor, 0.42);
      ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);

      // 2. Optional substrate sprite (e.g. forest under sawmill)
      if (ct.substrateSpriteId) {
        const subAsset = core.spriteById.get(ct.substrateSpriteId);
        if (subAsset) {
          const subImg = getSpriteImage(subAsset.dataUrl, onSpriteLoaded);
          if (subImg) {
            ctx.save();
            ctx.globalAlpha = visual.opacity * 0.4;
            ctx.drawImage(subImg, px + 1, py + 1, cellSize - 2, cellSize - 2);
            ctx.restore();
          }
        }
      }

      // 3. Active sprite (runtime override from cell.setSprite or defaultSpriteId)
      let drewSprite = false;
      if (visual.spriteId) {
        const asset = core.spriteById.get(visual.spriteId);
        if (asset) {
          const img = getSpriteImage(asset.dataUrl, onSpriteLoaded);
          if (img) {
            ctx.drawImage(img, px + 1, py + 1, cellSize - 2, cellSize - 2);
            drewSprite = true;
          }
        }
      }

      // 4. Clean solid-color fallback when sprite is null or still loading
      if (!drewSprite && ct.id !== core.manifest.defaultCellTypeId) {
        const pad = Math.max(2, cellSize * 0.14);
        ctx.fillStyle = hexToRgba(baseColor, 0.72);
        ctx.fillRect(px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2);
        ctx.strokeStyle = lightenHex(baseColor, 0.25);
        ctx.lineWidth = 1;
        ctx.strokeRect(
          px + pad + 0.5,
          py + pad + 0.5,
          cellSize - pad * 2 - 1,
          cellSize - pad * 2 - 1
        );
      }

      // 5. Optional dynamic tint overlay from cell.setColor
      if (visual.tintColor) {
        ctx.fillStyle = hexToRgba(visual.tintColor, 0.26);
        ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      }

      ctx.restore();
    }
  }

  ctx.imageSmoothingEnabled = prevSmooth;
}

function drawSupplyNumbers(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  supplyDef: SupplyManifest,
  bounds: VisibleBounds,
  offsetX: number,
  offsetY: number,
  cellSize: number
): void {
  if (cellSize < 18) return;
  const supplyBuf = core.getSupplyBuffer(supplyDef.id);
  if (!supplyBuf) return;

  const defaultId = core.manifest.defaultCellTypeId;
  const emptyFontSize = Math.max(10, Math.min(18, Math.round(cellSize * 0.28)));
  const badgeFontSize = Math.max(9, Math.min(13, Math.round(cellSize * 0.2)));
  const emptyTextColor = lightenHex(supplyDef.color, 0.45);
  const pad = Math.max(1.5, cellSize * 0.08);
  const showBadges = cellSize >= 26;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let y = bounds.startY; y <= bounds.endY; y++) {
    const row = y * core.width;
    const py = offsetY + y * cellSize;
    const cy = py + cellSize / 2;
    for (let x = bounds.startX; x <= bounds.endX; x++) {
      const idx = row + x;
      const val = supplyBuf[idx];
      if (val <= 0) continue;
      const ct = core.getCellTypeAt(x, y);
      const px = offsetX + x * cellSize;
      const text = String(val);

      if (ct.id === defaultId) {
        ctx.font = `600 ${emptyFontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = emptyTextColor;
        ctx.fillText(text, px + cellSize / 2, cy);
      } else if (showBadges) {
        ctx.font = `600 ${badgeFontSize}px "JetBrains Mono", monospace`;
        const textW = ctx.measureText(text).width;
        const badgeH = badgeFontSize + 4;
        const badgeW = Math.max(badgeH, Math.ceil(textW) + 6);
        const bx = px + cellSize - pad - badgeW - 1;
        const by = py + pad + 1;

        ctx.fillStyle = 'rgba(11, 15, 20, 0.88)';
        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 3);
        ctx.fill();

        ctx.strokeStyle = hexToRgba(supplyDef.color, 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#E6EDF3';
        ctx.fillText(text, bx + badgeW / 2, by + badgeH / 2 + 0.5);
      }
    }
  }
}

function drawPreviewSprite(
  ctx: CanvasRenderingContext2D,
  core: SimulationCore,
  selectedCell: GridCoordinate,
  previewCellTypeId: CellTypeId,
  offsetX: number,
  offsetY: number,
  cellSize: number,
  onSpriteLoaded?: () => void
): void {
  const ct = core.cellTypeById.get(previewCellTypeId);
  if (!ct) return;
  const px = offsetX + selectedCell.x * cellSize;
  const py = offsetY + selectedCell.y * cellSize;

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.imageSmoothingEnabled = false;
  if (ct.defaultSpriteId) {
    const asset = core.spriteById.get(ct.defaultSpriteId);
    const img = asset ? getSpriteImage(asset.dataUrl, onSpriteLoaded) : null;
    if (img) {
      ctx.drawImage(img, px + 1, py + 1, cellSize - 2, cellSize - 2);
    }
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
  onSpriteLoaded,
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

  drawCells(ctx, core, bounds, offsetX, offsetY, cellSize, onSpriteLoaded);

  const activeSupplyDef = activeSupplyId
    ? core.supplyById.get(activeSupplyId)
    : undefined;

  if (
    (overlayMode === 'heatmap' || overlayMode === 'numbers') &&
    activeSupplyDef
  ) {
    drawSupplyHeatmap(
      ctx,
      core,
      activeSupplyDef,
      bounds,
      offsetX,
      offsetY,
      cellSize
    );
  }

  drawGridHairlines(ctx, bounds, offsetX, offsetY, cellSize);

  if (overlayMode === 'numbers' && activeSupplyDef) {
    drawSupplyNumbers(
      ctx,
      core,
      activeSupplyDef,
      bounds,
      offsetX,
      offsetY,
      cellSize
    );
  }

  if (selectedCell && previewCellTypeId) {
    drawPreviewSprite(
      ctx,
      core,
      selectedCell,
      previewCellTypeId,
      offsetX,
      offsetY,
      cellSize,
      onSpriteLoaded
    );
  }

  // Board perimeter frame
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
