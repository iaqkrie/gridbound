import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { SimulationCore } from '../engine/SimulationCore';
import {
  CellTypeId,
  GridCoordinate,
  MouseButton,
  SupplyId,
  SupplyOverlayMode,
} from '../engine/sdk';
import {
  BASE_CELL_SIZE,
  CameraState,
  renderGridScene,
} from './canvasRenderer';

export interface GridCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
  focusCell: (x: number, y: number) => void;
  getCellScreenPosition: (x: number, y: number) => { x: number; y: number };
}

interface GridCanvasProps {
  core: SimulationCore;
  renderVersion: number;
  overlayMode: SupplyOverlayMode;
  activeSupplyId: SupplyId | null;
  selectedCell: GridCoordinate | null;
  highlightedCell: GridCoordinate | null;
  previewCellTypeId: CellTypeId | null;
  onHoverCell: (coord: GridCoordinate | null) => void;
  onCellClick: (
    x: number,
    y: number,
    button: MouseButton,
    screenX: number,
    screenY: number
  ) => void;
  onBackgroundClick: () => void;
  onZoomChange: (zoomPercent: number) => void;
  onViewportResize: (width: number, height: number) => void;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3.2;

export const GridCanvas = forwardRef<GridCanvasHandle, GridCanvasProps>(
  function GridCanvas(
    {
      core,
      renderVersion,
      overlayMode,
      activeSupplyId,
      selectedCell,
      highlightedCell,
      previewCellTypeId,
      onHoverCell,
      onCellClick,
      onBackgroundClick,
      onZoomChange,
      onViewportResize,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const [isPanning, setIsPanning] = useState(false);

    const cameraRef = useRef<CameraState>({
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
    });
    const viewportRef = useRef({ width: 800, height: 600 });
    const hoveredCellRef = useRef<GridCoordinate | null>(null);
    const panStateRef = useRef({
      active: false,
      startX: 0,
      startY: 0,
      origOffsetX: 0,
      origOffsetY: 0,
    });

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const vw = viewportRef.current.width;
      const vh = viewportRef.current.height;

      if (
        canvas.width !== Math.round(vw * dpr) ||
        canvas.height !== Math.round(vh * dpr)
      ) {
        canvas.width = Math.round(vw * dpr);
        canvas.height = Math.round(vh * dpr);
      }

      renderGridScene({
        ctx,
        viewportWidth: vw,
        viewportHeight: vh,
        dpr,
        camera: cameraRef.current,
        core,
        overlayMode,
        activeSupplyId,
        selectedCell,
        highlightedCell,
        hoveredCell: hoveredCellRef.current,
        previewCellTypeId,
      });
    }, [
      core,
      overlayMode,
      activeSupplyId,
      selectedCell,
      highlightedCell,
      previewCellTypeId,
    ]);

    // Keep stable ref to draw so camera callbacks never trigger board refit on selection
    const drawRef = useRef(draw);
    drawRef.current = draw;

    const fitBoardToViewport = useCallback(() => {
      const { width: vw, height: vh } = viewportRef.current;
      const paddingX = 64;
      const paddingY = 88;
      const availW = Math.max(120, vw - paddingX);
      const availH = Math.max(120, vh - paddingY);

      const zoomX = availW / (core.width * BASE_CELL_SIZE);
      const zoomY = availH / (core.height * BASE_CELL_SIZE);
      const fitZoom = Math.max(
        MIN_ZOOM,
        Math.min(2.4, Math.min(zoomX, zoomY))
      );

      const boardW = core.width * BASE_CELL_SIZE * fitZoom;
      const boardH = core.height * BASE_CELL_SIZE * fitZoom;

      cameraRef.current = {
        zoom: fitZoom,
        offsetX: Math.round((vw - boardW) / 2),
        offsetY: Math.round((vh - boardH) / 2 - 12),
      };
      onZoomChange(Math.round(fitZoom * 100));
      drawRef.current();
    }, [core, onZoomChange]);

    const applyZoomAroundPoint = useCallback(
      (factor: number, cx: number, cy: number) => {
        const cam = cameraRef.current;
        const nextZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, cam.zoom * factor)
        );
        if (Math.abs(nextZoom - cam.zoom) < 0.0001) return;

        const scaleRatio = nextZoom / cam.zoom;
        cam.offsetX = cx - (cx - cam.offsetX) * scaleRatio;
        cam.offsetY = cy - (cy - cam.offsetY) * scaleRatio;
        cam.zoom = nextZoom;

        onZoomChange(Math.round(nextZoom * 100));
        drawRef.current();
      },
      [onZoomChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          applyZoomAroundPoint(
            1.25,
            viewportRef.current.width / 2,
            viewportRef.current.height / 2
          );
        },
        zoomOut: () => {
          applyZoomAroundPoint(
            0.8,
            viewportRef.current.width / 2,
            viewportRef.current.height / 2
          );
        },
        resetCamera: () => {
          fitBoardToViewport();
        },
        focusCell: (x: number, y: number) => {
          const { width: vw, height: vh } = viewportRef.current;
          const cam = cameraRef.current;
          const targetZoom = Math.max(cam.zoom, 1.15);
          const cellSize = BASE_CELL_SIZE * targetZoom;
          cam.zoom = targetZoom;
          cam.offsetX = Math.round(vw / 2 - (x + 0.5) * cellSize);
          cam.offsetY = Math.round(vh / 2 - (y + 0.5) * cellSize);
          onZoomChange(Math.round(targetZoom * 100));
          drawRef.current();
        },
        getCellScreenPosition: (x: number, y: number) => {
          const { offsetX, offsetY, zoom } = cameraRef.current;
          const cellSize = BASE_CELL_SIZE * zoom;
          return {
            x: offsetX + (x + 0.5) * cellSize,
            y: offsetY + (y + 0.5) * cellSize,
          };
        },
      }),
      [applyZoomAroundPoint, fitBoardToViewport, onZoomChange]
    );

    const lastFittedCoreRef = useRef<SimulationCore | null>(null);

    // ResizeObserver for crisp full-viewport canvas
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let initialized = false;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width <= 0 || height <= 0) continue;
          const prevW = viewportRef.current.width;
          const prevH = viewportRef.current.height;
          viewportRef.current = { width, height };
          onViewportResize(width, height);
          if (!initialized) {
            initialized = true;
            lastFittedCoreRef.current = core;
            fitBoardToViewport();
          } else {
            cameraRef.current.offsetX += (width - prevW) / 2;
            cameraRef.current.offsetY += (height - prevH) / 2;
            drawRef.current();
          }
        }
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, [core, fitBoardToViewport, onViewportResize]);

    // Refit camera ONLY when switching to a genuinely new SimulationCore
    useEffect(() => {
      if (lastFittedCoreRef.current === core) return;
      lastFittedCoreRef.current = core;
      fitBoardToViewport();
    }, [core, fitBoardToViewport]);

    // Redraw on simulation ticks or visual setting changes (never resets camera)
    useEffect(() => {
      draw();
    }, [draw, renderVersion]);

    // Spacebar pan modifier tracking
    useEffect(() => {
      const isInteractiveEl = (target: EventTarget | null) => {
        const el = target as HTMLElement | null;
        if (!el) return false;
        const tag = el.tagName;
        return (
          tag === 'INPUT' ||
          tag === 'SELECT' ||
          tag === 'TEXTAREA' ||
          tag === 'BUTTON'
        );
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !e.repeat && !isInteractiveEl(e.target)) {
          e.preventDefault();
          setIsSpaceHeld(true);
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          setIsSpaceHeld(false);
        }
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }, []);

    // Wheel zoom (passive: false to prevent browser scroll)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        applyZoomAroundPoint(factor, cx, cy);
      };
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }, [applyZoomAroundPoint]);

    const screenToCell = (
      clientX: number,
      clientY: number
    ): {
      coord: GridCoordinate | null;
      localX: number;
      localY: number;
    } => {
      const canvas = canvasRef.current;
      if (!canvas) return { coord: null, localX: 0, localY: 0 };
      const rect = canvas.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;

      const { offsetX, offsetY, zoom } = cameraRef.current;
      const cellSize = BASE_CELL_SIZE * zoom;
      const gx = Math.floor((localX - offsetX) / cellSize);
      const gy = Math.floor((localY - offsetY) / cellSize);

      if (core.inBounds(gx, gy)) {
        return { coord: { x: gx, y: gy }, localX, localY };
      }
      return { coord: null, localX, localY };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const { coord, localX, localY } = screenToCell(e.clientX, e.clientY);

      if (e.button === 1 || (e.button === 0 && isSpaceHeld)) {
        onBackgroundClick();
        panStateRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          origOffsetX: cameraRef.current.offsetX,
          origOffsetY: cameraRef.current.offsetY,
        };
        setIsPanning(true);
        return;
      }

      if (!coord) {
        onBackgroundClick();
        return;
      }

      const button: MouseButton =
        e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';

      onCellClick(coord.x, coord.y, button, localX, localY);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (panStateRef.current.active) {
        const dx = e.clientX - panStateRef.current.startX;
        const dy = e.clientY - panStateRef.current.startY;
        cameraRef.current.offsetX = panStateRef.current.origOffsetX + dx;
        cameraRef.current.offsetY = panStateRef.current.origOffsetY + dy;
        draw();
        return;
      }

      const { coord } = screenToCell(e.clientX, e.clientY);

      const prev = hoveredCellRef.current;
      const changed = prev?.x !== coord?.x || prev?.y !== coord?.y;
      if (changed) {
        hoveredCellRef.current = coord;
        onHoverCell(coord);
        draw();
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (panStateRef.current.active) {
        panStateRef.current.active = false;
        setIsPanning(false);
      }
    };

    const handlePointerLeave = () => {
      if (!panStateRef.current.active) {
        hoveredCellRef.current = null;
        onHoverCell(null);
        draw();
      }
    };

    const cursorClass = isPanning
      ? 'cursor-grabbing'
      : isSpaceHeld
        ? 'cursor-grab'
        : 'cursor-crosshair';

    return (
      <div
        ref={containerRef}
        className="relative flex-1 h-full overflow-hidden bg-[#0B0F14] select-none"
      >
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          className={`block w-full h-full touch-none ${cursorClass}`}
        />
      </div>
    );
  }
);
