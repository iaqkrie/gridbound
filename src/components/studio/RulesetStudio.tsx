import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Droplets,
  Grid2X2,
  Image as ImageIcon,
  LayoutPanelTop,
  Map as MapIcon,
  Play,
  Save,
  Settings2,
} from 'lucide-react';
import {
  RulesetManifest,
  validateRulesetManifest,
} from '../../engine/sdk';
import { exportRulesetJson } from '../../rulesets';
import { CellsTab } from './CellsTab';
import { GeneralTab } from './GeneralTab';
import { GlobalStateTab } from './GlobalStateTab';
import { InterfacesTab } from './InterfacesTab';
import { SpritesTab } from './SpritesTab';
import { cloneRulesetAsCustom } from './studioUtils';
import { SuppliesTab } from './SuppliesTab';
import { WorldGeneratorTab } from './WorldGeneratorTab';

type StudioSection =
  | 'general'
  | 'sprites'
  | 'globalState'
  | 'supplies'
  | 'worldGenerator'
  | 'cells'
  | 'interfaces';

interface RulesetStudioProps {
  initialManifest: RulesetManifest;
  builtIn: boolean;
  initialDirty?: boolean;
  existingRulesetIds: string[];
  onSaveCustom: (manifest: RulesetManifest) => void;
  onDuplicateToCustom: (copy: RulesetManifest) => void;
  onTestPlay: (draftManifest: RulesetManifest, dirty: boolean) => void;
  onBackToMenu: () => void;
}

export function RulesetStudio({
  initialManifest,
  builtIn,
  initialDirty = false,
  existingRulesetIds,
  onSaveCustom,
  onDuplicateToCustom,
  onTestPlay,
  onBackToMenu,
}: RulesetStudioProps) {
  const [draft, setDraft] = useState<RulesetManifest>(() =>
    JSON.parse(JSON.stringify(initialManifest))
  );
  const [isDirty, setIsDirty] = useState(initialDirty);
  const [activeSection, setActiveSection] = useState<StudioSection>('general');
  const [validationOpen, setValidationOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [showUnsavedExit, setShowUnsavedExit] = useState(false);

  // Sync draft when switching rulesets or after duplicating built-in -> custom
  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(initialManifest)));
    setIsDirty(initialDirty);
    setValidationOpen(false);
    setShowUnsavedExit(false);
  }, [initialManifest, builtIn, initialDirty]);

  const validation = useMemo(() => validateRulesetManifest(draft), [draft]);

  const handleReplaceDraft = (next: RulesetManifest) => {
    if (builtIn) return;
    setDraft(next);
    setIsDirty(true);
    setSavedNotice(false);
  };

  const handleUpdateDraft = (
    updater: (prev: RulesetManifest) => RulesetManifest
  ) => {
    if (builtIn) return;
    setDraft((prev) => updater(prev));
    setIsDirty(true);
    setSavedNotice(false);
  };

  const handleSave = () => {
    if (builtIn || !validation.valid) return;
    onSaveCustom(draft);
    setIsDirty(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  // Ctrl+S / Cmd+S quick save & Escape to close overlays
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!builtIn && validation.valid) {
          onSaveCustom(draft);
          setIsDirty(false);
          setSavedNotice(true);
          setTimeout(() => setSavedNotice(false), 2000);
        }
      } else if (e.key === 'Escape') {
        setValidationOpen(false);
        setShowUnsavedExit(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [builtIn, draft, onSaveCustom, validation.valid]);

  const handleRequestBackToMenu = () => {
    if (!builtIn && isDirty) {
      setShowUnsavedExit(true);
      return;
    }
    onBackToMenu();
  };

  const handleDuplicate = () => {
    const copy = cloneRulesetAsCustom(draft, existingRulesetIds);
    onDuplicateToCustom(copy);
  };

  const handleExportJson = () => {
    const json = exportRulesetJson(draft);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.id || 'ruleset'}.gridbound.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const navItems: {
    id: StudioSection;
    label: string;
    count?: number;
    icon: typeof Settings2;
  }[] = [
    { id: 'general', label: 'General', icon: Settings2 },
    {
      id: 'sprites',
      label: 'Sprites',
      count: draft.sprites.length,
      icon: ImageIcon,
    },
    {
      id: 'globalState',
      label: 'GlobalState',
      count: draft.globalState.variables.length,
      icon: Database,
    },
    {
      id: 'supplies',
      label: 'Supplies',
      count: draft.supplies.length,
      icon: Droplets,
    },
    {
      id: 'worldGenerator',
      label: 'WorldGenerator',
      count: draft.worldGenerator.nodes.length,
      icon: MapIcon,
    },
    {
      id: 'cells',
      label: 'Cells',
      count: draft.cellTypes.length,
      icon: Grid2X2,
    },
    {
      id: 'interfaces',
      label: 'Interfaces',
      count: draft.interfaces.length,
      icon: LayoutPanelTop,
    },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F14] text-[#E6EDF3] overflow-hidden">
      {/* Studio Top Bar (56px, single-line controls) */}
      <header className="h-14 shrink-0 border-b border-[#1F2A38] bg-[#111720] px-4 flex items-center justify-between gap-4 select-none relative z-30">
        {/* Left: Back + Title + Quiet Status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleRequestBackToMenu}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] transition-colors whitespace-nowrap shrink-0 cursor-pointer px-1.5 py-1 rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Menu</span>
          </button>
          <span className="text-[#1F2A38] shrink-0">/</span>
          <span className="text-sm font-semibold text-[#E6EDF3] truncate max-w-[220px]">
            {draft.name || draft.id}
          </span>
          <span className="text-xs text-[#8B98A9] whitespace-nowrap shrink-0 hidden sm:inline">
            {builtIn
              ? 'Built-in · Read-only'
              : savedNotice
                ? 'Saved'
                : isDirty
                  ? 'Unsaved changes'
                  : 'Custom ruleset'}
          </span>
        </div>

        {/* Right: Validation + Export + Test Play + Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setValidationOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                validation.valid
                  ? 'text-[#10B981] bg-[#0B0F14] border-[#1F2A38] hover:border-[#2D3C4E]'
                  : 'text-[#F43F5E] bg-[#F43F5E]/10 border-[#F43F5E]/40 hover:border-[#F43F5E]'
              }`}
            >
              {validation.valid ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              <span className="font-mono tabular-nums">
                {validation.valid
                  ? 'Valid'
                  : `${validation.errors.length} ${validation.errors.length === 1 ? 'issue' : 'issues'}`}
              </span>
            </button>

            {validationOpen && (
              <div className="absolute right-0 mt-2 w-96 max-h-80 overflow-y-auto bg-[#111720] border border-[#2D3C4E] rounded-lg shadow-2xl p-3 space-y-2 z-50">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#1F2A38]">
                  <span className="text-xs font-semibold text-[#E6EDF3]">
                    Manifest Validation (Schema v{draft.schemaVersion})
                  </span>
                  <button
                    type="button"
                    onClick={() => setValidationOpen(false)}
                    className="text-[11px] text-[#8B98A9] hover:text-[#E6EDF3] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {validation.valid ? (
                  <p className="text-xs text-[#10B981]">
                    All schema, sprite, supply, interface, and node graph checks passed.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {validation.errors.map((err, idx) => (
                      <li
                        key={idx}
                        className="text-[11px] leading-snug bg-[#0B0F14] border border-[#F43F5E]/25 rounded p-2"
                      >
                        <div className="font-mono text-[#F43F5E] break-all">
                          {err.path || 'root'}
                        </div>
                        <div className="text-[#E6EDF3]/90 mt-0.5">
                          {err.message}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#2D3C4E] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            disabled={!validation.valid}
            onClick={() => onTestPlay(draft, isDirty)}
            title={
              validation.valid
                ? 'Launch instant playtest on current draft'
                : 'Fix validation issues before playtesting'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Test Play</span>
          </button>

          {builtIn ? (
            <button
              type="button"
              onClick={handleDuplicate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate as Custom</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!validation.valid}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Studio Body: Left Navigation + Active Section Editor */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <nav className="w-52 shrink-0 border-r border-[#1F2A38] bg-[#111720] p-2.5 flex flex-col gap-1 select-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setValidationOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#17202B] text-[#E6EDF3] border border-[#2D3C4E]'
                    : 'text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B]/50 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-[#10B981]' : 'text-[#8B98A9]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== undefined && (
                  <span className="font-mono tabular-nums text-[11px] text-[#8B98A9]">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Section Workspace */}
        <main className="flex-1 flex min-w-0 min-h-0 overflow-hidden bg-[#0B0F14]">
          {activeSection === 'general' && (
            <GeneralTab
              manifest={draft}
              readOnly={builtIn}
              onChange={handleReplaceDraft}
            />
          )}
          {activeSection === 'sprites' && (
            <SpritesTab
              manifest={draft}
              readOnly={builtIn}
              onChange={handleReplaceDraft}
            />
          )}
          {activeSection === 'globalState' && (
            <GlobalStateTab
              manifest={draft}
              readOnly={builtIn}
              onChange={handleReplaceDraft}
            />
          )}
          {activeSection === 'supplies' && (
            <SuppliesTab
              manifest={draft}
              readOnly={builtIn}
              onChange={handleReplaceDraft}
            />
          )}
          {activeSection === 'worldGenerator' && (
            <WorldGeneratorTab
              manifest={draft}
              readOnly={builtIn}
              onChange={handleUpdateDraft}
            />
          )}
          {activeSection === 'cells' && (
            <CellsTab
              manifest={draft}
              readOnly={builtIn}
              onChange={handleReplaceDraft}
            />
          )}
          {activeSection === 'interfaces' && (
            <InterfacesTab
              manifest={draft}
              readOnly={builtIn}
              onChange={handleReplaceDraft}
            />
          )}
        </main>
      </div>

      {/* Unsaved Changes Exit Guard */}
      {showUnsavedExit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Unsaved ruleset changes"
          className="fixed inset-0 z-50 bg-[#0B0F14]/80 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm bg-[#111720] border border-[#2D3C4E] rounded-lg shadow-2xl p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[#E6EDF3]">
                Unsaved changes
              </h2>
              <p className="text-xs text-[#8B98A9] leading-relaxed">
                {validation.valid
                  ? `Save changes to "${draft.name || draft.id}" before returning to the main menu?`
                  : `"${draft.name || draft.id}" has ${validation.errors.length} validation issue(s) and cannot be saved yet.`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={!validation.valid}
                onClick={() => {
                  onSaveCustom(draft);
                  setIsDirty(false);
                  setShowUnsavedExit(false);
                  onBackToMenu();
                }}
                className="w-full px-3.5 py-2 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
              >
                Save & Exit
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedExit(false);
                  onBackToMenu();
                }}
                className="w-full px-3.5 py-2 text-xs font-medium text-[#F43F5E] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] hover:border-[#F43F5E]/40 rounded-md transition-colors cursor-pointer"
              >
                Discard & Exit
              </button>
              <button
                type="button"
                onClick={() => setShowUnsavedExit(false)}
                className="w-full px-3.5 py-2 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
