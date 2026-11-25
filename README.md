# gridbound

**Version:** `v0.1.0-alpha`  
**License:** [MIT](./LICENSE)  
**Authors:** iaqkrie, Gemini 4 Neon

**gridbound** is a turn-based cellular strategy game and modular simulation engine powered by **Spatial Supplies** and **Global Resources**. The core engine contains no hardcoded game mechanics — worlds, resources, cell behaviors, generators, and custom cell panels are defined as modular **Ruleset Packages**.

---

## Features (`v0.1.0-alpha`)

- **Ruleset-Agnostic 3-Phase Engine (`SimulationCore`)**
  - **Phase 1 — Consume & Transition:** cells consume spatial supplies and global resources, update state, or transition.
  - **Phase 2 — Decay:** declarative decay rules (`clear`, `none`, `linear`, `percent`).
  - **Phase 3 — Produce:** emit spatial supplies (`moore`, `vonNeumann`, `self`) and produce global resources for the next cycle.
- **2 Global Resource Kinds:** `unlimited` and `capped` (value / dynamic max).
- **Modular Ruleset SDK (`src/engine/sdk/`)**
  - Hybrid package format: declarative `ruleset.json` + TypeScript behaviors/generators + TSX cell panels.
  - Built-in modules: `builtin:clusters`, `builtin:producer`, `builtin:consumer`, `builtin:storage`, `builtin:workerPanel`, `builtin:storagePanel`.
  - Package validation and compilation (`validateRulesetPackage`, `compileRulesetPackage`).
- **Built-in Ruleset: `Classic Colony`**
  - Map sizes (`16×12`, `32×24`, `64×48`), custom seed, and terrain density options.
  - Resources: Money, Food, Wood, Stone, Population.
  - Cells: Water, Forest, Mountain, Farm, Sawmill, Quarry, House, Warehouse.
- **Interactive Canvas 2D Viewport:** zoom, pan, supply heatmap & value overlays, contextual cell popovers, and clickable notifications.
- **i18n Foundation (`src/i18n/`):** typed translation dictionary ready for additional locales.

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server on port `3000` |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript typecheck (`tsc --noEmit`) |

---

## Project Structure

```text
src/
├── components/        # Canvas renderer, HUD, menus, generic CellPopover
├── engine/
│   ├── sdk/           # Public Ruleset SDK (types, compiler, decay, builtins)
│   ├── SimulationCore.ts
│   └── saveStore.ts
├── i18n/              # Localization layer (en)
├── rulesets/
│   ├── classic-colony/
│   │   ├── ruleset.json
│   │   └── index.ts
│   └── index.ts       # Registered ruleset packages
└── utils/             # Web Audio feedback
```

---

## Creating a Custom Ruleset

1. Create `src/rulesets/<your-ruleset>/` with `ruleset.json` and `index.ts` exporting a `RulesetPackage`.
2. Compose built-in modules (`builtin:clusters`, `builtin:producer`, `builtin:consumer`, `builtin:storage`, `builtin:workerPanel`, `builtin:storagePanel`) or attach custom TS behaviors, generators, and TSX panels via `modules`.
3. Register the package in `src/rulesets/index.ts`.
