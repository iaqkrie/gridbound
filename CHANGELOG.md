# Changelog

All notable changes to **gridbound** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0-alpha.1] - 2026-11-27

Major architectural overhaul introducing the **Node-Native Schema v4** engine core, universal interfaces, 32×32 PNG sprites, layer/mask world generation, and the all-new **Visual Ruleset Studio**.

### Added
- **Node-Native Ruleset Core & Graph VM (`Schema v4`)**
  - Unified node graph IR (`NodeGraph`) compiled at ruleset load time (`compileGraph`) and executed deterministically by `GraphVmSession` across four scopes: `cell`, `global`, `interface`, and `generator`.
  - Complete 4-phase simulation cycle: **Phase 1 (Supply & Global Decay)**, **Phase 2 (Cell Emit)**, **Phase 3 (Global World Cycle)**, and **Phase 4 (Cell React with `priorityByState` ordering)**.
  - Full cell lifecycle events (`event.click`, `event.rightClick`, `event.enter`, `event.exit`, `event.emit`, `event.cycle`) with `from`, `to`, and `reason` pins, plus world events (`event.start`, `event.cycle`) and interface events (`event.uiAction`).
  - Access-controlled **GlobalState** variables (`public`, `readonly`, `private`), dynamic capacity mutation (`global.addCap`), customizable HUD bar ordering, and read access to `setupOptions` in every graph scope.
  - Unified numeric **Spatial Supplies** with configurable `DecayRule` (`clear`, `none`, `linear`, `percent`) and flexible emit areas (`self`, `moore`, `vonNeumann`, `relative`, `coords`).
  - Per-instance runtime cell visuals (`cell.setSprite`, `cell.setColor`, `cell.setOpacity`) backed by a 32×32 PNG sprite registry.
  - Universal **Interfaces** system: read-only built-in templates (`@builtin/cell_picker`, `@builtin/confirm`, `@builtin/inspector`) plus custom block-based + node-driven interfaces, `On Result` / `On Cancel` continuation pins, and ruleset default + per-cell hover card overrides.
  - Layer & Mask **World Generator** graph (`gen.fillLayer`, `gen.paintLayer`, `gen.mergeLayers`, `gen.noise`, `gen.clusters`, `gen.scatter`, `gen.proximity`, `gen.maskMath`, `gen.threshold`, `gen.setupParam`, `gen.output`).
- **New Visual Ruleset Studio**
  - Unified interactive **Node Graph Editor** (pan/zoom, color-coded typed ports, Bezier wires, click-to-disconnect, right-click searchable scope-filtered Add Node palette, Auto Layout, Fit View, keyboard shortcuts, and contextual Node Inspector).
  - **7 Dedicated Studio Sections:** `General`, `Sprites` (PNG upload auto-resized to 32×32 + built-in 32×32 pixel-art editor with pencil/eraser/flood-fill/eyedropper, palette, undo/redo, flip, and live tile preview), `GlobalState` (Variables, HUD Bar with live TopBar preview, World Logic graph), `Supplies`, `WorldGenerator` (split graph + live sprite-rendered map preview with seed roller, size presets, setup options, and tile distribution), `Cells` (properties, visuals, hover override, state schema, Behavior Graph), and `Interfaces` (built-in template inspection & cloning, block builder, live preview, Logic Graph).
  - Built-in rulesets open in read-only inspection mode with one-click **Duplicate as Custom**.
  - Live Schema v4 manifest validation popover, JSON export, `Ctrl+S` quick save, unsaved-changes exit guard, and instant **Test Play** directly on unsaved drafts with **Back to Studio**.
- **Classic Colony (Schema v4)**
  - Rebuilt natively on Schema v4 node graphs, 32×32 pixel-art sprites, GlobalState access control, layer/mask world generation, and custom Warehouse/House/Worker interfaces.

### Changed
- **Breaking:** Upgraded manifest format from `schemaVersion: 2` to `schemaVersion: 4` and save slot format to `version: 4`.

## [0.1.0-alpha] - 2026-11-26

First public alpha pre-release of **gridbound** — a ruleset-agnostic cellular strategy engine and visual ruleset authoring studio.

### Added
- **3-Phase Cellular Simulation Engine (`SimulationCore`)**
  - Deterministic turn execution: Phase 1 (Consume & Transition), Phase 2 (Spatial Supply Decay), Phase 3 (Emit Supplies & Produce Resources).
  - Bounded grid with deterministic seeded RNG and per-cell local state.
- **Declarative JSON Ruleset Schema v2**
  - Pure JSON rulesets (`schemaVersion: 2`) requiring zero TypeScript code.
  - Top-level `resources` (`unlimited` and `capped`), `supplies` (with `clear`, `none`, `linear`, and `percent` decay rules), `setupOptions`, and sequential `worldGenerator` pipeline (`fill`, `clusters`, `scatter`, `placeNear`).
  - Structured rule lists (`when` / `do` / `else` / `stop`) for `onCycle`, `onClick` (`left` / `right`), `onBuild`, `onDemolish`, and `onLost`.
  - Conditional `visual.rules`, `visual.indicators` (`dot`, `bar`), hover `badges`, passive `modifiers` (`capBonus`), and declarative cell `panel` blocks (`stat`, `transfer`, `resourceSelect`, `actionButton`).
  - Strict manifest validator with structured section/cell diagnostics and automatic cascade ID renaming.
- **Ruleset Studio (Visual Ruleset Editor)**
  - Create blank rulesets from scratch, edit custom rulesets, or clone & modify any existing ruleset.
  - Structured **When / Do / Else** visual rule cards with inline pickers, reordering, duplication, and nested `not` / `any` logic.
  - Unified 34-icon vector gallery (`Terrain`, `Industry`, `Civic`, `Special`) plus optional 1–2 character `glyph`, `fullTile` fill toggle, and live tile preview.
  - World Generator editor with live mini-map preview and instant seed rolling.
  - One-click **Test Play** sandbox directly from the editor with **Back to Editor** and **New Seed** controls.
  - Local browser ruleset library (`localStorage`) plus JSON Import and Export.
- **Built-in Ruleset: `Classic Colony`**
  - Map sizes (`16×12`, `32×24`, `64×48`), custom seeds, and terrain density options.
  - 5 global resources (Money, Food, Wood, Stone, Population), Moisture spatial supply, and 9 cell types (Empty, Water, Forest, Mountain, Farm, Sawmill, Quarry, House, Warehouse).
- **Interactive Canvas 2D Viewport & Local Saves**
  - Smooth zoom/pan, supply heatmap and numeric overlays (off by default), contextual cell popovers, clickable event notifications, Web Audio tactical feedback, and local save slots.
