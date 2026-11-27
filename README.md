# gridbound

![Version](https://img.shields.io/badge/version-0.1.0--alpha.2-10B981?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-0EA5E9?style=flat-square)
![Stack](https://img.shields.io/badge/stack-React%2019%20%C2%B7%20TypeScript%20%C2%B7%20Vite-1F2A38?style=flat-square)

**gridbound** is a turn-based cellular strategy engine, **node-native Schema v4 SDK**, and **Visual Ruleset Studio** built around **Spatial Supplies**, access-controlled **GlobalState**, **32×32 PNG sprites**, and **Universal Interfaces**.

Every ruleset in gridbound is a self-contained manifest (`schemaVersion: 4`). Cell behaviors, world-level logic, custom UI popovers & hover cards, 32×32 pixel-art sprites, and procedural layer/mask map generators are authored visually in **Ruleset Studio** and executed by a deterministic load-time compiled graph VM — with zero TypeScript code required.

> **Alpha Notice (`v0.1.0-alpha.2`):** Node-native Schema v4 engine, Visual Ruleset Studio, 32×32 pixel-art editor, live world generator preview, and the rebuilt `Classic Colony` ruleset are live and playable. Expect schema refinements before `v1.0.0`.

**Live Demo:** [Play gridbound in your browser](https://iaqkrie.github.io/gridbound/)

---

## Highlights

### Visual Ruleset Studio
Create complete turn-based grid games directly in the browser:
- **Start Anywhere:** create a new ruleset from scratch, edit custom rulesets, or open any built-in ruleset (including `Classic Colony`) in read-only mode and click **Duplicate as Custom**.
- **Unified Node Graph Editor:** wire typed color-coded ports (`exec`, `number`, `boolean`, `string`, `any`, `mask`, `layer`) across **Cell Behavior**, **Global World Logic**, **Interface Actions**, and **World Generation**, complete with pan/zoom, right-click-at-cursor searchable node palette, drag-wire-to-create compatible auto-wired nodes, Auto Layout, Fit View, and a contextual Node Inspector.
- **Sprites (`32×32 PNG`) + Built-in Pixel Editor:** upload PNG images (auto-resized nearest-neighbor to 32×32) or paint directly in the integrated 32×32 pixel-art editor with pencil, eraser, flood-fill, eyedropper, palette, undo/redo, flip, grid toggle, and live scale preview.
- **GlobalState & Access Control:** configure `public`, `readonly`, and `private` global variables, optional dynamic caps (`global.addCap`), a customizable HUD bar with live TopBar preview, and world-level `On Start` / `On Cycle` logic.
- **WorldGenerator + Live Map Preview:** compose procedural terrain from 2D masks (`gen.noise`, `gen.clusters`, `gen.scatter`, `gen.proximity`, `gen.maskMath`, `gen.threshold`) and cell layers (`gen.fillLayer`, `gen.paintLayer`, `gen.mergeLayers`) while inspecting a live sprite-rendered map preview with seed rolling, grid size presets, setup options, and tile distribution.
- **Universal Interfaces:** reuse built-in engine templates (`@builtin/cell_picker`, `@builtin/confirm`, `@builtin/inspector`) or clone them into custom interfaces with a visual Block Builder, Live Preview, and scoped Interface Logic Graph.
- **Live Validation, JSON Export & Instant Test Play:** validate Schema v4 manifests in real time, save with `Ctrl+S`, export/import `.json`, and click **Test Play** to launch an ephemeral playtest session on your unsaved draft with one-click **Back to Studio**.

### 4-Phase Node-Native Simulation Engine (`SimulationCore`)
Every cycle executes deterministically in four phases:
1. **Decay:** apply `DecayRule` (`clear`, `none`, `linear`, or `percent`) across all spatial supplies and decaying global variables.
2. **Emit:** run `event.emit` graphs on active cells to broadcast numeric spatial supplies (`self`, `moore`, `vonNeumann`, `relative`, `coords`).
3. **World Cycle:** run GlobalState `event.cycle` logic (full read/write access to `public`, `readonly`, and `private` globals).
4. **Cell React:** execute `event.cycle` graphs on cells (ordered by optional `priorityByState`), mutating state, consuming/adding resources, updating per-instance visuals (`setSprite`, `setColor`, `setOpacity`), or transforming tiles (`event.exit` → `event.enter`).

### Built-in Ruleset: `Classic Colony`
A complete colony-management ruleset powered natively by Schema v4:
- **Setup Options:** configurable map sizes (`10×10`, `14×14`, `20×20`), custom seeds, and procedural terrain parameters (`waterLevel`, `forestDensity`).
- **GlobalState:** Money, Food, Wood, Stone, and Population with dynamic housing & warehouse capacity caps.
- **Spatial Supply:** Moisture emitted by Water tiles and consumed by Farms.
- **9 Cell Types & Custom Interfaces:** Empty, Water, Forest, Mountain, Farm, Sawmill, Quarry, House, and Warehouse — with custom worker assignment, resource cap selector, build picker, and demolish confirmation flows.

---

## Controls

| Input | Action |
| --- | --- |
| **Left Click** | Trigger cell's `event.click` graph (e.g. open Cell Picker or custom cell interface) |
| **Right Click** | Trigger cell's `event.rightClick` graph (e.g. Demolish confirmation) |
| **Mouse Wheel** | Zoom in / out around cursor |
| **Middle Drag** or **Space + Drag** | Pan across the grid |
| **Enter** or **N** | Advance to the Next Cycle |
| **Esc** | Close open popovers / cancel active interface |
| **Ctrl+S / Cmd+S** *(Studio)* | Quick-save current custom ruleset |

---

## Quick Start

Requires **Node.js 20+** (no API keys or `.env` configuration needed).

```bash
git clone https://github.com/iaqkrie/gridbound.git
cd gridbound
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite development server on port `3000` |
| `npm run build` | Build production static bundle into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run TypeScript typechecking (`tsc --noEmit`) |

---

## Project Structure

```text
src/
├── components/
│   ├── studio/                 # Visual Ruleset Studio
│   │   ├── RulesetStudio.tsx   # Studio shell, validation, JSON export, Test Play
│   │   ├── NodeGraphEditor.tsx # Shared pan/zoom SVG+HTML node graph canvas
│   │   ├── NodeInspector.tsx   # Scoped parameter inspector for all node types
│   │   ├── GeneralTab.tsx      # Identity, defaults, setupOptions CRUD
│   │   ├── SpritesTab.tsx      # 32×32 PNG upload + built-in pixel-art editor
│   │   ├── GlobalStateTab.tsx  # Variables, HUD bar + live preview, World Logic
│   │   ├── SuppliesTab.tsx     # Unified numeric spatial supplies & DecayRules
│   │   ├── WorldGeneratorTab.tsx # Layer/mask graph + live sprite map preview
│   │   ├── CellsTab.tsx        # Cell properties, state schema, Behavior Graph
│   │   ├── InterfacesTab.tsx   # Built-in cloning, Block Builder, preview, Logic Graph
│   │   └── studioUtils.ts      # Starter/clone factories, auto-layout, PNG 32×32 helpers
│   ├── canvasRenderer.ts       # High-DPI Canvas 2D sprite & supply overlay renderer
│   ├── GridCanvas.tsx          # Viewport camera, zoom/pan, pointer interaction
│   ├── InterfacePopover.tsx    # Universal renderer for built-in & custom interfaces
│   ├── HoverCellCard.tsx       # Ruleset default / per-cell hover interface card
│   ├── MainMenu.tsx            # New game setup, saves, JSON import, Studio entry
│   ├── TopBar.tsx              # GlobalState HUD, cycle button, Playtest return
│   └── ...                     # CellPopover, NotificationBanner, overlays
├── engine/
│   ├── sdk/
│   │   ├── types.ts            # Schema v4 manifest, node graph, and runtime types
│   │   ├── nodeRegistry.ts     # Scoped node catalog (cell, global, interface, generator)
│   │   ├── graphVm.ts          # Load-time graph compiler, VM executor & UI template engine
│   │   ├── builtinInterfaces.ts # @builtin/cell_picker, confirm, inspector + clone helper
│   │   ├── spritePng.ts        # Zero-dependency 32×32 PNG encoder & pixel-art builder
│   │   ├── generator.ts        # Deterministic 2D Mask & Layer World Generator
│   │   ├── decay.ts            # Spatial supply & variable decay + seeded PRNG
│   │   └── validator.ts        # Strict Schema v4 manifest & graph validator
│   ├── SimulationCore.ts       # 4-phase ruleset-agnostic simulation core
│   └── saveStore.ts            # Local browser save slots (localStorage, v4)
├── i18n/                       # UI strings (en)
├── rulesets/
│   ├── classic-colony/         # Built-in Classic Colony ruleset (Schema v4)
│   └── index.ts                # Built-in + localStorage custom ruleset store
└── utils/
    └── sound.ts                # Procedural Web Audio tactical feedback
```

---

## Ruleset Schema v4 Overview

Rulesets are authored visually in **Ruleset Studio** and can be exported/imported as portable `.json` files:

```json
{
  "schemaVersion": 4,
  "id": "my_ruleset",
  "name": "My Ruleset",
  "author": "Author",
  "description": "Custom cellular strategy ruleset.",
  "defaultGridSize": { "width": 12, "height": 12 },
  "defaultCellTypeId": "empty",
  "defaultHoverInterfaceId": "@builtin/inspector",
  "setupOptions": [],
  "sprites": [],
  "globalState": { "variables": [], "hud": [], "graph": { "nodes": [], "edges": [] } },
  "supplies": [],
  "interfaces": [],
  "worldGenerator": { "nodes": [], "edges": [] },
  "cellTypes": []
}
```

- **GlobalState:** typed variables (`number`, `boolean`, `string`) with `access: "public" | "readonly" | "private"`, optional `hasCap` / `initialMax`, `hud` layout entries, and a world `graph` (`event.start`, `event.cycle`).
- **Supplies:** unified numeric spatial fields (`clear`, `none`, `linear`, `percent` decay) emitted by cells and queried via `supply.get` / `supply.consume`.
- **Sprites:** 32×32 PNG assets (`dataUrl`) rendered crisply onto tiles and dynamically swappable at runtime via `cell.setSprite`, `cell.setColor`, and `cell.setOpacity`.
- **Interfaces:** built-in templates (`@builtin/cell_picker`, `@builtin/confirm`, `@builtin/inspector`) or custom `InterfaceManifest` definitions (`popover`, `modal`, `hover`) combining declarative blocks (`text`, `stat`, `button`, `buttonRow`, `selectList`, `cellStateList`, `supplyList`) with `event.uiAction` graphs and `On Result` / `On Cancel` continuation pins.
- **WorldGenerator:** deterministic layer/mask node graph driven by world seed and `setupOptions`.

---

## License

Released under the [MIT License](./LICENSE).
