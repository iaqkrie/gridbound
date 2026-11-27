import { useRef, useState } from 'react';
import {
  ArrowRight,
  Dices,
  Play,
  Plus,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { SaveSlotRecord } from '../engine/saveStore';
import {
  APP_VERSION,
  generateRandomSeed,
  RuntimeValue,
  SetupOptionManifest,
  WorldSetupValues,
} from '../engine/sdk';
import { t } from '../i18n';
import { RulesetRegistryEntry } from '../rulesets';

interface MainMenuProps {
  rulesets: RulesetRegistryEntry[];
  saves: SaveSlotRecord[];
  defaultSaveName: string;
  onStartNewGame: (
    rulesetId: string,
    saveName: string,
    setup: WorldSetupValues
  ) => void;
  onLoadSave: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onImportRuleset: (rawJson: string) => { ok: boolean; errors?: string[]; id?: string };
  onDeleteRuleset: (rulesetId: string) => void;
  onOpenStudio: (rulesetId: string) => void;
  onCreateNewRuleset: () => void;
}

const MAP_SIZE_PRESETS = [
  { id: 'small', name: 'Compact', width: 10, height: 10 },
  { id: 'medium', name: 'Standard', width: 14, height: 14 },
  { id: 'large', name: 'Expansive', width: 20, height: 20 },
];

function buildDefaultParams(
  options?: SetupOptionManifest[]
): Record<string, RuntimeValue> {
  const out: Record<string, RuntimeValue> = {};
  for (const opt of options ?? []) {
    out[opt.id] = opt.defaultValue;
  }
  return out;
}

function formatSavedTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
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
  onOpenStudio,
  onCreateNewRuleset,
}: MainMenuProps) {
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>(
    rulesets[0]?.manifest.id ?? ''
  );
  const [saveName, setSaveName] = useState<string>(defaultSaveName);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRuleset =
    rulesets.find((r) => r.manifest.id === selectedRulesetId) ?? rulesets[0];

  const [gridWidth, setGridWidth] = useState<number>(
    selectedRuleset?.manifest.defaultGridSize.width ?? 14
  );
  const [gridHeight, setGridHeight] = useState<number>(
    selectedRuleset?.manifest.defaultGridSize.height ?? 14
  );
  const [seedInput, setSeedInput] = useState<string>('');
  const [paramValues, setParamValues] = useState<Record<string, RuntimeValue>>(
    () => buildDefaultParams(selectedRuleset?.manifest.setupOptions)
  );

  const setupOptions = selectedRuleset?.manifest.setupOptions ?? [];

  const handleSelectRuleset = (entry: RulesetRegistryEntry) => {
    setImportErrors([]);
    setSelectedRulesetId(entry.manifest.id);
    setGridWidth(entry.manifest.defaultGridSize.width);
    setGridHeight(entry.manifest.defaultGridSize.height);
    setParamValues(buildDefaultParams(entry.manifest.setupOptions));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const rawJson = await file.text();
      const result = onImportRuleset(rawJson);
      if (result.ok && result.id) {
        setImportErrors([]);
        setSelectedRulesetId(result.id);
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

  const handleParamChange = (paramId: string, value: RuntimeValue) => {
    setParamValues((prev) => ({ ...prev, [paramId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRuleset) return;
    const width = Math.max(4, Math.min(64, Math.round(gridWidth)));
    const height = Math.max(4, Math.min(64, Math.round(gridHeight)));
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
            v{APP_VERSION}
          </span>
        </div>
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={onCreateNewRuleset}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      <span>New Ruleset</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
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
                      <div key={manifest.id} className="flex items-stretch gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectRuleset(entry)}
                          className={`flex-1 min-w-0 text-left px-4 py-3 rounded-md border transition-colors cursor-pointer ${
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
                              {active
                                ? `${gridWidth}×${gridHeight}`
                                : `${manifest.defaultGridSize.width}×${manifest.defaultGridSize.height}`}
                            </span>
                          </div>
                          {manifest.description && (
                            <p className="text-[11px] text-[#8B98A9] mt-1 line-clamp-2">
                              {manifest.description}
                            </p>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenStudio(manifest.id)}
                          title={
                            entry.builtIn
                              ? 'Inspect in Studio (Duplicate to edit)'
                              : 'Edit in Studio'
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Studio</span>
                        </button>

                        {!entry.builtIn && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomRuleset(manifest.id)}
                            aria-label={t('menu.deleteRuleset', {
                              name: manifest.name,
                            })}
                            className="px-2.5 text-[#8B98A9] hover:text-[#F43F5E] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md transition-colors cursor-pointer"
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
                    </ul>
                  </div>
                )}
              </div>

              {/* Map Size Presets */}
              <div>
                <div className="text-xs font-medium text-[#8B98A9] mb-2">
                  {t('menu.mapSize')}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {MAP_SIZE_PRESETS.map((preset) => {
                    const active =
                      gridWidth === preset.width && gridHeight === preset.height;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setGridWidth(preset.width);
                          setGridHeight(preset.height);
                        }}
                        aria-pressed={active}
                        className={`px-3 py-2.5 rounded-md border text-left transition-colors cursor-pointer ${
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

              {/* Ruleset Setup Options */}
              {setupOptions.length > 0 && (
                <div className="space-y-4">
                  {setupOptions.map((opt) => {
                    const value = paramValues[opt.id] ?? opt.defaultValue;

                    if (opt.type === 'select' && opt.options) {
                      return (
                        <div key={opt.id}>
                          <div className="text-xs font-medium text-[#8B98A9] mb-2">
                            {opt.label}
                          </div>
                          <div
                            className="grid gap-2"
                            style={{
                              gridTemplateColumns: `repeat(${Math.min(
                                opt.options.length,
                                4
                              )}, minmax(0, 1fr))`,
                            }}
                          >
                            {opt.options.map((choice) => {
                              const active = String(value) === choice.value;
                              return (
                                <button
                                  key={choice.value}
                                  type="button"
                                  onClick={() =>
                                    handleParamChange(opt.id, choice.value)
                                  }
                                  aria-pressed={active}
                                  className={`px-3 py-2 rounded-md border text-xs font-medium text-center transition-colors cursor-pointer ${
                                    active
                                      ? 'bg-[#17202B] border-[#10B981] text-[#E6EDF3]'
                                      : 'bg-[#0B0F14] border-[#1F2A38] text-[#8B98A9] hover:text-[#E6EDF3] hover:border-[#2D3C4E]'
                                  }`}
                                >
                                  {choice.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    if (opt.type === 'number') {
                      return (
                        <div key={opt.id}>
                          <label
                            htmlFor={`setup-opt-${opt.id}`}
                            className="flex items-center justify-between text-xs font-medium text-[#8B98A9] mb-2"
                          >
                            <span>{opt.label}</span>
                            <span className="font-mono tabular-nums text-[#E6EDF3]">
                              {Number(value)}
                            </span>
                          </label>
                          <input
                            id={`setup-opt-${opt.id}`}
                            type="range"
                            min={opt.min ?? 0}
                            max={opt.max ?? 10}
                            step={opt.step ?? 0.1}
                            value={Number(value)}
                            onChange={(e) =>
                              handleParamChange(opt.id, Number(e.target.value))
                            }
                            className="w-full accent-[#10B981] cursor-pointer"
                          />
                        </div>
                      );
                    }

                    return (
                      <label
                        key={opt.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#0B0F14] border border-[#1F2A38] rounded-md cursor-pointer"
                      >
                        <span className="text-xs font-medium text-[#E6EDF3]">
                          {opt.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(e) =>
                            handleParamChange(opt.id, e.target.checked)
                          }
                          className="accent-[#10B981] w-4 h-4 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Seed */}
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

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors cursor-pointer"
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
                  const isMissingRuleset = !matchedRuleset;
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
                          {slot.hudSummary.map((item, i) => (
                            <span
                              key={`${item.label}-${i}`}
                              className="inline-flex items-center gap-1.5"
                            >
                              <span aria-hidden="true">·</span>
                              <span
                                className="font-mono tabular-nums"
                                style={{ color: item.color ?? '#E6EDF3' }}
                              >
                                {item.label} {String(item.value)}
                              </span>
                            </span>
                          ))}
                        </div>
                        <div className="text-[11px] text-[#8B98A9] mt-1">
                          {slot.rulesetName} · {slot.width}×{slot.height} ·{' '}
                          {formatSavedTime(slot.savedAt)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isMissingRuleset}
                          onClick={() => onLoadSave(slot.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                            isMissingRuleset
                              ? 'text-[#F43F5E]/80 bg-[#F43F5E]/10 border-[#F43F5E]/25 cursor-not-allowed'
                              : 'text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border-[#2D3C4E] cursor-pointer'
                          }`}
                        >
                          <span>
                            {isMissingRuleset
                              ? t('menu.rulesetMissing')
                              : t('menu.continue')}
                          </span>
                          {!isMissingRuleset && (
                            <ArrowRight
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSave(slot.id)}
                          aria-label={t('menu.deleteSave', { name: slot.name })}
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
