import { SimulationCore } from '../engine/SimulationCore';
import {
  evaluateUiConditions,
  formatUiTemplate,
  GridCoordinate,
} from '../engine/sdk';

interface HoverCellCardProps {
  core: SimulationCore;
  coord: GridCoordinate | null;
}

const TONE_CLASS: Record<string, string> = {
  default: 'text-[#E6EDF3]',
  muted: 'text-[#8B98A9]',
  accent: 'text-[#38BDF8]',
  positive: 'text-[#10B981]',
  warning: 'text-[#F59E0B]',
  danger: 'text-[#F43F5E]',
};

export function HoverCellCard({ core, coord }: HoverCellCardProps) {
  if (!coord) return null;

  const hoverId = core.getHoverInterfaceId(coord.x, coord.y);
  if (!hoverId) return null;

  const snapshot = core.getCellSnapshot(coord.x, coord.y);
  if (!snapshot) return null;

  const spriteAsset = snapshot.visual.spriteId
    ? core.spriteById.get(snapshot.visual.spriteId)
    : undefined;

  // Built-in @builtin/inspector card
  if (hoverId === '@builtin/inspector') {
    const statusField = snapshot.visibleState.find((f) => f.key === 'status');
    const otherFields = snapshot.visibleState.filter(
      (f) => f.key !== 'status' && f.value !== '' && f.value !== 0
    );

    return (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute top-3.5 right-3.5 z-20 w-56 bg-[#111720]/95 border border-[#1F2A38] rounded-lg p-3 backdrop-blur-sm select-none"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {spriteAsset ? (
              <img
                src={spriteAsset.dataUrl}
                alt=""
                className="w-5 h-5 rounded-[3px] shrink-0 border border-white/10 bg-[#0B0F14]"
                style={{ imageRendering: 'pixelated' }}
                aria-hidden="true"
              />
            ) : (
              <span
                className="w-3 h-3 rounded-[2px] shrink-0 border border-white/15"
                style={{
                  backgroundColor:
                    snapshot.visual.tintColor ?? snapshot.cellType.defaultColor,
                }}
                aria-hidden="true"
              />
            )}
            <span className="text-xs font-semibold text-[#E6EDF3] truncate">
              {snapshot.cellType.name}
            </span>
          </div>

          <span className="font-mono tabular-nums text-[10px] text-[#8B98A9] shrink-0">
            {coord.x},{coord.y}
          </span>
        </div>

        {statusField && String(statusField.value) !== '' && (
          <div className="mt-1.5 text-[11px] font-medium text-[#E6EDF3]/90 leading-snug">
            {String(statusField.value)}
          </div>
        )}

        {snapshot.supplies.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 pt-2 border-t border-[#1F2A38] text-[11px]">
            {snapshot.supplies.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1">
                <span className="text-[#8B98A9]">{s.name}:</span>
                <span
                  className="font-mono tabular-nums font-medium"
                  style={{ color: s.amount > 0 ? s.color : '#8B98A9' }}
                >
                  {s.amount}
                </span>
              </span>
            ))}
          </div>
        )}

        {otherFields.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#1F2A38] space-y-1 text-[11px]">
            {otherFields.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2">
                <span className="text-[#8B98A9]">{f.label}</span>
                <span className="font-mono tabular-nums text-[#E6EDF3]">
                  {String(f.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Custom read-only hover InterfaceManifest
  const customIface = core.interfaceById.get(hoverId);
  if (!customIface) return null;

  const tplCtx = core.getUiTemplateContext(coord.x, coord.y);
  const title = formatUiTemplate(customIface.title, tplCtx) || snapshot.cellType.name;
  const visibleBlocks = customIface.blocks.filter((b) =>
    evaluateUiConditions(b.visibleWhen, tplCtx)
  );

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ width: customIface.width ? `${customIface.width}px` : undefined }}
      className="pointer-events-none absolute top-3.5 right-3.5 z-20 w-56 bg-[#111720]/95 border border-[#1F2A38] rounded-lg p-3 backdrop-blur-sm select-none space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {customIface.showSwatch !== false && spriteAsset && (
            <img
              src={spriteAsset.dataUrl}
              alt=""
              className="w-5 h-5 rounded-[3px] shrink-0 border border-white/10 bg-[#0B0F14]"
              style={{ imageRendering: 'pixelated' }}
              aria-hidden="true"
            />
          )}
          <span className="text-xs font-semibold text-[#E6EDF3] truncate">
            {title}
          </span>
        </div>
        <span className="font-mono tabular-nums text-[10px] text-[#8B98A9] shrink-0">
          {coord.x},{coord.y}
        </span>
      </div>

      {visibleBlocks.map((block, idx) => {
        if (block.kind === 'text') {
          return (
            <p
              key={idx}
              className={`text-[11px] leading-snug ${TONE_CLASS[block.tone ?? 'muted']}`}
            >
              {formatUiTemplate(block.text, tplCtx)}
            </p>
          );
        }
        if (block.kind === 'stat') {
          return (
            <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[#8B98A9]">
                {formatUiTemplate(block.label, tplCtx)}
              </span>
              <span
                className={`font-mono tabular-nums font-medium ${TONE_CLASS[block.tone ?? 'default']}`}
              >
                {formatUiTemplate(block.value, tplCtx)}
              </span>
            </div>
          );
        }
        if (block.kind === 'supplyList') {
          const list = block.onlyPositive
            ? snapshot.supplies.filter((s) => s.amount > 0)
            : snapshot.supplies;
          if (list.length === 0) return null;
          return (
            <div
              key={idx}
              className="flex flex-wrap gap-x-2.5 gap-y-1 pt-1.5 border-t border-[#1F2A38] text-[11px]"
            >
              {list.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1">
                  <span className="text-[#8B98A9]">{s.name}:</span>
                  <span
                    className="font-mono tabular-nums font-medium"
                    style={{ color: s.amount > 0 ? s.color : '#8B98A9' }}
                  >
                    {s.amount}
                  </span>
                </span>
              ))}
            </div>
          );
        }
        if (block.kind === 'cellStateList') {
          const excluded = new Set(block.excludeKeys ?? []);
          const fields = snapshot.visibleState.filter((f) => !excluded.has(f.key));
          if (fields.length === 0) return null;
          return (
            <div
              key={idx}
              className="pt-1.5 border-t border-[#1F2A38] space-y-1 text-[11px]"
            >
              {fields.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-2">
                  <span className="text-[#8B98A9]">{f.label}</span>
                  <span className="font-mono tabular-nums text-[#E6EDF3]">
                    {String(f.value)}
                  </span>
                </div>
              ))}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
