import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import {
  encodeRgbaToPngDataUrl,
  NodeGraph,
  RulesetManifest,
  SpriteAssetManifest,
} from '../../engine/sdk';
import {
  decodeDataUrlToRgba32,
  importImageFileAsPng32,
  makeUniqueId,
} from './studioUtils';

interface SpritesTabProps {
  manifest: RulesetManifest;
  readOnly?: boolean;
  onChange: (next: RulesetManifest) => void;
}

type PixelTool = 'pencil' | 'eraser' | 'fill' | 'eyedropper';

const CANVAS_PIXELS = 576; // 32 * 18px = 576px crisp internal resolution
const CELL_PX = 18;
const BUFFER_LEN = 32 * 32 * 4;

const QUICK_PALETTE = [
  '#0f172a', '#1e293b', '#334155', '#64748b', '#94a3b8', '#e2e8f0',
  '#ffffff', '#dc2626', '#f43f5e', '#f97316', '#f59e0b', '#fde047',
  '#14532d', '#16a34a', '#4ade80', '#10b981', '#0d9488', '#38bdf8',
  '#1d4ed8', '#3b82f6', '#6366f1', '#8b5cf6', '#78350f', '#c2783e',
];

function hexToRgba(hex: string): [number, number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16) || 0,
    parseInt(c.slice(2, 4), 16) || 0,
    parseInt(c.slice(4, 6), 16) || 0,
    255,
  ];
}

function rgbaToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function cascadeSpriteRenameInGraph(
  graph: NodeGraph | undefined,
  oldId: string,
  newId: string
): NodeGraph | undefined {
  if (!graph) return graph;
  let changed = false;
  const nextNodes = graph.nodes.map((node) => {
    if (node.type === 'cell.setSprite' && node.data?.spriteId === oldId) {
      changed = true;
      return { ...node, data: { ...node.data, spriteId: newId } };
    }
    return node;
  });
  return changed ? { ...graph, nodes: nextNodes } : graph;
}

export function SpritesTab({ manifest, readOnly, onChange }: SpritesTabProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [tool, setTool] = useState<PixelTool>('pencil');
  const [color, setColor] = useState<string>('#10b981');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [pixels, setPixels] = useState<Uint8ClampedArray>(
    () => new Uint8ClampedArray(BUFFER_LEN)
  );
  const [history, setHistory] = useState<Uint8ClampedArray[]>([]);
  const [future, setFuture] = useState<Uint8ClampedArray[]>([]);
  const [idDraft, setIdDraft] = useState<string>('');
  const [idError, setIdError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paintingRef = useRef(false);
  const strokeStartRef = useRef<Uint8ClampedArray | null>(null);
  const pixelsRef = useRef(pixels);
  pixelsRef.current = pixels;

  // Tracks the last dataUrl committed by this editor so self-edits never reset undo history
  const selfCommittedUrlRef = useRef<string | null>(null);
  const loadedIndexRef = useRef<number>(-1);

  const safeIndex =
    manifest.sprites.length === 0
      ? -1
      : Math.max(0, Math.min(selectedIndex, manifest.sprites.length - 1));
  const selectedSprite = safeIndex >= 0 ? manifest.sprites[safeIndex] : undefined;

  // Keep selectedIndex clamped if external manifest changes shrink sprites
  useEffect(() => {
    if (safeIndex !== selectedIndex && safeIndex >= 0) {
      setSelectedIndex(safeIndex);
    }
  }, [safeIndex, selectedIndex]);

  // Sync ID draft when switching sprites (not while typing into the same sprite)
  useEffect(() => {
    setIdDraft(selectedSprite?.id ?? '');
    setIdError(null);
  }, [safeIndex, selectedSprite?.id]);

  // Load selected sprite into pixel buffer ONLY when switching sprites or external dataUrl changes
  useEffect(() => {
    if (!selectedSprite) {
      const empty = new Uint8ClampedArray(BUFFER_LEN);
      pixelsRef.current = empty;
      setPixels(empty);
      setHistory([]);
      setFuture([]);
      loadedIndexRef.current = -1;
      return;
    }

    const sameSprite = loadedIndexRef.current === safeIndex;
    if (sameSprite && selfCommittedUrlRef.current === selectedSprite.dataUrl) {
      return;
    }

    loadedIndexRef.current = safeIndex;
    let cancelled = false;
    decodeDataUrlToRgba32(selectedSprite.dataUrl).then((rgba) => {
      if (!cancelled) {
        const buf = new Uint8ClampedArray(rgba);
        pixelsRef.current = buf;
        setPixels(buf);
        setHistory([]);
        setFuture([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [safeIndex, selectedSprite?.dataUrl]);

  // Render 32×32 buffer to crisp 576×576 interactive canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_PIXELS, CANVAS_PIXELS);

    // Checkerboard transparency backdrop
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#111824' : '#182334';
        ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
    }

    // Pixels
    const buf = pixels;
    if (buf && buf.length === BUFFER_LEN) {
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const idx = (y * 32 + x) * 4;
          const a = buf[idx + 3];
          if (a === 0) continue;
          ctx.fillStyle = `rgba(${buf[idx]},${buf[idx + 1]},${buf[idx + 2]},${a / 255})`;
          ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
        }
      }
    }

    // Dual-tone high-contrast dashed grid (visible on pure white, gray, black, and all hues)
    if (showGrid) {
      ctx.save();
      ctx.lineWidth = 1;

      const drawGridLines = (
        stroke: string,
        dash: number[],
        offset: number,
        step: number
      ) => {
        ctx.strokeStyle = stroke;
        ctx.setLineDash(dash);
        ctx.lineDashOffset = offset;
        ctx.beginPath();
        for (let i = step; i < 32; i += step) {
          const p = i * CELL_PX + 0.5;
          ctx.moveTo(p, 0);
          ctx.lineTo(p, CANVAS_PIXELS);
          ctx.moveTo(0, p);
          ctx.lineTo(CANVAS_PIXELS, p);
        }
        ctx.stroke();
      };

      // Minor 1-pixel dual-contrast dashed lines
      drawGridLines('rgba(0, 0, 0, 0.45)', [3, 3], 0, 1);
      drawGridLines('rgba(255, 255, 255, 0.42)', [3, 3], 3, 1);

      // Major 8-pixel quadrant guide lines for alignment
      drawGridLines('rgba(0, 0, 0, 0.65)', [], 0, 8);
      ctx.restore();
    }
  }, [pixels, showGrid]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const commitPixelsToManifest = useCallback(
    (nextBuf: Uint8ClampedArray) => {
      if (readOnly || safeIndex < 0 || !nextBuf || nextBuf.length !== BUFFER_LEN) {
        return;
      }
      const dataUrl = encodeRgbaToPngDataUrl(
        new Uint8Array(nextBuf.buffer, nextBuf.byteOffset, nextBuf.byteLength),
        32,
        32
      );
      selfCommittedUrlRef.current = dataUrl;
      onChange({
        ...manifest,
        sprites: manifest.sprites.map((sp, i) =>
          i === safeIndex ? { ...sp, dataUrl } : sp
        ),
      });
    },
    [manifest, onChange, readOnly, safeIndex]
  );

  const pushHistoryAndCommit = useCallback(
    (nextBuf: Uint8ClampedArray) => {
      const beforeSnap = new Uint8ClampedArray(pixelsRef.current);
      setHistory((prev) => [...prev.slice(-29), beforeSnap]);
      setFuture([]);
      pixelsRef.current = nextBuf;
      setPixels(nextBuf);
      commitPixelsToManifest(nextBuf);
    },
    [commitPixelsToManifest]
  );

  const handleUndo = useCallback(() => {
    if (readOnly || history.length === 0) return;
    const prevSnap = history[history.length - 1];
    if (!prevSnap || prevSnap.length !== BUFFER_LEN) {
      setHistory((h) => h.slice(0, -1));
      return;
    }
    const currentSnap = new Uint8ClampedArray(pixelsRef.current);
    const restored = new Uint8ClampedArray(prevSnap);
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [currentSnap, ...f.slice(0, 29)]);
    pixelsRef.current = restored;
    setPixels(restored);
    commitPixelsToManifest(restored);
  }, [readOnly, history, commitPixelsToManifest]);

  const handleRedo = useCallback(() => {
    if (readOnly || future.length === 0) return;
    const nextSnap = future[0];
    if (!nextSnap || nextSnap.length !== BUFFER_LEN) {
      setFuture((f) => f.slice(1));
      return;
    }
    const currentSnap = new Uint8ClampedArray(pixelsRef.current);
    const restored = new Uint8ClampedArray(nextSnap);
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h.slice(-29), currentSnap]);
    pixelsRef.current = restored;
    setPixels(restored);
    commitPixelsToManifest(restored);
  }, [readOnly, future, commitPixelsToManifest]);

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z shortcuts for sprite editor
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, handleUndo, handleRedo]);

  const applyFloodFill = (
    buf: Uint8ClampedArray,
    startX: number,
    startY: number,
    rgba: [number, number, number, number]
  ): Uint8ClampedArray => {
    const next = new Uint8ClampedArray(buf);
    const sIdx = (startY * 32 + startX) * 4;
    const sr = next[sIdx];
    const sg = next[sIdx + 1];
    const sb = next[sIdx + 2];
    const sa = next[sIdx + 3];
    if (sr === rgba[0] && sg === rgba[1] && sb === rgba[2] && sa === rgba[3]) {
      return next;
    }

    const queue: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(32 * 32);
    visited[startY * 32 + startX] = 1;

    while (queue.length > 0) {
      const [cx, cy] = queue.pop()!;
      const idx = (cy * 32 + cx) * 4;
      next[idx] = rgba[0];
      next[idx + 1] = rgba[1];
      next[idx + 2] = rgba[2];
      next[idx + 3] = rgba[3];

      const dirs = [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ];
      for (const [nx, ny] of dirs) {
        if (nx < 0 || ny < 0 || nx >= 32 || ny >= 32) continue;
        const pIdx = ny * 32 + nx;
        if (visited[pIdx]) continue;
        const cIdx = pIdx * 4;
        if (
          next[cIdx] === sr &&
          next[cIdx + 1] === sg &&
          next[cIdx + 2] === sb &&
          next[cIdx + 3] === sa
        ) {
          visited[pIdx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
    return next;
  };

  const getPixelCoord = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * 32);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * 32);
    if (x < 0 || y < 0 || x >= 32 || y >= 32) return null;
    return { x, y };
  };

  const paintAt = (x: number, y: number, activeTool: PixelTool) => {
    if (activeTool === 'eyedropper') {
      const idx = (y * 32 + x) * 4;
      if (pixelsRef.current[idx + 3] > 0) {
        setColor(
          rgbaToHex(
            pixelsRef.current[idx],
            pixelsRef.current[idx + 1],
            pixelsRef.current[idx + 2]
          )
        );
        setTool('pencil');
      }
      return;
    }

    if (readOnly) return;

    if (activeTool === 'fill') {
      const filled = applyFloodFill(pixelsRef.current, x, y, hexToRgba(color));
      pushHistoryAndCommit(filled);
      return;
    }

    const next = new Uint8ClampedArray(pixelsRef.current);
    const idx = (y * 32 + x) * 4;
    if (activeTool === 'eraser') {
      next[idx] = 0;
      next[idx + 1] = 0;
      next[idx + 2] = 0;
      next[idx + 3] = 0;
    } else {
      const [r, g, b, a] = hexToRgba(color);
      next[idx] = r;
      next[idx + 1] = g;
      next[idx + 2] = b;
      next[idx + 3] = a;
    }
    // Update ref synchronously so rapid single-click pointerUp commits the painted pixel
    pixelsRef.current = next;
    setPixels(next);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getPixelCoord(e);
    if (!pt) return;
    if (tool === 'eyedropper' || tool === 'fill') {
      paintAt(pt.x, pt.y, tool);
      return;
    }
    if (readOnly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    paintingRef.current = true;
    strokeStartRef.current = new Uint8ClampedArray(pixelsRef.current);
    paintAt(pt.x, pt.y, e.button === 2 ? 'eraser' : tool);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!paintingRef.current || readOnly) return;
    const pt = getPixelCoord(e);
    if (!pt) return;
    paintAt(pt.x, pt.y, (e.buttons & 2) !== 0 ? 'eraser' : tool);
  };

  const handleCanvasPointerUp = () => {
    if (!paintingRef.current) return;
    paintingRef.current = false;
    // Capture snapshot BEFORE clearing ref (functional updaters run asynchronously in React!)
    const startSnap = strokeStartRef.current;
    strokeStartRef.current = null;
    if (startSnap && startSnap.length === BUFFER_LEN) {
      setHistory((prev) => [...prev.slice(-29), startSnap]);
      setFuture([]);
      commitPixelsToManifest(pixelsRef.current);
    }
  };

  const handleFlip = (axis: 'h' | 'v') => {
    if (readOnly) return;
    const src = pixelsRef.current;
    const out = new Uint8ClampedArray(BUFFER_LEN);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = axis === 'h' ? 31 - x : x;
        const dy = axis === 'v' ? 31 - y : y;
        const si = (y * 32 + x) * 4;
        const di = (dy * 32 + dx) * 4;
        out[di] = src[si];
        out[di + 1] = src[si + 1];
        out[di + 2] = src[si + 2];
        out[di + 3] = src[si + 3];
      }
    }
    pushHistoryAndCommit(out);
  };

  const handleClear = () => {
    if (readOnly) return;
    pushHistoryAndCommit(new Uint8ClampedArray(BUFFER_LEN));
  };

  const handleNewSprite = () => {
    if (readOnly) return;
    const id = makeUniqueId(
      'sprite',
      manifest.sprites.map((s) => s.id)
    );
    const blank = new Uint8Array(BUFFER_LEN);
    const sp: SpriteAssetManifest = {
      id,
      name: `Sprite ${manifest.sprites.length + 1}`,
      width: 32,
      height: 32,
      dataUrl: encodeRgbaToPngDataUrl(blank, 32, 32),
    };
    const nextSprites = [...manifest.sprites, sp];
    onChange({ ...manifest, sprites: nextSprites });
    setSelectedIndex(nextSprites.length - 1);
  };

  const handleUploadPng = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || readOnly) return;
    try {
      const dataUrl = await importImageFileAsPng32(file);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const id = makeUniqueId(
        baseName,
        manifest.sprites.map((s) => s.id)
      );
      const sp: SpriteAssetManifest = {
        id,
        name: baseName || id,
        width: 32,
        height: 32,
        dataUrl,
      };
      const nextSprites = [...manifest.sprites, sp];
      onChange({ ...manifest, sprites: nextSprites });
      setSelectedIndex(nextSprites.length - 1);
    } catch {
      // Ignore corrupt image files
    }
  };

  const handleDuplicateSprite = () => {
    if (readOnly || !selectedSprite) return;
    const id = makeUniqueId(
      `${selectedSprite.id}_copy`,
      manifest.sprites.map((s) => s.id)
    );
    const copy: SpriteAssetManifest = {
      ...selectedSprite,
      id,
      name: `${selectedSprite.name} Copy`,
    };
    const nextSprites = [...manifest.sprites, copy];
    onChange({ ...manifest, sprites: nextSprites });
    setSelectedIndex(nextSprites.length - 1);
  };

  const handleDeleteSprite = (idxToDelete: number) => {
    if (readOnly) return;
    const nextSprites = manifest.sprites.filter((_, i) => i !== idxToDelete);
    onChange({ ...manifest, sprites: nextSprites });
    if (nextSprites.length === 0) {
      setSelectedIndex(0);
    } else if (safeIndex >= nextSprites.length) {
      setSelectedIndex(nextSprites.length - 1);
    } else if (idxToDelete < safeIndex) {
      setSelectedIndex(safeIndex - 1);
    }
  };

  const handleRenameSpriteName = (nextName: string) => {
    if (readOnly || safeIndex < 0) return;
    onChange({
      ...manifest,
      sprites: manifest.sprites.map((s, i) =>
        i === safeIndex ? { ...s, name: nextName } : s
      ),
    });
  };

  const handleChangeIdDraft = (rawNext: string) => {
    setIdDraft(rawNext);
    if (readOnly || safeIndex < 0 || !selectedSprite) return;
    const trimmed = rawNext.trim();
    if (!trimmed) {
      setIdError('ID cannot be empty');
      return;
    }
    const isDup = manifest.sprites.some(
      (s, i) => i !== safeIndex && s.id === trimmed
    );
    if (isDup) {
      setIdError('Duplicate sprite ID');
      return;
    }
    setIdError(null);
    const oldId = selectedSprite.id;
    if (trimmed === oldId) return;

    // Cascade rename across sprites, cellTypes, and cell.setSprite nodes
    onChange({
      ...manifest,
      sprites: manifest.sprites.map((s, i) =>
        i === safeIndex ? { ...s, id: trimmed } : s
      ),
      cellTypes: manifest.cellTypes.map((ct) => ({
        ...ct,
        defaultSpriteId:
          ct.defaultSpriteId === oldId ? trimmed : ct.defaultSpriteId,
        substrateSpriteId:
          ct.substrateSpriteId === oldId ? trimmed : ct.substrateSpriteId,
        graph: cascadeSpriteRenameInGraph(ct.graph, oldId, trimmed) ?? ct.graph,
      })),
      globalState: {
        ...manifest.globalState,
        graph:
          cascadeSpriteRenameInGraph(manifest.globalState.graph, oldId, trimmed) ??
          manifest.globalState.graph,
      },
      interfaces: manifest.interfaces.map((iface) => ({
        ...iface,
        graph: cascadeSpriteRenameInGraph(iface.graph, oldId, trimmed),
      })),
    });
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left: Sprite Asset Library */}
      <aside className="w-64 shrink-0 border-r border-[#1F2A38] bg-[#111720] flex flex-col min-h-0">
        <div className="p-3 border-b border-[#1F2A38] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#E6EDF3]">
              Sprites ({manifest.sprites.length})
            </span>
            <span className="font-mono text-[10px] text-[#8B98A9]">32×32 PNG</span>
          </div>
          {!readOnly && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleNewSprite}
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload PNG</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/*"
                onChange={handleUploadPng}
                className="hidden"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {manifest.sprites.map((sp, idx) => {
            const active = idx === safeIndex;
            return (
              <div
                key={idx}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors ${
                  active
                    ? 'bg-[#17202B] border-[#10B981]'
                    : 'bg-transparent border-transparent hover:bg-[#17202B]/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <img
                    src={sp.dataUrl}
                    alt={sp.name}
                    className="w-7 h-7 border border-white/10 bg-[#0B0F14] shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#E6EDF3] truncate">
                      {sp.name}
                    </div>
                    <div className="font-mono text-[10px] text-[#8B98A9] truncate">
                      {sp.id}
                    </div>
                  </div>
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSprite(idx)}
                    title="Delete sprite"
                    className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right: Built-in 32×32 Pixel-Art Editor */}
      {selectedSprite ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl flex flex-col lg:flex-row gap-6 items-start">
            {/* Pixel Canvas Column */}
            <div className="space-y-3">
              {/* Tools Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111720] border border-[#1F2A38] rounded-md p-1.5">
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'pencil', icon: Pencil, label: 'Pencil' },
                      { id: 'eraser', icon: Eraser, label: 'Eraser' },
                      { id: 'fill', icon: PaintBucket, label: 'Fill' },
                      { id: 'eyedropper', icon: Pipette, label: 'Pick Color' },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = tool === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTool(item.id)}
                        title={item.label}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#10B981] text-[#0B0F14] font-semibold'
                            : 'text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowGrid((g) => !g)}
                    title="Toggle pixel grid"
                    className={`p-1.5 rounded cursor-pointer ${
                      showGrid
                        ? 'bg-[#17202B] text-[#E6EDF3]'
                        : 'text-[#8B98A9] hover:text-[#E6EDF3]'
                    }`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                  </button>
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        disabled={history.length === 0}
                        onClick={handleUndo}
                        title="Undo (Ctrl+Z)"
                        className="p-1.5 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-40 rounded cursor-pointer"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={future.length === 0}
                        onClick={handleRedo}
                        title="Redo (Ctrl+Y)"
                        className="p-1.5 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-40 rounded cursor-pointer"
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlip('h')}
                        title="Flip horizontally"
                        className="p-1.5 text-[#8B98A9] hover:text-[#E6EDF3] rounded cursor-pointer"
                      >
                        <FlipHorizontal2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlip('v')}
                        title="Flip vertically"
                        className="p-1.5 text-[#8B98A9] hover:text-[#E6EDF3] rounded cursor-pointer"
                      >
                        <FlipVertical2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleClear}
                        className="px-2 py-1 text-[11px] text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded cursor-pointer"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Large Square-Corner Crisp Interactive Canvas (Zero rounded corners) */}
              <div className="inline-block border border-[#2D3C4E] rounded-none bg-[#0B0F14] shadow-xl">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_PIXELS}
                  height={CANVAS_PIXELS}
                  onContextMenu={(e) => e.preventDefault()}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  style={{ imageRendering: 'pixelated' }}
                  className="block w-[480px] h-[480px] sm:w-[576px] sm:h-[576px] xl:w-[640px] xl:h-[640px] cursor-crosshair touch-none"
                />
              </div>
            </div>

            {/* Right Controls: Metadata, Color Picker, Live Scale Preview */}
            <div className="w-full lg:w-64 space-y-5">
              <div className="space-y-3 bg-[#111720] border border-[#1F2A38] rounded-md p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E6EDF3]">
                    Sprite Metadata
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={handleDuplicateSprite}
                      title="Duplicate sprite"
                      className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] text-[#8B98A9] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={selectedSprite.name}
                    onChange={(e) => handleRenameSpriteName(e.target.value)}
                    className="w-full bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded px-2.5 py-1.5 text-xs text-[#E6EDF3] focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8B98A9] mb-1">
                    Asset ID
                  </label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={idDraft}
                    onChange={(e) => handleChangeIdDraft(e.target.value)}
                    onBlur={() => {
                      if (idError) {
                        setIdDraft(selectedSprite.id);
                        setIdError(null);
                      }
                    }}
                    className={`w-full bg-[#0B0F14] border rounded px-2.5 py-1.5 text-xs font-mono text-[#E6EDF3] focus:outline-none disabled:opacity-60 ${
                      idError
                        ? 'border-[#F43F5E]'
                        : 'border-[#1F2A38] focus:border-[#10B981]'
                    }`}
                  />
                  {idError && (
                    <p className="text-[10px] text-[#F43F5E] mt-1">{idError}</p>
                  )}
                </div>
              </div>

              {/* Color & Palette */}
              <div className="space-y-3 bg-[#111720] border border-[#1F2A38] rounded-md p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#E6EDF3]">
                    Brush Color
                  </span>
                  <span className="font-mono text-[11px] text-[#8B98A9]">
                    {color}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    disabled={readOnly}
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-8 bg-transparent border border-[#1F2A38] rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    disabled={readOnly}
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="flex-1 bg-[#0B0F14] border border-[#1F2A38] rounded px-2.5 py-1.5 text-xs font-mono text-[#E6EDF3]"
                  />
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {QUICK_PALETTE.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => {
                        setColor(swatch);
                        if (tool === 'eraser') setTool('pencil');
                      }}
                      style={{ backgroundColor: swatch }}
                      className={`h-6 rounded border cursor-pointer ${
                        color.toLowerCase() === swatch.toLowerCase()
                          ? 'border-white ring-1 ring-[#10B981]'
                          : 'border-white/15'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Live 1× / 2× Scale Preview */}
              <div className="space-y-2.5 bg-[#111720] border border-[#1F2A38] rounded-md p-3.5">
                <span className="text-xs font-semibold text-[#E6EDF3]">
                  Live Tile Preview
                </span>
                <div className="flex items-end gap-3 pt-1">
                  <div className="text-center">
                    <img
                      src={selectedSprite.dataUrl}
                      alt=""
                      className="w-8 h-8 border border-[#2D3C4E] bg-[#0B0F14] mx-auto"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <span className="font-mono text-[10px] text-[#8B98A9]">1×</span>
                  </div>
                  <div className="text-center">
                    <img
                      src={selectedSprite.dataUrl}
                      alt=""
                      className="w-16 h-16 border border-[#2D3C4E] bg-[#0B0F14] mx-auto"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <span className="font-mono text-[10px] text-[#8B98A9]">2×</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-[#8B98A9]">
          Create or upload a 32×32 PNG sprite to begin.
        </div>
      )}
    </div>
  );
}
