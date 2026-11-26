# Changelog

All notable changes to **gridbound** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
