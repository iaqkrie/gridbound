# gridbound

![Version](https://img.shields.io/badge/version-0.1.0--alpha-10B981?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-0EA5E9?style=flat-square)
![Stack](https://img.shields.io/badge/stack-React%2019%20%C2%B7%20TypeScript%20%C2%B7%20Vite-1F2A38?style=flat-square)

**gridbound** is a turn-based cellular strategy engine and **visual Ruleset Studio** built around **Spatial Supplies** and **Global Resources**.

Every ruleset in gridbound is a pure JSON file (`schemaVersion: 2`). Cell behaviors, click actions, visuals, inspection panels, and procedural map generators are assembled visually in **Ruleset Studio** — or edited directly as JSON — with zero TypeScript code required.

> **Alpha Notice (`v0.1.0-alpha`):** Core simulation engine, Schema v2 JSON format, Visual Ruleset Studio, and the built-in `Classic Colony` ruleset are live and playable. Expect breaking schema refinements before `v1.0.0`.

<!-- Replace the URL below once you publish a live demo (GitHub Pages / Cloud Run / AI Studio) -->
**Live Demo:** [Play gridbound in your browser](https://iaqkrie.github.io/gridbound/)

---

## Highlights

### Ruleset Studio (Visual Editor)
Build complete turn-based grid games without hand-writing JSON:
- **Start Anywhere:** create a blank ruleset from scratch, edit your custom rulesets, or **Clone & Edit** any built-in ruleset (including `Classic Colony`).
- **Structured When / Do / Else Cards:** author `onCycle`, `onClick` (left & right), `onBuild`, `onDemolish`, and `onLost` rules with dropdown pickers, reordering, duplication, `stop` control, and nested `any` / `not` conditions.
- **34-Icon Vector Gallery + Glyphs:** choose from 34 categorized vector icons (`Terrain`, `Industry`, `Civic`, `Special`), optional 1–2 character `glyph` overlays, full-tile fills, borders, conditional visual overrides, and `dot` / `bar` indicators.
- **Live World Generator Preview:** configure `fill`, `clusters`, `scatter`, and `placeNear` steps with a real-time mini-map preview and seed roller.
- **Safe Cascade ID Renaming & Validation:** renaming a resource, supply, or cell ID updates every reference across the ruleset automatically; live validation issues jump straight to the exact section or cell.
- **One-Click Test Play Sandbox:** launch an unsaved draft directly in a live sandbox with **New Seed** and **Back to Editor** controls, or save to your local browser library and **Export / Import `.json`**.

### 3-Phase Cellular Simulation Engine (`SimulationCore`)
Every cycle runs deterministically in three phases:
1. **Consume & Transition:** evaluate each cell's `onCycle` rules — check local spatial supplies, global resources, neighbors, or cell state; consume inputs, mutate state, or transform cells.
2. **Spatial Supply Decay:** decay per-tile supply fields (`clear`, `none`, `linear`, or `percent` retention).
3. **Produce & Emit:** emit spatial supplies across `moore`, `vonNeumann`, or `self` neighborhoods and add produced global resources for the next cycle.

### Built-in Ruleset: `Classic Colony`
A complete colony-management ruleset showcasing Schema v2:
- **Map Setup:** `16×12`, `32×24`, and `64×48` presets, custom seeds, and configurable terrain density.
- **Global Resources:** Money, Food, Wood, Stone, Population (unlimited and capped storage).
- **Spatial Supply:** Moisture emitted by Water tiles and consumed by Farms.
- **Cell Types:** Empty, Water, Forest, Mountain, Farm, Sawmill, Quarry, House, Warehouse (with configurable storage cap bonuses and worker transfer panels).

---

## Controls

| Input | Action |
| --- | --- |
| **Left Click** | Trigger cell's `onClick.left` rule (e.g. open Build Menu on Empty tile, open Cell Panel on buildings) |
| **Right Click** | Trigger cell's `onClick.right` rule (e.g. Demolish confirmation) |
| **Mouse Wheel** | Zoom in / out around cursor |
| **Middle Drag** or **Space + Drag** | Pan across the grid |
| **Enter** or **N** | Advance to the Next Cycle |
| **Esc** | Close open popovers / return menu |

---

## Quick Start

Requires **Node.js 20+** (no API keys or `.env` configuration needed).

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
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
│   ├── editor/                 # Ruleset Studio UI (rule cards, icon picker, generator preview, panel builder)
│   ├── canvasRenderer.ts       # High-DPI Canvas 2D renderer (Path2D icons, glyphs, overlays, previews)
│   ├── GridCanvas.tsx          # Viewport camera, zoom/pan, pointer interaction
│   ├── MainMenu.tsx            # New game setup, saves, JSON import, Ruleset Studio entry
│   ├── TopBar.tsx              # Resource HUD, cycle button, sandbox controls
│   └── ...                     # CellPanelView, BuildMenu, HoverCellCard, overlays
├── engine/
│   ├── sdk/
│   │   ├── types.ts            # Ruleset Schema v2 TypeScript definitions
│   │   ├── icons.ts            # Shared 34-icon 24×24 vector registry (Canvas + SVG)
│   │   ├── interpreter.ts      # Condition/Action rule evaluator & visual resolver
│   │   ├── generator.ts        # Deterministic seeded world generator pipeline
│   │   ├── decay.ts            # Spatial supply & resource decay processor
│   │   ├── validator.ts        # Strict manifest validator with structured issue navigation
│   │   └── refactor.ts         # Blank/clone factories & safe cascade ID renaming
│   ├── SimulationCore.ts       # 3-phase ruleset-agnostic simulation core
│   └── saveStore.ts            # Local browser save slots (localStorage)
├── i18n/                       # UI strings (en)
├── rulesets/
│   ├── classic-colony/
│   │   └── ruleset.json        # Built-in Classic Colony ruleset (Schema v2)
│   └── index.ts                # Built-in + localStorage custom ruleset store
└── utils/
    └── sound.ts                # Procedural Web Audio tactical feedback
```

---

## Ruleset Schema v2 Reference

You can author rulesets visually in **Ruleset Studio**, export them as `.json`, or write them by hand. See [`src/rulesets/classic-colony/ruleset.json`](./src/rulesets/classic-colony/ruleset.json) for a full working example.

### Top-Level Manifest

```json
{
  "schemaVersion": 2,
  "id": "my_ruleset",
  "name": "My Ruleset",
  "author": "Your Name",
  "description": "Short summary of the ruleset.",
  "defaultGridSize": { "width": 16, "height": 12 },
  "defaultCellTypeId": "empty",
  "initialCycles": 1,
  "setupOptions": { "allowSeed": true, "mapSizes": [], "params": [] },
  "resources": [],
  "supplies": [],
  "worldGenerator": [],
  "cellTypes": []
}
```

### Global Resources (`resources`) & Spatial Supplies (`supplies`)

- **Unlimited Resource:** `{ id, name, shortName?, color, kind: "unlimited", initialValue, tags?, decay? }`
- **Capped Resource:** `{ id, name, shortName?, color, kind: "capped", initialValue, initialMax, tags?, decay? }`
- **Spatial Supply:** `{ id, name, description?, color, maxExpected, maxAmount?, decay }`
- **Decay Rules (`decay`):**
  - `{ kind: "clear" }` — reset to `0` each cycle
  - `{ kind: "none" }` — persist indefinitely
  - `{ kind: "linear", amount }` — subtract a fixed amount each cycle
  - `{ kind: "percent", retainRatio, round?: "floor" | "ceil" | "round", minStep? }` — retain a fraction (`0..1`) each cycle

### World Generator Pipeline (`worldGenerator`)

Executed sequentially on a fresh grid using a deterministic seeded RNG:
- `{ type: "fill", cell }`
- `{ type: "clusters", cell, clustersPer768, minClusters?, minSize, maxSize, onlyOnEmpty?, densityParam? }`
- `{ type: "scatter", cell, countPer768, minCount?, onlyOnEmpty?, densityParam? }`
- `{ type: "placeNear", cell, nearCell, radius?, neighborhood?, chance, maxCount?, onlyOnEmpty? }`

### Conditions (`when`)

All entries in `when` must pass (logical AND). Comparison operators (`op`): `"eq" | "neq" | "gt" | "gte" | "lt" | "lte"`.
- `{ type: "supply", id, op, value }` — local tile supply amount
- `{ type: "resource", id, op, value }` — global resource amount
- `{ type: "state", key, op, value }` — cell local state property
- `{ type: "neighbors", cell, op, value, radius?, neighborhood? }` — matching neighbor count
- `{ type: "chance", probability }` — deterministic probability roll (`0..1`)
- `{ type: "any", conditions: [...] }` — logical OR
- `{ type: "not", condition }` — logical NOT

### Actions (`do` / `else`)

- **Resources:** `addResource`, `consumeResource`, `reclaimResource`, `refundStateToResource`
- **Supplies:** `emitSupply` (`id`, `amount`, `radius`, `neighborhood`, `includeSelf?`), `consumeSupply`
- **Cell State & Type:** `setState`, `addState` (`min?`, `max?`), `transform` (`to`)
- **Feedback:** `notify` (`severity: "warning" | "danger"`, `title`, `message`)
- **UI Actions (`onClick` only):** `openBuildMenu` (`options`), `openPanel`, `openDemolishConfirm`

### Cell Types (`cellTypes`)

Each cell type supports:
- **Events:** `onCycle`, `onBuild`, `onDemolish`, `onLost` (arrays of `{ when?, do, else?, stop?, label?, tone? }`), and `onClick: { left?, right? }`.
- **State & Costs:** `initialState`, `buildCost`, `buildSound`, `shortRule`.
- **Passive Modifiers (`modifiers`):** `{ type: "capBonus", resource | resourceFromState, amount }`.
- **Visuals (`visual`):** `{ color, icon?, glyph?, fullTile?, svgPath?, border?, substrateColor?, rules?, indicators? }` where `rules` can conditionally override `color`, `icon`, `glyph`, `border`, and `dim`, and `indicators` render `dot` or `bar` overlays.
- **Hover Badges (`badges`):** `{ when?, text, tone }`.
- **Interactive Panel (`panel`):** `{ title?, blocks: [...] }` supporting `stat`, `transfer`, `resourceSelect`, and `actionButton`.

---

## License

Released under the [MIT License](./LICENSE).
