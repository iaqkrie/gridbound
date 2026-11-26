import { CellVisualManifest, getIconDef } from '../../engine/sdk';

interface CellTilePreviewProps {
  visual: CellVisualManifest;
  size?: number;
  className?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(100, 116, 139, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#E6EDF3';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

export function CellTilePreview({
  visual,
  size = 32,
  className = '',
}: CellTilePreviewProps) {
  const color = visual.color || '#64748B';
  const iconDef = getIconDef(visual.icon);
  const fullTile = visual.fullTile ?? Boolean(iconDef?.defaultFullTile);
  const active = !visual.dim;
  const isEmpty =
    visual.icon === 'empty' && !visual.glyph?.trim() && !visual.svgPath;

  const glyphText = visual.glyph?.trim().slice(0, 2) ?? '';
  const pathData = visual.svgPath || iconDef?.path || '';
  const fillPathData = visual.svgPath ? undefined : iconDef?.fillPath;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 rounded-[4px] bg-[#0E141C] ${className}`}
      aria-hidden="true"
    >
      {isEmpty ? (
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="2"
          fill="#0E141C"
          stroke="#1F2A38"
          strokeWidth="1"
        />
      ) : (
        <>
          {visual.substrateColor && (
            <rect
              x="1"
              y="1"
              width="30"
              height="30"
              fill={hexToRgba(visual.substrateColor, 0.22)}
            />
          )}

          {fullTile ? (
            <rect
              x="1"
              y="1"
              width="30"
              height="30"
              fill={hexToRgba(color, active ? 0.3 : 0.12)}
            />
          ) : (
            <rect
              x="3.5"
              y="3.5"
              width="25"
              height="25"
              fill={hexToRgba(color, active ? 0.24 : 0.1)}
            />
          )}

          <rect
            x="3.5"
            y="3.5"
            width="25"
            height="25"
            fill="none"
            stroke={active ? color : hexToRgba(color, 0.55)}
            strokeWidth={fullTile ? 1.3 : 1.7}
            strokeDasharray={visual.border === 'dashed' ? '3 2' : undefined}
          />

          {glyphText ? (
            <text
              x="16"
              y="16.8"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={active ? lightenHex(color, 0.35) : hexToRgba(color, 0.5)}
              fontFamily="'JetBrains Mono', 'Manrope', sans-serif"
              fontWeight="700"
              fontSize={glyphText.length > 1 ? 11 : 14}
            >
              {glyphText}
            </text>
          ) : pathData ? (
            <g transform="translate(6.2 6.2) scale(0.816)">
              {fillPathData && (
                <path
                  d={fillPathData}
                  fill={hexToRgba(color, active ? 0.5 : 0.22)}
                />
              )}
              <path
                d={pathData}
                fill="none"
                stroke={
                  active ? lightenHex(color, 0.35) : hexToRgba(color, 0.48)
                }
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ) : null}

          {(visual.indicators ?? []).map((ind, idx) => {
            if (ind.kind === 'dot') {
              const cx = ind.position === 'bottomRight' ? 24.5 : 7.5;
              const cy = ind.position === 'topLeft' ? 7.5 : 24.5;
              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r="2.4"
                  fill={ind.color}
                />
              );
            }
            if (ind.kind === 'bar') {
              return (
                <rect
                  key={idx}
                  x="9"
                  y="19"
                  width="14"
                  height="4"
                  fill={ind.color ?? color}
                />
              );
            }
            return null;
          })}
        </>
      )}
    </svg>
  );
}
