import { useState } from 'react';
import {
  CellVisualManifest,
  ICON_CATEGORIES,
  ICON_REGISTRY,
  IconCategory,
  getIconDef,
} from '../../engine/sdk';
import { INPUT_CLS, TACTICAL_COLORS } from './editorHelpers';

interface IconPickerProps {
  visual: CellVisualManifest;
  onChange: (next: CellVisualManifest) => void;
}

export function IconPicker({ visual, onChange }: IconPickerProps) {
  const activeIconDef = getIconDef(visual.icon);
  const [category, setCategory] = useState<IconCategory>(
    activeIconDef?.category ?? 'Terrain'
  );

  const filteredIcons = ICON_REGISTRY.filter((i) => i.category === category);
  const resolvedFullTile =
    visual.fullTile ?? Boolean(activeIconDef?.defaultFullTile);

  return (
    <div className="space-y-4">
      {/* Color Swatches + Hex */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-[#8B98A9]">Color</span>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={
                /^#[0-9a-fA-F]{6}$/.test(visual.color) ? visual.color : '#10B981'
              }
              onChange={(e) => onChange({ ...visual, color: e.target.value })}
              className="w-6 h-6 bg-transparent border border-[#1F2A38] rounded cursor-pointer"
              aria-label="Pick color"
            />
            <input
              type="text"
              value={visual.color}
              maxLength={7}
              onChange={(e) => onChange({ ...visual, color: e.target.value })}
              className={`${INPUT_CLS} w-20 font-mono text-[11px] uppercase`}
              aria-label="Hex color"
            />
          </div>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {TACTICAL_COLORS.map((hex) => {
            const active = visual.color.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                onClick={() => onChange({ ...visual, color: hex })}
                title={hex}
                aria-label={`Color ${hex}`}
                aria-pressed={active}
                className={`h-6 rounded-[4px] border transition-transform cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                  active
                    ? 'border-[#E6EDF3] scale-105'
                    : 'border-white/10 hover:border-white/35'
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </div>

      {/* Style Row: Fill mode, Border, Dim, Glyph */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <span className="block text-[11px] font-medium text-[#8B98A9] mb-1.5">
            Tile Fill
          </span>
          <div className="grid grid-cols-2 gap-1 bg-[#0B0F14] p-0.5 rounded-md border border-[#1F2A38]">
            <button
              type="button"
              onClick={() => onChange({ ...visual, fullTile: false })}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                !resolvedFullTile
                  ? 'bg-[#17202B] text-[#E6EDF3]'
                  : 'text-[#8B98A9] hover:text-[#E6EDF3]'
              }`}
            >
              Framed
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...visual, fullTile: true })}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                resolvedFullTile
                  ? 'bg-[#17202B] text-[#E6EDF3]'
                  : 'text-[#8B98A9] hover:text-[#E6EDF3]'
              }`}
            >
              Full
            </button>
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-medium text-[#8B98A9] mb-1.5">
            Border
          </span>
          <div className="grid grid-cols-2 gap-1 bg-[#0B0F14] p-0.5 rounded-md border border-[#1F2A38]">
            <button
              type="button"
              onClick={() => onChange({ ...visual, border: 'solid' })}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                (visual.border ?? 'solid') === 'solid'
                  ? 'bg-[#17202B] text-[#E6EDF3]'
                  : 'text-[#8B98A9] hover:text-[#E6EDF3]'
              }`}
            >
              Solid
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...visual, border: 'dashed' })}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                visual.border === 'dashed'
                  ? 'bg-[#17202B] text-[#E6EDF3]'
                  : 'text-[#8B98A9] hover:text-[#E6EDF3]'
              }`}
            >
              Dashed
            </button>
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-medium text-[#8B98A9] mb-1.5">
            Default Opacity
          </span>
          <div className="grid grid-cols-2 gap-1 bg-[#0B0F14] p-0.5 rounded-md border border-[#1F2A38]">
            <button
              type="button"
              onClick={() => onChange({ ...visual, dim: false })}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                !visual.dim
                  ? 'bg-[#17202B] text-[#E6EDF3]'
                  : 'text-[#8B98A9] hover:text-[#E6EDF3]'
              }`}
            >
              Bright
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...visual, dim: true })}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                visual.dim
                  ? 'bg-[#17202B] text-[#E6EDF3]'
                  : 'text-[#8B98A9] hover:text-[#E6EDF3]'
              }`}
            >
              Dim
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="cell-visual-glyph"
            className="block text-[11px] font-medium text-[#8B98A9] mb-1.5"
          >
            Glyph (optional)
          </label>
          <input
            id="cell-visual-glyph"
            type="text"
            maxLength={2}
            value={visual.glyph ?? ''}
            onChange={(e) =>
              onChange({
                ...visual,
                glyph: e.target.value || undefined,
              })
            }
            placeholder="A, ⚡, II..."
            className={`${INPUT_CLS} w-full font-mono text-center`}
          />
        </div>
      </div>

      {/* Built-in 34-Icon Gallery */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-[#8B98A9]">Icon</span>
          <div className="flex items-center gap-1 bg-[#0B0F14] p-0.5 rounded-md border border-[#1F2A38]">
            {ICON_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  category === cat
                    ? 'bg-[#17202B] text-[#E6EDF3]'
                    : 'text-[#8B98A9] hover:text-[#E6EDF3]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
          {filteredIcons.map((iconDef) => {
            const active =
              visual.icon === iconDef.id && !(visual.glyph && visual.glyph.trim());
            return (
              <button
                key={iconDef.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...visual,
                    icon: iconDef.id,
                    glyph: undefined,
                  })
                }
                title={iconDef.label}
                aria-pressed={active}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md border transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981] ${
                  active
                    ? 'bg-[#17202B] border-[#10B981] text-[#E6EDF3]'
                    : 'bg-[#0B0F14] border-[#1F2A38] text-[#8B98A9] hover:text-[#E6EDF3] hover:border-[#2D3C4E]'
                }`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  {iconDef.fillPath && (
                    <path d={iconDef.fillPath} fill="currentColor" opacity="0.35" />
                  )}
                  {iconDef.path ? (
                    <path
                      d={iconDef.path}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <rect
                      x="5"
                      y="5"
                      width="14"
                      height="14"
                      rx="2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeDasharray="3 2"
                      opacity="0.6"
                    />
                  )}
                </svg>
                <span className="text-[10px] truncate max-w-full leading-none">
                  {iconDef.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
