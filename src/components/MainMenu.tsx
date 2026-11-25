import { useState } from 'react';
import { ArrowRight, Dices, Play, Trash2 } from 'lucide-react';
import { SaveSlot } from '../engine/saveStore';
import {
  CompiledRuleset,
  SetupParamManifest,
  WorldSetupValues,
  generateRandomSeed,
} from '../engine/sdk';
import { t } from '../i18n';

interface MainMenuProps {
  rulesets: CompiledRuleset[];
  saves: SaveSlot[];
  defaultSaveName: string;
  onStartNewGame: (
    rulesetId: string,
    saveName: string,
    setup: WorldSetupValues
  ) => void;
  onLoadSave: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
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

function findDefaultMapSizeId(rs?: CompiledRuleset): string {
  if (!rs) return '';
  const mapSizes = rs.manifest.setupOptions?.mapSizes;
  if (!mapSizes || mapSizes.length === 0) return '';
  const matched =
    mapSizes.find(
      (p) =>
        p.width === rs.manifest.defaultGridSize.width &&
        p.height === rs.manifest.defaultGridSize.height
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
}: MainMenuProps) {
  const [selectedRulesetId, setSelectedRulesetId] = useState<string>(
    rulesets[0]?.manifest.id ?? ''
  );
  const [saveName, setSaveName] = useState<string>(defaultSaveName);

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

  const handleSelectRuleset = (rs: CompiledRuleset) => {
    setSelectedRulesetId(rs.manifest.id);
    setSelectedMapSizeId(findDefaultMapSizeId(rs));
    setParamValues(buildDefaultParams(rs.manifest.setupOptions?.params));
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
                <div className="text-xs font-medium text-[#8B98A9] mb-2">
                  {t('menu.ruleset')}
                </div>
                <div className="space-y-2">
                  {rulesets.map((rs) => {
                    const manifest = rs.manifest;
                    const active = manifest.id === selectedRuleset?.manifest.id;
                    return (
                      <button
                        key={manifest.id}
                        type="button"
                        onClick={() => handleSelectRuleset(rs)}
                        className={`w-full text-left px-4 py-3 rounded-md border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] ${
                          active
                            ? 'bg-[#17202B] border-[#10B981]'
                            : 'bg-[#0B0F14] border-[#1F2A38] hover:border-[#2D3C4E]'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-semibold text-[#E6EDF3]">
                            {manifest.name}
                          </span>
                          <span className="font-mono tabular-nums text-xs text-[#8B98A9] shrink-0">
                            {active && activePreset
                              ? `${activePreset.width}×${activePreset.height}`
                              : `${manifest.defaultGridSize.width}×${manifest.defaultGridSize.height}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
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
                          className={`px-3 py-2.5 rounded-md border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] ${
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
                                  className={`px-3 py-2 rounded-md border text-xs font-medium text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] ${
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
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111720] focus-visible:ring-[#10B981]"
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
