import { useEffect, useMemo, useRef, useState } from 'react';
import { Dices, PanelRightClose, PanelRightOpen } from 'lucide-react';
import {
  generateRandomSeed,
  RulesetManifest,
  RuntimeValue,
  runWorldGeneratorGraph,
} from '../../engine/sdk';
import { NodeGraphEditor } from './NodeGraphEditor';

interface WorldGeneratorTabProps {
  manifest: RulesetManifest;
  readOnly?: boolean;
  onChange: (updater: (prev: RulesetManifest) => RulesetManifest) => void;
}

type SizePreset = 'default' | '10' | '14' | '20';

function buildDefaultSetupParams(
  manifest: RulesetManifest
): Record<string, RuntimeValue> {
  const out: Record<string, RuntimeValue> = {};
  for (const opt of manifest.setupOptions ?? []) {
    out[opt.id] = opt.defaultValue;
  }
  return out;
}

export function WorldGeneratorTab({
  manifest,
  readOnly = false,
  onChange,
}: WorldGeneratorTabProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [seed, setSeed] = useState<string>('PREVIEW-1');
  const [sizePreset, setSizePreset] = useState<SizePreset>('default');
  const [setupParams, setSetupParams] = useState<Record<string, RuntimeValue>>(
    () => buildDefaultSetupParams(manifest)
  );
  const [spritesReadyTick, setSpritesReadyTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Sync newly added setup options without clobbering user adjustments
  useEffect(() => {
    setSetupParams((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const opt of manifest.setupOptions ?? []) {
        if (!(opt.id in next)) {
          next[opt.id] = opt.defaultValue;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [manifest.setupOptions]);

  // Cache 32x32 sprite images for crisp canvas rendering
  useEffect(() => {
    let active = true;
    const cache = imageCacheRef.current;
    const currentKeys = new Set<string>();

    for (const sprite of manifest.sprites) {
      const cacheKey = `${sprite.id}::${sprite.dataUrl}`;
      currentKeys.add(cacheKey);
      if (!cache.has(cacheKey)) {
        const img = new Image();
        img.onload = () => {
          if (active) setSpritesReadyTick((t) => t + 1);
        };
        img.src = sprite.dataUrl;
        cache.set(cacheKey, img);
      }
    }

    for (const key of Array.from(cache.keys())) {
      if (!currentKeys.has(key)) {
        cache.delete(key);
      }
    }

    return () => {
      active = false;
    };
  }, [manifest.sprites]);

  const previewDims = useMemo(() => {
    if (sizePreset === '10') return { width: 10, height: 10 };
    if (sizePreset === '14') return { width: 14, height: 14 };
    if (sizePreset === '20') return { width: 20, height: 20 };
    return {
      width: Math.max(4, Math.min(48, manifest.defaultGridSize.width || 12)),
      height: Math.max(4, Math.min(48, manifest.defaultGridSize.height || 12)),
    };
  }, [sizePreset, manifest.defaultGridSize.width, manifest.defaultGridSize.height]);

  const generated = useMemo(() => {
    const { width, height } = previewDims;
    const grid = new Uint16Array(width * height);
    const cellIndexById = new Map<string, number>();
    manifest.cellTypes.forEach((ct, idx) => cellIndexById.set(ct.id, idx));
    const defaultCellIndex = cellIndexById.get(manifest.defaultCellTypeId) ?? 0;

    try {
      runWorldGeneratorGraph(manifest.worldGenerator, grid, {
        width,
        height,
        seed: seed.trim() || 'PREVIEW-1',
        setupValues: setupParams,
        cellIndexById,
        defaultCellIndex,
      });
    } catch {
      grid.fill(defaultCellIndex);
    }

    const counts = new Map<number, number>();
    for (let i = 0; i < grid.length; i++) {
      counts.set(grid[i], (counts.get(grid[i]) ?? 0) + 1);
    }

    return { width, height, grid, counts };
  }, [
    manifest.worldGenerator,
    manifest.cellTypes,
    manifest.defaultCellTypeId,
    previewDims,
    seed,
    setupParams,
  ]);

  // Draw crisp pixel-art map preview
  useEffect(() => {
    if (!showPreview) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, grid } = generated;
    const size = 256;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0B0F14';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;

    const tileSize = Math.floor(Math.min(size / width, size / height));
    const drawW = tileSize * width;
    const drawH = tileSize * height;
    const ox = Math.floor((size - drawW) / 2);
    const oy = Math.floor((size - drawH) / 2);

    const spriteById = new Map(manifest.sprites.map((s) => [s.id, s]));
    const cache = imageCacheRef.current;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellType = manifest.cellTypes[grid[y * width + x]];
        const px = ox + x * tileSize;
        const py = oy + y * tileSize;

        if (!cellType) {
          ctx.fillStyle = '#17202B';
          ctx.fillRect(px, py, tileSize, tileSize);
          continue;
        }

        // Base fill
        ctx.fillStyle = cellType.defaultColor || '#2C3440';
        ctx.fillRect(px, py, tileSize, tileSize);

        // Optional substrate sprite
        if (cellType.substrateSpriteId) {
          const sub = spriteById.get(cellType.substrateSpriteId);
          if (sub) {
            const subImg = cache.get(`${sub.id}::${sub.dataUrl}`);
            if (subImg && subImg.complete && subImg.naturalWidth > 0) {
              ctx.drawImage(subImg, px, py, tileSize, tileSize);
            }
          }
        }

        // Primary sprite
        if (cellType.defaultSpriteId) {
          const sp = spriteById.get(cellType.defaultSpriteId);
          if (sp) {
            const spImg = cache.get(`${sp.id}::${sp.dataUrl}`);
            if (spImg && spImg.complete && spImg.naturalWidth > 0) {
              ctx.globalAlpha = cellType.defaultOpacity ?? 1;
              ctx.drawImage(spImg, px, py, tileSize, tileSize);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    }

    // Subtle hairline grid lines
    ctx.strokeStyle = 'rgba(11, 15, 20, 0.35)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      const lx = ox + x * tileSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(lx, oy);
      ctx.lineTo(lx, oy + drawH);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      const ly = oy + y * tileSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(ox, ly);
      ctx.lineTo(ox + drawW, ly);
      ctx.stroke();
    }
  }, [generated, manifest.cellTypes, manifest.sprites, spritesReadyTick, showPreview]);

  const spriteById = useMemo(
    () => new Map(manifest.sprites.map((s) => [s.id, s])),
    [manifest.sprites]
  );

  const totalTiles = generated.width * generated.height;

  const distribution = useMemo(() => {
    return manifest.cellTypes
      .map((ct, idx) => ({
        cellType: ct,
        count: generated.counts.get(idx) ?? 0,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [manifest.cellTypes, generated.counts]);

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden bg-[#0B0F14]">
      {/* Left/Center: Layer & Mask Node Graph Editor */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {!showPreview && (
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="absolute top-2.5 right-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[#E6EDF3] bg-[#111720] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded transition-colors cursor-pointer"
          >
            <PanelRightOpen className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Map Preview</span>
          </button>
        )}

        <NodeGraphEditor
          graph={manifest.worldGenerator}
          scope="generator"
          manifest={manifest}
          readOnly={readOnly}
          onChange={(nextGraph) =>
            onChange((prev) => ({ ...prev, worldGenerator: nextGraph }))
          }
        />
      </div>

      {/* Right: Live Map Preview Panel */}
      {showPreview && (
        <aside className="w-80 shrink-0 border-l border-[#1F2A38] bg-[#111720] flex flex-col min-h-0">
          <div className="h-11 shrink-0 px-3.5 border-b border-[#1F2A38] flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xs font-semibold text-[#E6EDF3] truncate">
                Live Map Preview
              </span>
              <span className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
                {generated.width}×{generated.height}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              title="Hide Map Preview"
              className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] rounded transition-colors cursor-pointer"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {/* Canvas Preview */}
            <div className="flex justify-center">
              <div className="p-1.5 bg-[#0B0F14] border border-[#1F2A38] rounded-md">
                <canvas
                  ref={canvasRef}
                  width={256}
                  height={256}
                  className="block w-[256px] h-[256px]"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>

            {/* Seed Control */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-[#8B98A9]">
                Preview Seed
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="flex-1 min-w-0 bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded px-2.5 py-1.5 text-xs font-mono text-[#E6EDF3] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSeed(generateRandomSeed())}
                  title="Randomize Seed"
                  className="px-2.5 py-1.5 bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded text-[#8B98A9] hover:text-[#E6EDF3] transition-colors cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Preview Grid Size */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-[#8B98A9]">
                Preview Size
              </span>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'default', label: 'Default' },
                    { id: '10', label: '10×10' },
                    { id: '14', label: '14×14' },
                    { id: '20', label: '20×20' },
                  ] as const
                ).map((preset) => {
                  const active = sizePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSizePreset(preset.id)}
                      className={`py-1.5 text-[11px] font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#17202B] border-[#10B981] text-[#E6EDF3]'
                          : 'bg-[#0B0F14] border-[#1F2A38] text-[#8B98A9] hover:text-[#E6EDF3]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Setup Options Live Controls */}
            {(manifest.setupOptions ?? []).length > 0 && (
              <div className="space-y-2.5 pt-3 border-t border-[#1F2A38]">
                <span className="block text-[11px] font-semibold text-[#8B98A9] uppercase tracking-wider">
                  Setup Options
                </span>
                {(manifest.setupOptions ?? []).map((opt) => {
                  const val = setupParams[opt.id] ?? opt.defaultValue;
                  if (opt.type === 'number') {
                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8B98A9] truncate">
                            {opt.label}
                          </span>
                          <span className="font-mono tabular-nums text-[#E6EDF3]">
                            {Number(val)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={opt.min ?? 0}
                          max={opt.max ?? 10}
                          step={opt.step ?? 0.1}
                          value={Number(val)}
                          onChange={(e) =>
                            setSetupParams((prev) => ({
                              ...prev,
                              [opt.id]: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#10B981] cursor-pointer"
                        />
                      </div>
                    );
                  }
                  if (opt.type === 'select' && opt.options) {
                    return (
                      <div key={opt.id} className="space-y-1">
                        <span className="block text-[11px] text-[#8B98A9]">
                          {opt.label}
                        </span>
                        <select
                          value={String(val)}
                          onChange={(e) =>
                            setSetupParams((prev) => ({
                              ...prev,
                              [opt.id]: e.target.value,
                            }))
                          }
                          className="w-full bg-[#0B0F14] border border-[#1F2A38] rounded px-2 py-1 text-xs text-[#E6EDF3] focus:border-[#10B981] focus:outline-none"
                        >
                          {opt.options.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <label
                      key={opt.id}
                      className="flex items-center justify-between gap-2 text-xs text-[#E6EDF3] cursor-pointer"
                    >
                      <span className="text-[11px] text-[#8B98A9]">
                        {opt.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(val)}
                        onChange={(e) =>
                          setSetupParams((prev) => ({
                            ...prev,
                            [opt.id]: e.target.checked,
                          }))
                        }
                        className="accent-[#10B981] cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            )}

            {/* Tile Distribution */}
            <div className="space-y-2 pt-3 border-t border-[#1F2A38]">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-[#8B98A9] uppercase tracking-wider">
                  Distribution
                </span>
                <span className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
                  {totalTiles} tiles
                </span>
              </div>
              <div className="space-y-1.5">
                {distribution.map(({ cellType, count }) => {
                  const pct =
                    totalTiles > 0 ? Math.round((count / totalTiles) * 100) : 0;
                  const sprite = cellType.defaultSpriteId
                    ? spriteById.get(cellType.defaultSpriteId)
                    : undefined;
                  return (
                    <div
                      key={cellType.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-4 h-4 rounded-[2px] border border-[#2D3C4E] shrink-0 overflow-hidden flex items-center justify-center"
                          style={{ backgroundColor: cellType.defaultColor }}
                        >
                          {sprite && (
                            <img
                              src={sprite.dataUrl}
                              alt=""
                              className="w-full h-full"
                              style={{ imageRendering: 'pixelated' }}
                            />
                          )}
                        </div>
                        <span className="text-[#E6EDF3] truncate">
                          {cellType.name}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-[#8B98A9] shrink-0">
                        {count}{' '}
                        <span className="text-[#8B98A9]/70">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
