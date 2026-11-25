import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BuildMenu, BuildMenuState } from './components/BuildMenu';
import { CanvasHudBottom } from './components/CanvasHudBottom';
import { CellPopover } from './components/CellPopover';
import {
  DemolishConfirm,
  DemolishMenuState,
} from './components/DemolishConfirm';
import { ExitConfirmModal } from './components/ExitConfirmModal';
import { GridCanvas, GridCanvasHandle } from './components/GridCanvas';
import { HoverCellCard } from './components/HoverCellCard';
import { MainMenu } from './components/MainMenu';
import { NotificationBanner } from './components/NotificationBanner';
import { SupplyFilterOverlay } from './components/SupplyFilterOverlay';
import { TopBar } from './components/TopBar';
import { SimulationCore } from './engine/SimulationCore';
import {
  CellNotification,
  CellTypeId,
  GridCoordinate,
  MouseButton,
  SupplyId,
  SupplyOverlayMode,
  WorldSetupValues,
} from './engine/sdk';
import { SaveSlot, saveStore } from './engine/saveStore';
import { t } from './i18n';
import { RULESETS, getRulesetById } from './rulesets';
import { SoundKind, playTacticalSound } from './utils/sound';

type ScreenMode = 'MENU' | 'PLAYING';

interface CellPanelMenuState {
  cellX: number;
  cellY: number;
  screenX: number;
  screenY: number;
}

export default function App() {
  const [screen, setScreen] = useState<ScreenMode>('MENU');
  const [saves, setSaves] = useState<SaveSlot[]>(() => saveStore.list());
  const [activeSaveId, setActiveSaveId] = useState<string | null>(null);
  const [activeSaveName, setActiveSaveName] = useState<string>('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [core, setCore] = useState<SimulationCore | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [overlayMode, setOverlayMode] = useState<SupplyOverlayMode>('heatmap');
  const [activeSupplyId, setActiveSupplyId] = useState<SupplyId | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [hoveredCell, setHoveredCell] = useState<GridCoordinate | null>(null);
  const [buildMenu, setBuildMenu] = useState<BuildMenuState | null>(null);
  const [panelMenu, setPanelMenu] = useState<CellPanelMenuState | null>(null);
  const [demolishMenu, setDemolishMenu] = useState<DemolishMenuState | null>(
    null
  );
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
    setBuildMenu(null);
    setPanelMenu(null);
    setDemolishMenu(null);
    setPreviewCellTypeId(null);
  }, []);

  const bumpRender = useCallback(() => {
    setRenderVersion((v) => v + 1);
  }, []);

  const handleStartNewGame = useCallback(
    (rulesetId: string, saveName: string, setup: WorldSetupValues) => {
      const ruleset = getRulesetById(rulesetId);
      const nextCore = SimulationCore.createNewGame(ruleset, setup);
      const slot = saveStore.create(saveName, nextCore);

      setSaves(saveStore.list());
      setCore(nextCore);
      setActiveSaveId(slot.id);
      setActiveSaveName(slot.name);
      setOverlayMode(ruleset.manifest.defaultOverlayMode);
      setActiveSupplyId(ruleset.manifest.supplies[0]?.id ?? null);
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
      const slot = saveStore.get(saveId);
      if (!slot) return;
      const ruleset = getRulesetById(slot.rulesetId);
      const loadedCore = SimulationCore.deserialize(ruleset, slot.snapshot);

      setCore(loadedCore);
      setActiveSaveId(slot.id);
      setActiveSaveName(slot.name);
      setOverlayMode(ruleset.manifest.defaultOverlayMode);
      setActiveSupplyId(ruleset.manifest.supplies[0]?.id ?? null);
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
      saveStore.remove(saveId);
      setSaves(saveStore.list());
      playTacticalSound('erase', soundEnabled);
    },
    [soundEnabled]
  );

  const handleRequestExit = useCallback(() => {
    closeOverlays();
    setShowExitConfirm(true);
  }, [closeOverlays]);

  const handleSaveAndExit = useCallback(() => {
    if (core && activeSaveId) {
      saveStore.update(activeSaveId, core);
    }
    setShowExitConfirm(false);
    setHoveredCell(null);
    setFocusedNotificationId(null);
    setHighlightedCell(null);
    setSaves(saveStore.list());
    setScreen('MENU');
    playTacticalSound('click', soundEnabled);
  }, [core, activeSaveId, soundEnabled]);

  const handleExitWithoutSaving = useCallback(() => {
    setShowExitConfirm(false);
    setHoveredCell(null);
    setFocusedNotificationId(null);
    setHighlightedCell(null);
    setSaves(saveStore.list());
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

  const handleCellClick = useCallback(
    (
      x: number,
      y: number,
      button: MouseButton,
      screenX: number,
      screenY: number
    ) => {
      if (!core) return;
      setHighlightedCell(null);
      setFocusedNotificationId(null);
      const action = core.handleCellClick(x, y, button);

      if (action.kind === 'openBuildMenu') {
        setPanelMenu(null);
        setDemolishMenu(null);
        setBuildMenu({
          cellX: x,
          cellY: y,
          screenX,
          screenY,
          options: action.options,
        });
        setPreviewCellTypeId(null);
        playTacticalSound('click', soundEnabled);
      } else if (action.kind === 'openPanel') {
        const cellType = core.getCellTypeAt(x, y);
        if (!cellType.panel) {
          closeOverlays();
          return;
        }
        setBuildMenu(null);
        setDemolishMenu(null);
        setPreviewCellTypeId(null);
        setPanelMenu({
          cellX: x,
          cellY: y,
          screenX,
          screenY,
        });
        playTacticalSound('click', soundEnabled);
      } else if (action.kind === 'openDemolishConfirm') {
        const cellType = core.getCellTypeAt(x, y);
        setBuildMenu(null);
        setPanelMenu(null);
        setPreviewCellTypeId(null);
        setDemolishMenu({
          cellX: x,
          cellY: y,
          screenX,
          screenY,
          cellType,
        });
        playTacticalSound('click', soundEnabled);
      } else if (action.kind === 'setCell') {
        closeOverlays();
        bumpRender();
        playTacticalSound('build', soundEnabled);
      } else {
        closeOverlays();
      }
    },
    [core, closeOverlays, bumpRender, soundEnabled]
  );

  const handleBuildSelect = useCallback(
    (cellTypeId: CellTypeId) => {
      if (!core || !buildMenu) return;
      const res = core.buildCell(buildMenu.cellX, buildMenu.cellY, cellTypeId);
      if (!res.ok) return;
      closeOverlays();
      bumpRender();
      playTacticalSound('build', soundEnabled);
    },
    [core, buildMenu, closeOverlays, bumpRender, soundEnabled]
  );

  const handlePanelMutated = useCallback(
    (sound?: SoundKind) => {
      bumpRender();
      if (sound) {
        playTacticalSound(sound, soundEnabled);
      }
    },
    [bumpRender, soundEnabled]
  );

  const handleConfirmDemolish = useCallback(() => {
    if (!core || !demolishMenu) return;
    const res = core.demolishCell(demolishMenu.cellX, demolishMenu.cellY);
    closeOverlays();
    if (res.ok) {
      bumpRender();
      playTacticalSound('erase', soundEnabled);
    }
  }, [core, demolishMenu, closeOverlays, bumpRender, soundEnabled]);

  const handleFocusNotification = useCallback(
    (notification: CellNotification) => {
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

  const handleViewportResize = useCallback((width: number, height: number) => {
    setViewportSize({ width, height });
  }, []);

  // Global keyboard shortcuts during active game
  useEffect(() => {
    if (screen !== 'PLAYING') return;

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
          closeOverlays();
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
  }, [screen, showExitConfirm, closeOverlays, handleNextTurn]);

  const stats = useMemo(() => {
    if (!core) return null;
    return core.getStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, renderVersion]);

  const notifications = useMemo(() => {
    if (!core) return [];
    return core.getNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, renderVersion]);

  const inspectedCoord = hoveredCell ?? highlightedCell;

  const inspection = useMemo(() => {
    if (!core || !inspectedCoord) return null;
    return core.inspectCell(inspectedCoord.x, inspectedCoord.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, inspectedCoord?.x, inspectedCoord?.y, renderVersion]);

  const buildMenuSupplies = useMemo(() => {
    if (!core || !buildMenu) return {};
    return core.getLocalSupplies(buildMenu.cellX, buildMenu.cellY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, buildMenu?.cellX, buildMenu?.cellY, renderVersion]);

  const panelMenuData = useMemo(() => {
    if (!core || !panelMenu) return null;
    return {
      cellType: core.getCellTypeAt(panelMenu.cellX, panelMenu.cellY),
      state: core.getCellStateAt(panelMenu.cellX, panelMenu.cellY),
      supplies: core.getLocalSupplies(panelMenu.cellX, panelMenu.cellY),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, panelMenu?.cellX, panelMenu?.cellY, renderVersion]);

  const demolishInfo = useMemo(() => {
    if (!core || !demolishMenu) return {};
    return core.getDemolishInfo(demolishMenu.cellX, demolishMenu.cellY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, demolishMenu?.cellX, demolishMenu?.cellY, renderVersion]);

  if (screen === 'MENU' || !core || !stats) {
    return (
      <MainMenu
        rulesets={RULESETS}
        saves={saves}
        defaultSaveName={saveStore.nextDefaultName()}
        onStartNewGame={handleStartNewGame}
        onLoadSave={handleLoadSave}
        onDeleteSave={handleDeleteSave}
      />
    );
  }

  const resolvedSupplyId =
    activeSupplyId &&
    core.manifest.supplies.some((s) => s.id === activeSupplyId)
      ? activeSupplyId
      : (core.manifest.supplies[0]?.id ?? null);

  const selectedCell = buildMenu
    ? { x: buildMenu.cellX, y: buildMenu.cellY }
    : panelMenu
      ? { x: panelMenu.cellX, y: panelMenu.cellY }
      : demolishMenu
        ? { x: demolishMenu.cellX, y: demolishMenu.cellY }
        : null;

  const ActivePanelComponent = panelMenuData?.cellType.panel?.component ?? null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F14] text-[#E6EDF3] overflow-hidden">
      <TopBar
        saveName={activeSaveName}
        resources={core.manifest.resources}
        stats={stats}
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
            closeOverlays();
            setHighlightedCell(null);
            setFocusedNotificationId(null);
          }}
          onZoomChange={setZoomPercent}
          onViewportResize={handleViewportResize}
        />

        {/* Top-Left: Supply Filters */}
        <SupplyFilterOverlay
          supplies={core.manifest.supplies}
          activeSupplyId={resolvedSupplyId}
          overlayMode={overlayMode}
          onSelectSupply={setActiveSupplyId}
          onChangeOverlayMode={setOverlayMode}
        />

        {/* Top-Center: Clickable Cell Notifications */}
        <NotificationBanner
          notifications={notifications}
          focusedNotificationId={focusedNotificationId}
          onFocusNotification={handleFocusNotification}
          onDismissNotification={handleDismissNotification}
        />

        {/* Top-Right: Compact Hover Cell Brief */}
        <HoverCellCard
          inspection={inspection}
          supplies={core.manifest.supplies}
        />

        {/* Bottom-Left (Cursor Cell Coords) & Bottom-Right (Zoom + Sound) */}
        <CanvasHudBottom
          hoveredCell={hoveredCell}
          zoomPercent={zoomPercent}
          soundEnabled={soundEnabled}
          onZoomIn={() => canvasRef.current?.zoomIn()}
          onZoomOut={() => canvasRef.current?.zoomOut()}
          onResetCamera={() => canvasRef.current?.resetCamera()}
          onToggleSound={() => setSoundEnabled((prev) => !prev)}
        />

        {/* Contextual Popovers */}
        {buildMenu && (
          <BuildMenu
            menu={buildMenu}
            manifest={core.manifest}
            cellTypes={core.getCellTypes()}
            currentResources={stats.resources}
            resourceCaps={stats.resourceCaps}
            localSupplies={buildMenuSupplies}
            checkAffordability={(cellTypeId) => core.canAfford(cellTypeId)}
            containerWidth={viewportSize.width}
            containerHeight={viewportSize.height}
            onSelect={handleBuildSelect}
            onHoverOption={setPreviewCellTypeId}
            onClose={closeOverlays}
          />
        )}

        {panelMenu &&
          panelMenuData &&
          panelMenuData.cellType.panel &&
          ActivePanelComponent && (
            <CellPopover
              title={panelMenuData.cellType.name}
              swatchColor={panelMenuData.cellType.visual.color}
              cellX={panelMenu.cellX}
              cellY={panelMenu.cellY}
              screenX={panelMenu.screenX}
              screenY={panelMenu.screenY}
              containerWidth={viewportSize.width}
              containerHeight={viewportSize.height}
              width={272}
              estimatedHeight={220}
              ariaLabel={panelMenuData.cellType.name}
              closeAriaLabel={t('common.close')}
              onClose={closeOverlays}
            >
              <ActivePanelComponent
                x={panelMenu.cellX}
                y={panelMenu.cellY}
                cellType={panelMenuData.cellType}
                cellState={panelMenuData.state}
                localSupplies={panelMenuData.supplies}
                world={core.getWorldApi()}
                params={panelMenuData.cellType.panel.params}
                onMutated={handlePanelMutated}
                onClose={closeOverlays}
              />
            </CellPopover>
          )}

        {demolishMenu && (
          <DemolishConfirm
            menu={demolishMenu}
            resources={core.manifest.resources}
            demolishInfo={demolishInfo}
            containerWidth={viewportSize.width}
            containerHeight={viewportSize.height}
            onConfirm={handleConfirmDemolish}
            onClose={closeOverlays}
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
