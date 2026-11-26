import { useRef, useState } from 'react';
import {
  ArrowRight,
  Copy,
  Dices,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { SaveSlot } from '../engine/saveStore';
import {
  RulesetEntry,
  SetupParamManifest,
  WorldSetupValues,
  generateRandomSeed,
} from '../engine/sdk';
import { t } from '../i18n';
import { RulesetImportResult } from '../rulesets';

interface MainMenuProps {
  rulesets: RulesetEntry[];
  saves: SaveSlot[];
  defaultSaveName: string;
  onStartNewGame: (
    rulesetId: string,
    saveName: string,
    setup: WorldSetupValues
  ) => void;
  onLoadSave: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onImportRuleset: (rawJson: string) => RulesetImportResult;
  onDeleteRuleset: (rulesetId: string) => void;
  onCreateRuleset: () => void;
  onEditRuleset: (rulesetId: string) => void;
  onCloneRuleset: (rulesetId: string) => void;
}

function buildDefaultParams(
  params?: SetupParamManifest[]
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const param of params ?? []) {
    result[param.id] = param.defaultValue;
  }
  return result;
}

function findDefaultMapSizeId(entry?: RulesetEntry): string {
  if (!entry) return '';
  const mapSizes = entry.manifest.setupOptions?.mapSizes;
  if (!mapSizes || mapSizes.length === 0) return '';
  const matched =
    mapSizes.find(
      (p) =>
        p.width === entry.manifest.defaultGridSize.width &&
        p.height === entry.manifest.defaultGridSize.height
    ) ?? mapSizes[0];
  return matched?.id ?? '';
}

export function MainMenu({
  rulesets,
  saves,
  defaultSaveName,
  onStartNewGame,
  onLoadSave,
  onDeleteSave,
  onImportRuleset,
  onDeleteRuleset,
  onCreateRuleset,
  onEditRuleset,
  onCloneRuleset,
}: MainMenuProps) {
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>(
    rulesets[0]?.manifest.id ?? ''
  );
  const [saveName, setSaveName] = useState<string>(defaultSaveName);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRuleset =
    rulesets.find((r) => r.manifest.id === selectedRulesetId) ?? rulesets[0];

  const [selectedMapSizeId, setSelectedMapSizeId] = useState<string>(() =>
    findDefaultMapSizeId(selectedRuleset)
  );
  const [seedInput, setSeedInput] = useState<string>('');
  const [paramValues, setParamValues] = useState<
    Record<string, string | number | boolean>
  >(() => buildDefaultParams(selectedRuleset?.manifest.setupOptions?.params));

  const mapSizes = selectedRuleset?.manifest.setupOptions?.mapSizes ?? [];
  const activePreset =
    mapSizes.find((p) => p.id === selectedMapSizeId) ?? mapSizes[0];
  const setupParams = selectedRuleset?.manifest.setupOptions?.params ?? [];
  const allowSeed = Boolean(selectedRuleset?.manifest.setupOptions?.allowSeed);

  const handleSelectRuleset = (entry: RulesetEntry) => {
    setImportErrors([]);
    setSelectedRulesetId(entry.manifest.id);
    setSelectedMapSizeId(findDefaultMapSizeId(entry));
    setParamValues(buildDefaultParams(entry.manifest.setupOptions?.params));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const rawJson = await file.text();
      const result = onImportRuleset(rawJson);
      if (result.ok && result.entry) {
        handleSelectRuleset(result.entry);
      } else {
        setImportErrors(
          result.errors && result.errors.length > 0
            ? result.errors
            : [t('menu.importErrorTitle')]
        );
      }
    } catch {
      setImportErrors([t('menu.importErrorTitle')]);
    }
  };

  const handleDeleteCustomRuleset = (rulesetId: string) => {
    onDeleteRuleset(rulesetId);
    if (selectedRulesetId === rulesetId) {
      const fallback = rulesets.find((r) => r.manifest.id !== rulesetId);
      if (fallback) {
        handleSelectRuleset(fallback);
      }
    }
  };

  const handleParamChange = (
    paramId: string,
    value: string | number | boolean
  ) => {
    setParamValues((prev) => ({ ...prev, [paramId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRuleset) return;
    const width =
      activePreset?.width ?? selectedRuleset.manifest.defaultGridSize.width;
    const height =
      activePreset?.height ?? selectedRuleset.manifest.defaultGridSize.height;
    const seed = seedInput.trim() || generateRandomSeed();

    onStartNewGame(
      selectedRuleset.manifest.id,
      saveName.trim() || defaultSaveName,
      {
        width,
        height,
        seed,
        params: paramValues,
      }
    );
  };

  return (
    <div className="min-h-screen w-screen bg-[#0B0F14] text-[#E6EDF3] flex flex-col overflow-y-auto">
      {/* Top Bar */}
      <header className="h-14 shrink-0 border-b border-[#1F2A38] bg-[#111720] px-6 flex items-center justify-between gap-8">
        <div className="flex items-baseline gap-2.5 whitespace-nowrap shrink-0">
          <span className="text-base font-bold tracking-tight text-[#E6EDF3]">
            gridbound
          </span>
          <span className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
            v0.1.0-alpha
          </span>
        </div>

        <button
          type="button"
          onClick={onCreateRuleset}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
        >
          <Wrench className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
          <span>{t('menu.rulesetStudio')}</span>
        </button>
      </header>

      {/* Main 2-column Tactical Workspace */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: New Game Setup */}
          <section className="lg:col-span-7 bg-[#111720] border border-[#1F2A38] rounded-lg p-6">
            <h1 className="text-base font-semibold text-[#E6EDF3] mb-5">
              {t('menu.newGame')}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="save-name-input"
                  className="block text-xs font-medium text-[#8B98A9] mb-2"
                >
                  {t('menu.saveName')}
                </label>
                <input
                  id="save-name-input"
                  type="text"
                  maxLength={40}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={defaultSaveName}
                  className="w-full bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded-md px-3.5 py-2.5 text-sm text-[#E6EDF3] placeholder:text-[#8B98A9]/60 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-medium text-[#8B98A9]">
                    {t('menu.ruleset')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onCreateRuleset}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
                    >
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      <span>{t('menu.newRuleset')}</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
                    >
                      <Upload className="w-3 h-3" aria-hidden="true" />
                      <span>{t('menu.importJson')}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {rulesets.map((entry) => {
                    const manifest = entry.manifest;
                    const active = manifest.id === selectedRuleset?.manifest.id;
                    return (
                      <div
                        key={manifest.id}
                        className="flex items-stretch gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectRuleset(entry)}
                          className={`flex-1 min-w-0 text-left px-4 py-3 rounded-md border transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                            active
                              ? 'bg-[#17202B] border-[#10B981]'
                              : 'bg-[#0B0F14] border-[#1F2A38] hover:border-[#2D3C4E]'
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold text-[#E6EDF3] truncate">
                              {manifest.name}
                            </span>
                            <span className="font-mono tabular-nums text-xs text-[#8B98A9] shrink-0">
                              {active && activePreset
                                ? `${activePreset.width}×${activePreset.height}`
                                : `${manifest.defaultGridSize.width}×${manifest.defaultGridSize.height}`}
                            </span>
                          </div>
                        </button>

                        {entry.isCustom && (
                          <button
                            type="button"
                            onClick={() => onEditRuleset(manifest.id)}
                            aria-label={t('menu.editRuleset', {
                              name: manifest.name,
                            })}
                            title={t('menu.editRuleset', {
                              name: manifest.name,
                            })}
                            className="px-2.5 text-[#8B98A9] hover:text-[#10B981] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onCloneRuleset(manifest.id)}
                          aria-label={t('menu.cloneRuleset', {
                            name: manifest.name,
                          })}
                          title={t('menu.cloneRuleset', {
                            name: manifest.name,
                          })}
                          className="px-2.5 text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
                        >
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>

                        {entry.isCustom && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteCustomRuleset(manifest.id)
                            }
                            aria-label={t('menu.deleteRuleset', {
                              name: manifest.name,
                            })}
                            title={t('menu.deleteRuleset', {
                              name: manifest.name,
                            })}
                            className="px-2.5 text-[#8B98A9] hover:text-[#F43F5E] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {importErrors.length > 0 && (
                  <div
                    role="alert"
                    className="mt-2.5 bg-[#F43F5E]/10 border border-[#F43F5E]/30 rounded-md p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#F43F5E]">
                        {t('menu.importErrorTitle')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setImportErrors([])}
                        aria-label={t('common.close')}
                        className="p-0.5 text-[#8B98A9] hover:text-[#E6EDF3] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <ul className="space-y-0.5 font-mono text-[11px] text-[#E6EDF3]/90">
                      {importErrors.slice(0, 5).map((err, idx) => (
                        <li key={idx} className="break-words">
                          {err}
                        </li>
                      ))}
                      {importErrors.length > 5 && (
                        <li className="text-[#8B98A9]">
                          {t('hud.moreNotifications', {
                            count: importErrors.length - 5,
                          })}
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {mapSizes.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-[#8B98A9] mb-2">
                    {t('menu.mapSize')}
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {mapSizes.map((preset) => {
                      const active = preset.id === activePreset?.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedMapSizeId(preset.id)}
                          aria-pressed={active}
                          className={`px-3 py-2.5 rounded-md border text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                            active
                              ? 'bg-[#17202B] border-[#10B981]'
                              : 'bg-[#0B0F14] border-[#1F2A38] hover:border-[#2D3C4E]'
                          }`}
                        >
                          <div className="text-xs font-semibold text-[#E6EDF3]">
                            {preset.name}
                          </div>
                          <div className="font-mono tabular-nums text-[11px] text-[#8B98A9] mt-0.5">
                            {preset.width} × {preset.height}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {setupParams.length > 0 && (
                <div className="space-y-4">
                  {setupParams.map((param) => {
                    const value = paramValues[param.id] ?? param.defaultValue;

                    if (param.type === 'select') {
                      return (
                        <div key={param.id}>
                          <div className="text-xs font-medium text-[#8B98A9] mb-2">
                            {param.label}
                          </div>
                          <div
                            className="grid gap-2"
                            style={{
                              gridTemplateColumns: `repeat(${Math.min(
                                param.options.length,
                                4
                              )}, minmax(0, 1fr))`,
                            }}
                          >
                            {param.options.map((opt) => {
                              const active = String(value) === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    handleParamChange(param.id, opt.value)
                                  }
                                  aria-pressed={active}
                                  className={`px-3 py-2 rounded-md border text-xs font-medium text-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                                    active
                                      ? 'bg-[#17202B] border-[#10B981] text-[#E6EDF3]'
                                      : 'bg-[#0B0F14] border-[#1F2A38] text-[#8B98A9] hover:text-[#E6EDF3] hover:border-[#2D3C4E]'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    if (param.type === 'number') {
                      return (
                        <div key={param.id}>
                          <label
                            htmlFor={`setup-param-${param.id}`}
                            className="flex items-center justify-between text-xs font-medium text-[#8B98A9] mb-2"
                          >
                            <span>{param.label}</span>
                            <span className="font-mono tabular-nums text-[#E6EDF3]">
                              {Number(value)}
                            </span>
                          </label>
                          <input
                            id={`setup-param-${param.id}`}
                            type="number"
                            min={param.min}
                            max={param.max}
                            step={param.step ?? 1}
                            value={Number(value)}
                            onChange={(e) =>
                              handleParamChange(
                                param.id,
                                Number(e.target.value)
                              )
                            }
                            className="w-full bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded-md px-3.5 py-2 text-sm font-mono tabular-nums text-[#E6EDF3] focus:outline-none transition-colors"
                          />
                        </div>
                      );
                    }

                    return (
                      <label
                        key={param.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#0B0F14] border border-[#1F2A38] rounded-md cursor-pointer"
                      >
                        <span className="text-xs font-medium text-[#E6EDF3]">
                          {param.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(e) =>
                            handleParamChange(param.id, e.target.checked)
                          }
                          className="accent-[#10B981] w-4 h-4 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {allowSeed && (
                <div>
                  <label
                    htmlFor="world-seed-input"
                    className="block text-xs font-medium text-[#8B98A9] mb-2"
                  >
                    {t('menu.seed')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="world-seed-input"
                      type="text"
                      maxLength={32}
                      value={seedInput}
                      onChange={(e) => setSeedInput(e.target.value)}
                      placeholder={t('menu.seedPlaceholder')}
                      className="flex-1 bg-[#0B0F14] border border-[#1F2A38] focus:border-[#10B981] rounded-md px-3.5 py-2 text-xs font-mono text-[#E6EDF3] placeholder:text-[#8B98A9]/60 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setSeedInput(generateRandomSeed())}
                      title={t('menu.randomizeSeed')}
                      aria-label={t('menu.randomizeSeed')}
                      className="px-3 py-2 bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md text-[#8B98A9] hover:text-[#E6EDF3] transition-colors cursor-pointer"
                    >
                      <Dices className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111720] focus-visible:ring-[#10B981]"
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>{t('menu.startGame')}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Right Column: Saved Games */}
          <section className="lg:col-span-5 bg-[#111720] border border-[#1F2A38] rounded-lg p-6">
            <div className="flex items-baseline justify-between gap-2 mb-5">
              <h2 className="text-base font-semibold text-[#E6EDF3]">
                {t('menu.saves')}
              </h2>
              <span className="font-mono tabular-nums text-xs text-[#8B98A9]">
                {saves.length}
              </span>
            </div>

            {saves.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-[#1F2A38] rounded-md px-4">
                <p className="text-xs text-[#8B98A9]">{t('menu.noSaves')}</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1F2A38] border-t border-b border-[#1F2A38]">
                {saves.map((slot) => {
                  const matchedRuleset = rulesets.find(
                    (r) => r.manifest.id === slot.rulesetId
                  );
                  return (
                    <div
                      key={slot.id}
                      className="py-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#E6EDF3] truncate">
                          {slot.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#8B98A9] mt-1">
                          <span>
                            {t('common.cycle')} {slot.cycle}
                          </span>
                          {(matchedRuleset?.manifest.resources ?? []).map(
                            (res) => (
                              <span
                                key={res.id}
                                className="inline-flex items-center gap-1.5"
                              >
                                <span aria-hidden="true">·</span>
                                <span
                                  className="font-mono tabular-nums"
                                  style={{ color: res.color }}
                                >
                                  {res.shortName ?? res.name}{' '}
                                  {slot.resources[res.id] ?? 0}
                                </span>
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-[11px] text-[#8B98A9] mt-1">
                          {slot.rulesetName} · {slot.snapshot.width}×
                          {slot.snapshot.height} · {slot.savedAt}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onLoadSave(slot.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>{t('menu.continue')}</span>
                          <ArrowRight
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSave(slot.id)}
                          aria-label={t('menu.deleteSave', { name: slot.name })}
                          title={t('menu.deleteSave', { name: slot.name })}
                          className="p-1.5 text-[#8B98A9] hover:text-[#F43F5E] hover:bg-[#17202B] rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
