import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  Play,
  Plus,
  Save,
  Upload,
  X,
} from 'lucide-react';
import {
  CellTypeManifest,
  RulesetManifest,
  ValidationIssue,
  ValidationSection,
  makeUniqueId,
  renameCellTypeId,
  validateRulesetManifest,
} from '../../engine/sdk';
import { t } from '../../i18n';
import { CellEditor } from './CellEditor';
import { CellTilePreview } from './CellTilePreview';
import { GeneralSection } from './GeneralSection';
import { GeneratorSection } from './GeneratorSection';
import { ResourcesSection } from './ResourcesSection';
import { SuppliesSection } from './SuppliesSection';
import {
  createDefaultCellType,
  downloadRulesetJson,
} from './editorHelpers';

export interface EditorSelection {
  section: ValidationSection;
  cellId?: string;
}

interface RulesetEditorProps {
  draft: RulesetManifest;
  isDirty: boolean;
  selection: EditorSelection;
  onChangeDraft: (next: RulesetManifest) => void;
  onChangeSelection: (next: EditorSelection) => void;
  onSave: () => { ok: boolean; errors?: string[] };
  onTestPlay: () => void;
  onExit: () => void;
}

export function RulesetEditor({
  draft,
  isDirty,
  selection,
  onChangeDraft,
  onChangeSelection,
  onSave,
  onTestPlay,
  onExit,
}: RulesetEditorProps) {
  const [showIssues, setShowIssues] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [extraErrors, setExtraErrors] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  const validation = useMemo(() => validateRulesetManifest(draft), [draft]);
  const allIssues = validation.issues;
  const issueCount = allIssues.length + extraErrors.length;

  const sectionIssueCounts = useMemo(() => {
    const counts: Record<ValidationSection, number> = {
      general: 0,
      resources: 0,
      supplies: 0,
      generator: 0,
      cells: 0,
    };
    for (const issue of allIssues) {
      counts[issue.section]++;
    }
    return counts;
  }, [allIssues]);

  const cellIssueIds = useMemo(() => {
    const set = new Set<string>();
    for (const issue of allIssues) {
      if (issue.cellId) set.add(issue.cellId);
    }
    return set;
  }, [allIssues]);

  const activeCell =
    selection.section === 'cells'
      ? (draft.cellTypes.find((c) => c.id === selection.cellId) ??
        draft.cellTypes[0])
      : null;

  const handleSaveClick = () => {
    setExtraErrors([]);
    if (!validation.valid) {
      setShowIssues(true);
      return;
    }
    const res = onSave();
    if (res.ok) {
      setSaveFeedback(t('editor.saved'));
      window.setTimeout(() => setSaveFeedback(null), 1600);
    } else if (res.errors && res.errors.length > 0) {
      setExtraErrors(res.errors);
      setShowIssues(true);
    }
  };

  const handleTestPlayClick = () => {
    setExtraErrors([]);
    if (!validation.valid) {
      setShowIssues(true);
      return;
    }
    onTestPlay();
  };

  const handleExitRequest = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onExit();
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const res = validateRulesetManifest(parsed);
      if (!res.valid) {
        setExtraErrors(res.errors);
        setShowIssues(true);
        return;
      }
      const next = parsed as RulesetManifest;
      setExtraErrors([]);
      onChangeDraft(next);
      onChangeSelection({
        section: 'cells',
        cellId: next.cellTypes[0]?.id,
      });
    } catch (err) {
      setExtraErrors([
        err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON file',
      ]);
      setShowIssues(true);
    }
  };

  const handleAddCell = () => {
    const nextCell = createDefaultCellType(draft);
    onChangeDraft({
      ...draft,
      cellTypes: [...draft.cellTypes, nextCell],
    });
    onChangeSelection({ section: 'cells', cellId: nextCell.id });
  };

  const handleUpdateCell = (nextCell: CellTypeManifest) => {
    onChangeDraft({
      ...draft,
      cellTypes: draft.cellTypes.map((c) =>
        c.id === nextCell.id ? nextCell : c
      ),
    });
  };

  const handleRenameCellId = (oldId: string, rawNewId: string) => {
    const updated = renameCellTypeId(draft, oldId, rawNewId);
    if (updated === draft) return;
    const oldIndex = draft.cellTypes.findIndex((c) => c.id === oldId);
    const nextId = updated.cellTypes[oldIndex]?.id ?? oldId;
    onChangeDraft(updated);
    onChangeSelection({ section: 'cells', cellId: nextId });
  };

  const handleDuplicateCell = (source: CellTypeManifest) => {
    const clone: CellTypeManifest = JSON.parse(JSON.stringify(source));
    clone.id = makeUniqueId(
      `${source.id}_copy`,
      draft.cellTypes.map((c) => c.id)
    );
    clone.name = `${source.name} (Copy)`;
    onChangeDraft({
      ...draft,
      cellTypes: [...draft.cellTypes, clone],
    });
    onChangeSelection({ section: 'cells', cellId: clone.id });
  };

  const handleDeleteCell = (cellId: string) => {
    if (draft.cellTypes.length <= 1 || cellId === draft.defaultCellTypeId) {
      return;
    }
    const nextCells = draft.cellTypes.filter((c) => c.id !== cellId);
    onChangeDraft({ ...draft, cellTypes: nextCells });
    onChangeSelection({ section: 'cells', cellId: nextCells[0]?.id });
  };

  const handleJumpToIssue = (issue: ValidationIssue) => {
    onChangeSelection({
      section: issue.section,
      cellId: issue.cellId ?? draft.cellTypes[0]?.id,
    });
    setShowIssues(false);
  };

  const globalSections: {
    id: Exclude<ValidationSection, 'cells'>;
    label: string;
    count?: number;
  }[] = [
    { id: 'general', label: t('editor.sectionGeneral') },
    {
      id: 'resources',
      label: t('editor.sectionResources'),
      count: draft.resources.length,
    },
    {
      id: 'supplies',
      label: t('editor.sectionSupplies'),
      count: draft.supplies.length,
    },
    {
      id: 'generator',
      label: t('editor.sectionGenerator'),
      count: draft.worldGenerator.length,
    },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F14] text-[#E6EDF3] overflow-hidden">
      {/* Top Bar (3-zone studio header) */}
      <header className="h-14 shrink-0 bg-[#111720] border-b border-[#1F2A38] px-4 flex items-center justify-between gap-4 select-none">
        {/* Zone 1: Back + Editable Ruleset Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleExitRequest}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded px-1.5 py-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('common.menu')}</span>
          </button>
          <span className="text-[#1F2A38]" aria-hidden="true">
            /
          </span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onChangeDraft({ ...draft, name: e.target.value })}
            aria-label="Ruleset name"
            className="bg-transparent hover:bg-[#17202B] focus:bg-[#0B0F14] border border-transparent focus:border-[#10B981] rounded px-2 py-1 text-sm font-semibold text-[#E6EDF3] focus:outline-none w-44 sm:w-56 truncate transition-colors"
          />
          {isDirty && (
            <span
              className="font-mono text-xs text-[#F59E0B] shrink-0"
              title="Unsaved changes"
            >
              *
            </span>
          )}
        </div>

        {/* Zone 2: Validation & JSON File Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          {issueCount > 0 && (
            <button
              type="button"
              onClick={() => setShowIssues((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#F43F5E] bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border border-[#F43F5E]/35 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
              </span>
            </button>
          )}

          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('editor.importJson')}</span>
          </button>
          <button
            type="button"
            onClick={() => downloadRulesetJson(draft)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('editor.exportJson')}</span>
          </button>
        </div>

        {/* Zone 3: Save + Primary Test Play CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSaveClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded-md transition-colors whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]"
          >
            {saveFeedback ? (
              <Check className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
            ) : (
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{saveFeedback ?? t('editor.save')}</span>
          </button>

          <button
            type="button"
            onClick={handleTestPlayClick}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111720] focus-visible:ring-[#10B981]"
          >
            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>{t('editor.testPlay')}</span>
          </button>
        </div>
      </header>

      {/* Validation Drawer (collapsible) */}
      {showIssues && issueCount > 0 && (
        <div
          role="alert"
          className="shrink-0 bg-[#111720] border-b border-[#F43F5E]/40 px-5 py-3"
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-semibold text-[#F43F5E]">
              Validation Issues ({issueCount})
            </span>
            <button
              type="button"
              onClick={() => setShowIssues(false)}
              aria-label={t('common.close')}
              className="p-0.5 text-[#8B98A9] hover:text-[#E6EDF3] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {extraErrors.map((err, idx) => (
              <div
                key={`extra-${idx}`}
                className="font-mono text-[11px] text-[#E6EDF3] px-2 py-1"
              >
                {err}
              </div>
            ))}
            {allIssues.map((issue, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleJumpToIssue(issue)}
                className="w-full text-left flex items-center justify-between gap-3 px-2 py-1 rounded hover:bg-[#17202B] font-mono text-[11px] text-[#E6EDF3] cursor-pointer"
              >
                <span className="truncate">{issue.message}</span>
                <span className="text-[#8B98A9] shrink-0">
                  {issue.section}
                  {issue.cellId ? ` / ${issue.cellId}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workspace Body: 248px Sidebar + Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[248px] shrink-0 bg-[#111720] border-r border-[#1F2A38] flex flex-col min-h-0 select-none">
          <nav className="p-2.5 space-y-0.5">
            {globalSections.map((sec) => {
              const active = selection.section === sec.id;
              const errorsInSec = sectionIssueCounts[sec.id];
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onChangeSelection({ section: sec.id })}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#17202B] text-[#E6EDF3]'
                      : 'text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B]/50'
                  }`}
                >
                  <span>{sec.label}</span>
                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[11px]">
                    {errorsInSec > 0 && (
                      <span className="text-[#F43F5E]">!{errorsInSec}</span>
                    )}
                    {sec.count !== undefined && (
                      <span className="text-[#8B98A9]">{sec.count}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Cells Section (1-click switching) */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-[#1F2A38]">
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#8B98A9]">
                {t('editor.sectionCells')}{' '}
                <span className="font-mono tabular-nums">
                  ({draft.cellTypes.length})
                </span>
              </span>
              <button
                type="button"
                onClick={handleAddCell}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-[#E6EDF3] bg-[#17202B] hover:bg-[#1F2A38] border border-[#2D3C4E] rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
              {draft.cellTypes.map((cell) => {
                const active =
                  selection.section === 'cells' && activeCell?.id === cell.id;
                const hasError = cellIssueIds.has(cell.id);
                return (
                  <button
                    key={cell.id}
                    type="button"
                    onClick={() =>
                      onChangeSelection({ section: 'cells', cellId: cell.id })
                    }
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#17202B] text-[#E6EDF3] border border-[#10B981]/60'
                        : 'text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B]/50 border border-transparent'
                    }`}
                  >
                    <CellTilePreview visual={cell.visual} size={24} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[#E6EDF3] truncate leading-tight">
                        {cell.name}
                      </div>
                      <div className="font-mono text-[10px] text-[#8B98A9] truncate">
                        {cell.id}
                      </div>
                    </div>
                    {hasError && (
                      <AlertTriangle
                        className="w-3.5 h-3.5 text-[#F43F5E] shrink-0"
                        aria-label="Has validation error"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-6">
          {selection.section === 'general' && (
            <GeneralSection manifest={draft} onChange={onChangeDraft} />
          )}
          {selection.section === 'resources' && (
            <ResourcesSection manifest={draft} onChange={onChangeDraft} />
          )}
          {selection.section === 'supplies' && (
            <SuppliesSection manifest={draft} onChange={onChangeDraft} />
          )}
          {selection.section === 'generator' && (
            <GeneratorSection manifest={draft} onChange={onChangeDraft} />
          )}
          {selection.section === 'cells' && activeCell && (
            <CellEditor
              cell={activeCell}
              manifest={draft}
              canDelete={
                draft.cellTypes.length > 1 &&
                activeCell.id !== draft.defaultCellTypeId
              }
              onChangeCell={handleUpdateCell}
              onRenameCellId={handleRenameCellId}
              onDuplicateCell={() => handleDuplicateCell(activeCell)}
              onDeleteCell={() => handleDeleteCell(activeCell.id)}
            />
          )}
        </main>
      </div>

      {/* Unsaved Changes Exit Modal */}
      {showExitConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Unsaved changes"
          className="fixed inset-0 z-50 bg-[#0B0F14]/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm bg-[#111720] border border-[#2D3C4E] rounded-lg shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1F2A38] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E6EDF3]">
                {t('editor.unsavedTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                aria-label={t('common.close')}
                className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  const res = onSave();
                  if (res.ok) {
                    setShowExitConfirm(false);
                    onExit();
                  } else {
                    setShowExitConfirm(false);
                    if (res.errors) setExtraErrors(res.errors);
                    setShowIssues(true);
                  }
                }}
                className="w-full py-2.5 px-4 text-xs font-semibold text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded-md transition-colors cursor-pointer"
              >
                {t('editor.saveAndExit')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
                className="w-full py-2.5 px-4 text-xs font-medium text-[#F43F5E] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] rounded-md transition-colors cursor-pointer"
              >
                {t('editor.discardAndExit')}
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-2 px-4 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] rounded-md transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
