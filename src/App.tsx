import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasHudBottom } from './components/CanvasHudBottom';
import { ExitConfirmModal } from './components/ExitConfirmModal';
import { GridCanvas, GridCanvasHandle } from './components/GridCanvas';
import { HoverCellCard } from './components/HoverCellCard';
import {
  ActiveInterfaceState,
  InterfacePopover,
} from './components/InterfacePopover';
import { MainMenu } from './components/MainMenu';
import { NotificationBanner } from './components/NotificationBanner';
import { SupplyFilterOverlay } from './components/SupplyFilterOverlay';
import { TopBar } from './components/TopBar';
import { RulesetStudio } from './components/studio/RulesetStudio';
import { createStarterRuleset } from './components/studio/studioUtils';
import { SimulationCore } from './engine/SimulationCore';
import {
  CellTypeId,
  GameNotification,
  generateRandomSeed,
  GridCoordinate,
  InterfaceId,
  MouseButton,
  RulesetManifest,
  RuntimeValue,
  SupplyId,
  SupplyOverlayMode,
  WorldSetupValues,
} from './engine/sdk';
import {
  deleteSaveSlot,
  listSaveSlots,
  saveGameSlot,
  SaveSlotRecord,
} from './engine/saveStore';
import {
  deleteCustomRuleset,
  getAllRulesets,
  getRulesetById,
  importRulesetJson,
  RulesetRegistryEntry,
  saveCustomRuleset,
} from './rulesets';
import { playTacticalSound } from './utils/sound';

type ScreenMode = 'MENU' | 'PLAYING' | 'STUDIO';

export default function App() {
  const [screen, setScreen] = useState<ScreenMode>('MENU');
  const [rulesets, setRulesets] = useState<RulesetRegistryEntry[]>(() =>
    getAllRulesets()
  );
  const [saves, setSaves] = useState<SaveSlotRecord[]>(() => listSaveSlots());
  const [activeSaveId, setActiveSaveId] = useState<string | null>(null);
  const [activeSaveName, setActiveSaveName] = useState<string>('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Visual Ruleset Studio & ephemeral Playtest state
  const [studioManifest, setStudioManifest] = useState<RulesetManifest | null>(
    null
  );
  const [studioBuiltIn, setStudioBuiltIn] = useState(false);
  const [studioDirty, setStudioDirty] = useState(false);
  const [isPlaytest, setIsPlaytest] = useState(false);

  // Simulation runtime state
  const [core, setCore] = useState<SimulationCore | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [overlayMode, setOverlayMode] = useState<SupplyOverlayMode>('off');
  const [activeSupplyId, setActiveSupplyId] = useState<SupplyId | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [hoveredCell, setHoveredCell] = useState<GridCoordinate | null>(null);
  const [activeInterface, setActiveInterface] =
    useState<ActiveInterfaceState | null>(null);
  const [focusedNotificationId, setFocusedNotificationId] = useState<
    string | null
  >(null);
  const [highlightedCell, setHighlightedCell] = useState<GridCoordinate | null>(
    null
  );
  const [previewCellTypeId, setPreviewCellTypeId] = useState<CellTypeId | null>(
    null
  );
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 640 });

  const canvasRef = useRef<GridCanvasHandle>(null);

  const closeOverlays = useCallback(() => {
    setActiveInterface(null);
    setPreviewCellTypeId(null);
  }, []);

  const bumpRender = useCallback(() => {
    setRenderVersion((v) => v + 1);
  }, []);

  const handleImportRuleset = useCallback(
    (rawJson: string) => {
      const result = importRulesetJson(rawJson);
      if (result.manifest) {
        saveCustomRuleset(result.manifest);
        setRulesets(getAllRulesets());
        playTacticalSound('build', soundEnabled);
        return { ok: true, id: result.manifest.id };
      }
      return { ok: false, errors: result.errors };
    },
    [soundEnabled]
  );

  const handleDeleteRuleset = useCallback(
    (rulesetId: string) => {
      deleteCustomRuleset(rulesetId);
      setRulesets(getAllRulesets());
      playTacticalSound('erase', soundEnabled);
    },
    [soundEnabled]
  );

  // ============================================================================
  // Visual Ruleset Studio & Ephemeral Playtest Handlers
  // ============================================================================

  const handleOpenStudio = useCallback(
    (rulesetId: string) => {
      const entry = getAllRulesets().find((r) => r.manifest.id === rulesetId);
      if (!entry) return;
      setStudioManifest(JSON.parse(JSON.stringify(entry.manifest)));
      setStudioBuiltIn(entry.builtIn);
      setStudioDirty(false);
      setIsPlaytest(false);
      setScreen('STUDIO');
      playTacticalSound('click', soundEnabled);
    },
    [soundEnabled]
  );

  const handleCreateNewRuleset = useCallback(() => {
    const existingIds = getAllRulesets().map((r) => r.manifest.id);
    const starter = createStarterRuleset(existingIds);
    saveCustomRuleset(starter);
    setRulesets(getAllRulesets());
    setStudioManifest(starter);
    setStudioBuiltIn(false);
    setStudioDirty(false);
    setIsPlaytest(false);
    setScreen('STUDIO');
    playTacticalSound('build', soundEnabled);
  }, [soundEnabled]);

  const handleSaveStudioRuleset = useCallback(
    (manifest: RulesetManifest) => {
      saveCustomRuleset(manifest);
      setRulesets(getAllRulesets());
      setStudioManifest(JSON.parse(JSON.stringify(manifest)));
      setStudioDirty(false);
      playTacticalSound('build', soundEnabled);
    },
    [soundEnabled]
  );

  const handleDuplicateStudioRuleset = useCallback(
    (copy: RulesetManifest) => {
      saveCustomRuleset(copy);
      setRulesets(getAllRulesets());
      setStudioManifest(JSON.parse(JSON.stringify(copy)));
      setStudioBuiltIn(false);
      setStudioDirty(false);
      playTacticalSound('build', soundEnabled);
    },
    [soundEnabled]
  );

  const handleTestPlay = useCallback(
    (draftManifest: RulesetManifest, dirty: boolean) => {
      const clonedDraft: RulesetManifest = JSON.parse(
        JSON.stringify(draftManifest)
      );
      const defaultParams: Record<string, RuntimeValue> = {};
      for (const opt of clonedDraft.setupOptions ?? []) {
        defaultParams[opt.id] = opt.defaultValue;
      }

      const testCore = new SimulationCore(clonedDraft);
      testCore.createNewGame({
        width: clonedDraft.defaultGridSize.width,
        height: clonedDraft.defaultGridSize.height,
        seed: generateRandomSeed(),
        setupParams: defaultParams,
      });

      const firstOverlaySupply = clonedDraft.supplies.find(
        (s) => s.showInOverlay !== false
      );

      setStudioManifest(clonedDraft);
      setStudioDirty(dirty);
      setCore(testCore);
      setActiveSaveId(null);
      setActiveSaveName(`${clonedDraft.name} · Playtest`);
      setIsPlaytest(true);
      setOverlayMode('off');
      setActiveSupplyId(firstOverlaySupply?.id ?? null);
      setHoveredCell(null);
      setFocusedNotificationId(null);
      setHighlightedCell(null);
      setShowExitConfirm(false);
      closeOverlays();
      setScreen('PLAYING');
      setRenderVersion((v) => v + 1);
      playTacticalSound('build', soundEnabled);
    },
    [closeOverlays, soundEnabled]
  );

  // ============================================================================
  // Game Lifecycle Handlers
  // ============================================================================

  const handleStartNewGame = useCallback(
    (rulesetId: string, saveName: string, setup: WorldSetupValues) => {
      const manifest = getRulesetById(rulesetId);
      if (!manifest) return;
      const nextCore = new SimulationCore(manifest);
      nextCore.createNewGame({
        width: setup.width,
        height: setup.height,
        seed: setup.seed,
        setupParams: setup.params,
      });

      const slot = saveGameSlot(
        nextCore.serialize(),
        manifest,
        undefined,
        saveName
      );
      const firstOverlaySupply = manifest.supplies.find(
        (s) => s.showInOverlay !== false
      );

      setSaves(listSaveSlots());
      setCore(nextCore);
      setActiveSaveId(slot.id);
      setActiveSaveName(slot.name);
      setOverlayMode('off');
      setActiveSupplyId(firstOverlaySupply?.id ?? null);
      setHoveredCell(null);
      setFocusedNotificationId(null);
      setHighlightedCell(null);
      setShowExitConfirm(false);
      closeOverlays();
      setScreen('PLAYING');
      setRenderVersion((v) => v + 1);
      playTacticalSound('build', soundEnabled);
    },
    [closeOverlays, soundEnabled]
  );

  const handleLoadSave = useCallback(
    (saveId: string) => {
      const slot = listSaveSlots().find((s) => s.id === saveId);
      if (!slot) return;
      const manifest = getRulesetById(slot.rulesetId);
      if (!manifest) return;

      const loadedCore = new SimulationCore(manifest);
      loadedCore.deserialize(slot.snapshot);

      const firstOverlaySupply = manifest.supplies.find(
        (s) => s.showInOverlay !== false
      );

      setCore(loadedCore);
      setActiveSaveId(slot.id);
      setActiveSaveName(slot.name);
      setOverlayMode('off');
      setActiveSupplyId(firstOverlaySupply?.id ?? null);
      setHoveredCell(null);
      setFocusedNotificationId(null);
      setHighlightedCell(null);
      setShowExitConfirm(false);
      closeOverlays();
      setScreen('PLAYING');
      setRenderVersion((v) => v + 1);
      playTacticalSound('click', soundEnabled);
    },
    [closeOverlays, soundEnabled]
  );

  const handleDeleteSave = useCallback(
    (saveId: string) => {
      deleteSaveSlot(saveId);
      setSaves(listSaveSlots());
      playTacticalSound('erase', soundEnabled);
    },
    [soundEnabled]
  );

  const handleRequestExit = useCallback(() => {
    closeOverlays();
    if (isPlaytest) {
      setHoveredCell(null);
      setFocusedNotificationId(null);
      setHighlightedCell(null);
      setShowExitConfirm(false);
      setIsPlaytest(false);
      setScreen('STUDIO');
      playTacticalSound('click', soundEnabled);
      return;
    }
    setShowExitConfirm(true);
  }, [closeOverlays, isPlaytest, soundEnabled]);

  const handleSaveAndExit = useCallback(() => {
    if (core && activeSaveId) {
      saveGameSlot(core.serialize(), core.manifest, activeSaveId, activeSaveName);
    }
    setShowExitConfirm(false);
    setHoveredCell(null);
    setFocusedNotificationId(null);
    setHighlightedCell(null);
    setSaves(listSaveSlots());
    setScreen('MENU');
    playTacticalSound('click', soundEnabled);
  }, [core, activeSaveId, activeSaveName, soundEnabled]);

  const handleExitWithoutSaving = useCallback(() => {
    setShowExitConfirm(false);
    setHoveredCell(null);
    setFocusedNotificationId(null);
    setHighlightedCell(null);
    setSaves(listSaveSlots());
    setScreen('MENU');
    playTacticalSound('click', soundEnabled);
  }, [soundEnabled]);

  const handleNextTurn = useCallback(() => {
    if (!core) return;
    closeOverlays();
    setFocusedNotificationId(null);
    setHighlightedCell(null);
    core.step();
    bumpRender();
    playTacticalSound('step', soundEnabled);
  }, [core, closeOverlays, bumpRender, soundEnabled]);

  // ============================================================================
  // Cell Click & Universal Interface Continuation Flow
  // ============================================================================

  const handleCellClick = useCallback(
    (
      x: number,
      y: number,
      button: MouseButton,
      screenX: number,
      screenY: number
    ) => {
      if (!core || button === 'middle') return;
      setHighlightedCell(null);
      setFocusedNotificationId(null);

      const res = core.handleCellClick(x, y, button);
      if (res.mutated) {
        bumpRender();
      }

      if (res.uiRequest) {
        setPreviewCellTypeId(null);
        setActiveInterface({
          cellX: res.uiRequest.cellX,
          cellY: res.uiRequest.cellY,
          screenX,
          screenY,
          interfaceId: res.uiRequest.interfaceId,
          params: res.uiRequest.params,
        });
        playTacticalSound('click', soundEnabled);
      } else {
        closeOverlays();
        if (res.mutated) {
          playTacticalSound('build', soundEnabled);
        }
      }
    },
    [core, closeOverlays, bumpRender, soundEnabled]
  );

  const handleResolveInterface = useCallback(
    (result: RuntimeValue) => {
      if (!core) return;
      const res = core.resolveActiveInterface(result);
      if (res.mutated) {
        bumpRender();
        playTacticalSound('build', soundEnabled);
      }
      if (res.uiRequest) {
        setActiveInterface((prev) =>
          prev
            ? {
                ...prev,
                cellX: res.uiRequest!.cellX,
                cellY: res.uiRequest!.cellY,
                interfaceId: res.uiRequest!.interfaceId,
                params: res.uiRequest!.params,
              }
            : null
        );
      } else {
        closeOverlays();
      }
    },
    [core, bumpRender, closeOverlays, soundEnabled]
  );

  const handleCancelInterface = useCallback(() => {
    if (core) {
      const res = core.cancelActiveInterface();
      if (res.mutated) {
        bumpRender();
      }
    }
    closeOverlays();
  }, [core, bumpRender, closeOverlays]);

  const handleTriggerInterfaceAction = useCallback(
    (interfaceId: InterfaceId, actionId: string, value?: RuntimeValue) => {
      if (!core || !activeInterface) return;
      const res = core.triggerInterfaceAction(
        interfaceId,
        actionId,
        activeInterface.cellX,
        activeInterface.cellY,
        activeInterface.params,
        value
      );
      if (res.mutated) {
        bumpRender();
        playTacticalSound('click', soundEnabled);
      }
      if (res.uiRequest) {
        setActiveInterface((prev) =>
          prev
            ? {
                ...prev,
                cellX: res.uiRequest!.cellX,
                cellY: res.uiRequest!.cellY,
                interfaceId: res.uiRequest!.interfaceId,
                params: res.uiRequest!.params,
              }
            : null
        );
      } else if (res.closeInterface) {
        closeOverlays();
      }
    },
    [core, activeInterface, bumpRender, closeOverlays, soundEnabled]
  );

  const handleFocusNotification = useCallback(
    (notification: GameNotification) => {
      if (
        notification.scope !== 'cell' ||
        notification.x === undefined ||
        notification.y === undefined
      ) {
        return;
      }
      closeOverlays();
      setFocusedNotificationId(notification.id);
      setHighlightedCell({ x: notification.x, y: notification.y });
      canvasRef.current?.focusCell(notification.x, notification.y);
      playTacticalSound('click', soundEnabled);
    },
    [closeOverlays, soundEnabled]
  );

  const handleDismissNotification = useCallback(
    (id: string) => {
      if (!core) return;
      core.dismissNotification(id);
      if (focusedNotificationId === id) {
        setFocusedNotificationId(null);
        setHighlightedCell(null);
      }
      bumpRender();
    },
    [core, focusedNotificationId, bumpRender]
  );

  const syncOverlayPositions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setActiveInterface((prev) => {
      if (!prev) return null;
      const pos = canvas.getCellScreenPosition(prev.cellX, prev.cellY);
      return { ...prev, screenX: pos.x, screenY: pos.y };
    });
  }, []);

  const handleZoomChange = useCallback(
    (nextZoomPercent: number) => {
      setZoomPercent(nextZoomPercent);
      syncOverlayPositions();
    },
    [syncOverlayPositions]
  );

  const handleViewportResize = useCallback(
    (width: number, height: number) => {
      setViewportSize({ width, height });
      syncOverlayPositions();
    },
    [syncOverlayPositions]
  );

  const isGameActive = screen === 'PLAYING';

  // Global keyboard shortcuts during active game
  useEffect(() => {
    if (!isGameActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.code === 'Escape') {
        if (showExitConfirm) {
          setShowExitConfirm(false);
        } else {
          handleCancelInterface();
          setHighlightedCell(null);
          setFocusedNotificationId(null);
        }
      } else if (
        !showExitConfirm &&
        (e.code === 'Enter' || e.key === 'n' || e.key === 'N')
      ) {
        e.preventDefault();
        handleNextTurn();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isGameActive, showExitConfirm, handleCancelInterface, handleNextTurn]);

  const stats = useMemo(() => {
    if (!core) return null;
    return core.getStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, renderVersion]);

  const notifications = useMemo(() => {
    if (!core) return [];
    return core.notifications;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, renderVersion]);

  const inspectedCoord = hoveredCell ?? highlightedCell;

  if (screen === 'STUDIO' && studioManifest) {
    return (
      <RulesetStudio
        initialManifest={studioManifest}
        builtIn={studioBuiltIn}
        initialDirty={studioDirty}
        existingRulesetIds={rulesets.map((r) => r.manifest.id)}
        onSaveCustom={handleSaveStudioRuleset}
        onDuplicateToCustom={handleDuplicateStudioRuleset}
        onTestPlay={handleTestPlay}
        onBackToMenu={() => {
          setStudioDirty(false);
          setRulesets(getAllRulesets());
          setScreen('MENU');
          playTacticalSound('click', soundEnabled);
        }}
      />
    );
  }

  if (screen === 'MENU' || !core || !stats) {
    return (
      <MainMenu
        rulesets={rulesets}
        saves={saves}
        defaultSaveName={`Colony ${saves.length + 1}`}
        onStartNewGame={handleStartNewGame}
        onLoadSave={handleLoadSave}
        onDeleteSave={handleDeleteSave}
        onImportRuleset={handleImportRuleset}
        onDeleteRuleset={handleDeleteRuleset}
        onOpenStudio={handleOpenStudio}
        onCreateNewRuleset={handleCreateNewRuleset}
      />
    );
  }

  const overlaySupplies = core.manifest.supplies.filter(
    (s) => s.showInOverlay !== false
  );
  const resolvedSupplyId =
    activeSupplyId && overlaySupplies.some((s) => s.id === activeSupplyId)
      ? activeSupplyId
      : (overlaySupplies[0]?.id ?? null);

  const selectedCell = activeInterface
    ? { x: activeInterface.cellX, y: activeInterface.cellY }
    : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F14] text-[#E6EDF3] overflow-hidden">
      <TopBar
        saveName={activeSaveName}
        globalState={core.manifest.globalState}
        stats={stats}
        exitLabel={isPlaytest ? 'Back to Studio' : undefined}
        onRequestExit={handleRequestExit}
        onNextTurn={handleNextTurn}
      />

      <main className="relative flex-1 flex min-h-0 overflow-hidden">
        <GridCanvas
          ref={canvasRef}
          core={core}
          renderVersion={renderVersion}
          overlayMode={overlayMode}
          activeSupplyId={resolvedSupplyId}
          selectedCell={selectedCell}
          highlightedCell={highlightedCell}
          previewCellTypeId={previewCellTypeId}
          onHoverCell={setHoveredCell}
          onCellClick={handleCellClick}
          onBackgroundClick={() => {
            handleCancelInterface();
            setHighlightedCell(null);
            setFocusedNotificationId(null);
          }}
          onZoomChange={handleZoomChange}
          onViewportResize={handleViewportResize}
        />

        {/* Top-Left: Supply Filters */}
        <SupplyFilterOverlay
          supplies={overlaySupplies}
          activeSupplyId={resolvedSupplyId}
          overlayMode={overlayMode}
          onSelectSupply={setActiveSupplyId}
          onChangeOverlayMode={setOverlayMode}
        />

        {/* Top-Center: Global & Clickable Cell Notifications */}
        <NotificationBanner
          notifications={notifications}
          focusedNotificationId={focusedNotificationId}
          onFocusNotification={handleFocusNotification}
          onDismissNotification={handleDismissNotification}
        />

        {/* Top-Right: Ruleset/Cell Hover Interface */}
        <HoverCellCard core={core} coord={inspectedCoord} />

        {/* Bottom-Left (Cursor Coords) & Bottom-Right (Zoom + Sound) */}
        <CanvasHudBottom
          hoveredCell={hoveredCell}
          zoomPercent={zoomPercent}
          soundEnabled={soundEnabled}
          onZoomIn={() => canvasRef.current?.zoomIn()}
          onZoomOut={() => canvasRef.current?.zoomOut()}
          onResetCamera={() => canvasRef.current?.resetCamera()}
          onToggleSound={() => setSoundEnabled((prev) => !prev)}
        />

        {/* Universal Built-in & Custom Node-Powered Interface Popover */}
        {activeInterface && (
          <InterfacePopover
            active={activeInterface}
            core={core}
            containerWidth={viewportSize.width}
            containerHeight={viewportSize.height}
            onResolve={handleResolveInterface}
            onCancel={handleCancelInterface}
            onTriggerAction={handleTriggerInterfaceAction}
            onHoverCellOption={setPreviewCellTypeId}
          />
        )}
      </main>

      {showExitConfirm && (
        <ExitConfirmModal
          saveName={activeSaveName}
          cycle={stats.cycle}
          onSaveAndExit={handleSaveAndExit}
          onExitWithoutSaving={handleExitWithoutSaving}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  );
}
