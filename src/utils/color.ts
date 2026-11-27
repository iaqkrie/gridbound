const HEX_6_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string | undefined): value is string {
  return typeof value === 'string' && HEX_6_RE.test(value);
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return `rgba(100, 116, 139, ${alpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function lightenHex(hex: string, amount: number): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return '#E6EDF3';
  const lr = Math.round(rgb[0] + (255 - rgb[0]) * amount);
  const lg = Math.round(rgb[1] + (255 - rgb[1]) * amount);
  const lb = Math.round(rgb[2] + (255 - rgb[2]) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}
