import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Dices, Plus, Trash2 } from 'lucide-react';
import { SimulationCore } from '../../engine/SimulationCore';
import {
  GeneratorStep,
  RulesetManifest,
  generateRandomSeed,
  validateRulesetManifest,
} from '../../engine/sdk';
import { BASE_CELL_SIZE, renderGridScene } from '../canvasRenderer';
import {
  MONO_INPUT_CLS,
  SELECT_CLS,
  createDefaultGeneratorStep,
  moveArrayItem,
} from './editorHelpers';

interface GeneratorSectionProps {
  manifest: RulesetManifest;
  onChange: (next: RulesetManifest) => void;
}

export function GeneratorSection({ manifest, onChange }: GeneratorSectionProps) {
  const [previewSeed, setPreviewSeed] = useState<string>(() =>
    generateRandomSeed()
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setupParams = manifest.setupOptions?.params ?? [];

  const updateStep = (idx: number, next: GeneratorStep) => {
    const copy = [...manifest.worldGenerator];
    copy[idx] = next;
    onChange({ ...manifest, worldGenerator: copy });
  };

  const addStep = (type: GeneratorStep['type']) => {
    onChange({
      ...manifest,
      worldGenerator: [
        ...manifest.worldGenerator,
        createDefaultGeneratorStep(type, manifest),
      ],
    });
  };

  const removeStep = (idx: number) => {
    onChange({
      ...manifest,
      worldGenerator: manifest.worldGenerator.filter((_, i) => i !== idx),
    });
  };

  // Build live preview SimulationCore safely whenever generator or seed changes
  const previewCore = useMemo(() => {
    const validation = validateRulesetManifest(manifest);
    if (!validation.valid) return null;
    try {
      const defaultParams: Record<string, string | number | boolean> = {};
      for (const p of manifest.setupOptions?.params ?? []) {
        defaultParams[p.id] = p.defaultValue;
      }
      const w = Math.min(32, Math.max(8, manifest.defaultGridSize.width));
      const h = Math.min(24, Math.max(8, manifest.defaultGridSize.height));
      return SimulationCore.createNewGame(manifest, {
        width: w,
        height: h,
        seed: previewSeed,
        params: defaultParams,
      });
    } catch {
      return null;
    }
  }, [manifest, previewSeed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewCore) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = 340;
    const vh = 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);

    const padding = 14;
    const cellW = (vw - padding * 2) / previewCore.width;
    const cellH = (vh - padding * 2) / previewCore.height;
    const cellSize = Math.min(cellW, cellH);
    const zoom = cellSize / BASE_CELL_SIZE;
    const boardW = previewCore.width * cellSize;
    const boardH = previewCore.height * cellSize;

    renderGridScene({
      ctx,
      viewportWidth: vw,
      viewportHeight: vh,
      dpr,
      camera: {
        zoom,
        offsetX: (vw - boardW) / 2,
        offsetY: (vh - boardH) / 2,
      },
      core: previewCore,
      overlayMode: 'off',
      activeSupplyId: null,
      selectedCell: null,
      highlightedCell: null,
      hoveredCell: null,
      previewCellTypeId: null,
    });
  }, [previewCore]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_364px] gap-6 items-start">
      {/* Left: Pipeline Steps */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#E6EDF3]">
              World Generator Pipeline
            </h2>
            <p className="text-xs text-[#8B98A9] mt-0.5">
              Steps run in order on every new game using deterministic seeded RNG.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {(['fill', 'clusters', 'scatter', 'placeNear'] as const).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addStep(type)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  <span>{type}</span>
                </button>
              )
            )}
          </div>
        </div>

        {manifest.worldGenerator.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-[#1F2A38] rounded-md">
            <p className="text-xs text-[#8B98A9]">
              Add a Fill step and terrain steps to generate maps.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {manifest.worldGenerator.map((step, idx) => (
              <div
                key={idx}
                className="bg-[#111720] border border-[#1F2A38] rounded-lg p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums text-xs text-[#8B98A9]">
                      #{idx + 1}
                    </span>
                    <select
                      value={step.type}
                      onChange={(e) =>
                        updateStep(
                          idx,
                          createDefaultGeneratorStep(
                            e.target.value as GeneratorStep['type'],
                            manifest
                          )
                        )
                      }
                      className={`${SELECT_CLS} font-semibold`}
                      aria-label="Step type"
                    >
                      <option value="fill">Fill Grid</option>
                      <option value="clusters">Clusters</option>
                      <option value="scatter">Scatter</option>
                      <option value="placeNear">Place Near</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        onChange({
                          ...manifest,
                          worldGenerator: moveArrayItem(
                            manifest.worldGenerator,
                            idx,
                            idx - 1
                          ),
                        })
                      }
                      aria-label="Move step up"
                      className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === manifest.worldGenerator.length - 1}
                      onClick={() =>
                        onChange({
                          ...manifest,
                          worldGenerator: moveArrayItem(
                            manifest.worldGenerator,
                            idx,
                            idx + 1
                          ),
                        })
                      }
                      aria-label="Move step down"
                      className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      aria-label="Remove step"
                      className="p-1 text-[#8B98A9] hover:text-[#F43F5E] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-[#1F2A38]">
                  <div>
                    <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                      Cell Type
                    </span>
                    <select
                      value={step.cell}
                      onChange={(e) =>
                        updateStep(idx, { ...step, cell: e.target.value })
                      }
                      className={SELECT_CLS}
                    >
                      {manifest.cellTypes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {step.type === 'clusters' && (
                    <>
                      <div className="w-24">
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Per 768 tiles
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={step.clustersPer768}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              clustersPer768: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <div className="w-20">
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Min Size
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={step.minSize}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              minSize: Math.max(1, Number(e.target.value)),
                            })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <div className="w-20">
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Max Size
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={step.maxSize}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              maxSize: Math.max(1, Number(e.target.value)),
                            })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <div className="w-20">
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Min Count
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={step.minClusters ?? 1}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              minClusters: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      {setupParams.length > 0 && (
                        <div>
                          <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                            Density Param
                          </span>
                          <select
                            value={step.densityParam ?? ''}
                            onChange={(e) =>
                              updateStep(idx, {
                                ...step,
                                densityParam: e.target.value || undefined,
                              })
                            }
                            className={SELECT_CLS}
                          >
                            <option value="">None</option>
                            {setupParams.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label} ({p.id})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <label className="inline-flex items-center gap-1.5 text-xs text-[#8B98A9] pb-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.onlyOnEmpty !== false}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              onlyOnEmpty: e.target.checked,
                            })
                          }
                          className="accent-[#10B981]"
                        />
                        <span>Only on default</span>
                      </label>
                    </>
                  )}

                  {step.type === 'scatter' && (
                    <>
                      <div className="w-24">
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Per 768 tiles
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={step.countPer768}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              countPer768: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <div className="w-20">
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Min Count
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={step.minCount ?? 0}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              minCount: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-xs text-[#8B98A9] pb-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.onlyOnEmpty !== false}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              onlyOnEmpty: e.target.checked,
                            })
                          }
                          className="accent-[#10B981]"
                        />
                        <span>Only on default</span>
                      </label>
                    </>
                  )}

                  {step.type === 'placeNear' && (
                    <>
                      <div>
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Near Cell
                        </span>
                        <select
                          value={step.nearCell}
                          onChange={(e) =>
                            updateStep(idx, { ...step, nearCell: e.target.value })
                          }
                          className={SELECT_CLS}
                        >
                          {manifest.cellTypes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.id})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-16">
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Radius
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={step.radius ?? 1}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              radius: Math.max(1, Number(e.target.value)),
                            })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <div className="w-20">
                        <span className="block text-[10px] text-[#8B98A9] mb-0.5">
                          Chance (0–1)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={step.chance}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              chance: Math.max(
                                0,
                                Math.min(1, Number(e.target.value))
                              ),
                            })
                          }
                          className={`${MONO_INPUT_CLS} w-full`}
                        />
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-xs text-[#8B98A9] pb-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.onlyOnEmpty !== false}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              onlyOnEmpty: e.target.checked,
                            })
                          }
                          className="accent-[#10B981]"
                        />
                        <span>Only on default</span>
                      </label>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Live Map Preview */}
      <aside className="bg-[#111720] border border-[#1F2A38] rounded-lg p-3 space-y-3 sticky top-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[#E6EDF3]">
              Map Preview
            </div>
            <div className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
              {Math.min(32, Math.max(8, manifest.defaultGridSize.width))}×
              {Math.min(24, Math.max(8, manifest.defaultGridSize.height))} ·{' '}
              {previewSeed}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPreviewSeed(generateRandomSeed())}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Roll Seed</span>
          </button>
        </div>

        {previewCore ? (
          <canvas
            ref={canvasRef}
            className="w-[340px] h-[260px] rounded border border-[#1F2A38] block mx-auto"
          />
        ) : (
          <div className="w-[340px] h-[260px] rounded border border-dashed border-[#F43F5E]/40 bg-[#0B0F14] flex items-center justify-center text-center px-6">
            <p className="text-xs text-[#F43F5E]">
              Fix validation errors to preview generated map.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
