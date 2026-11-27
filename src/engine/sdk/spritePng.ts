import { SpriteAssetManifest } from './types';

// ============================================================================
// Pure-TS 32×32 PNG Encoder (Browser + Node compatible, zero DOM dependency)
// Encodes RGBA pixel buffers into valid PNG data URLs (store-only zlib stream)
// ============================================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function writeU32BE(arr: Uint8Array, offset: number, val: number): void {
  arr[offset] = (val >>> 24) & 0xff;
  arr[offset + 1] = (val >>> 16) & 0xff;
  arr[offset + 2] = (val >>> 8) & 0xff;
  arr[offset + 3] = val & 0xff;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeU32BE(chunk, 0, data.length);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  writeU32BE(chunk, 8 + data.length, crc);
  return chunk;
}

function encodeBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;

    out += chars[b0 >>> 2];
    out += chars[((b0 & 3) << 4) | (b1 >>> 4)];
    out += has1 ? chars[((b1 & 15) << 2) | (b2 >>> 6)] : '=';
    out += has2 ? chars[b2 & 63] : '=';
  }
  return out;
}

/**
 * Encodes an RGBA Uint8Array of dimensions (width × height) into a valid
 * `data:image/png;base64,...` data URL using uncompressed DEFLATE blocks.
 */
export function encodeRgbaToPngDataUrl(
  rgba: Uint8Array,
  width: number,
  height: number
): string {
  // Raw scanlines: 1 filter byte (0 = None) + width * 4 RGBA bytes per row
  const rowBytes = width * 4;
  const raw = new Uint8Array(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    const dstRow = y * (rowBytes + 1);
    raw[dstRow] = 0; // filter None
    raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), dstRow + 1);
  }

  // Zlib stream: 2-byte header (0x78, 0x01) + single stored DEFLATE block + 4-byte Adler32
  // For 32x32 RGBA, raw.length is 4128 (< 65535), so a single stored block fits cleanly.
  const zlib = new Uint8Array(2 + 5 + raw.length + 4);
  zlib[0] = 0x78;
  zlib[1] = 0x01;
  zlib[2] = 0x01; // BFINAL=1, BTYPE=00 (stored)
  const len = raw.length;
  const nlen = (~len) & 0xffff;
  zlib[3] = len & 0xff;
  zlib[4] = (len >>> 8) & 0xff;
  zlib[5] = nlen & 0xff;
  zlib[6] = (nlen >>> 8) & 0xff;
  zlib.set(raw, 7);
  writeU32BE(zlib, 7 + raw.length, adler32(raw));

  // IHDR chunk
  const ihdr = new Uint8Array(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', zlib);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const totalLen =
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(totalLen);
  let offset = 0;
  png.set(signature, offset);
  offset += signature.length;
  png.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  png.set(idatChunk, offset);
  offset += idatChunk.length;
  png.set(iendChunk, offset);

  return `data:image/png;base64,${encodeBase64(png)}`;
}

function parseHexColor(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      255,
    ];
  }
  if (clean.length === 8) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ];
  }
  return [0, 0, 0, 0];
}

/**
 * Helper to craft crisp 32×32 PNG pixel-art sprites from a 16×16 character grid
 * upscaled 2× cleanly with nearest-neighbor precision.
 * `.` or space = transparent.
 */
export function createPixelSprite32(
  id: string,
  name: string,
  palette: Record<string, string>,
  rows16: string[]
): SpriteAssetManifest {
  const rgba = new Uint8Array(32 * 32 * 4);
  const parsedPalette = new Map<string, [number, number, number, number]>();
  for (const [key, hex] of Object.entries(palette)) {
    parsedPalette.set(key, parseHexColor(hex));
  }

  for (let sy = 0; sy < 16; sy++) {
    const row = rows16[sy] ?? '';
    for (let sx = 0; sx < 16; sx++) {
      const ch = row[sx];
      if (!ch || ch === '.' || ch === ' ') continue;
      const color = parsedPalette.get(ch);
      if (!color) continue;

      // Write 2×2 block at (sx*2, sy*2)
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const px = sx * 2 + dx;
          const py = sy * 2 + dy;
          const idx = (py * 32 + px) * 4;
          rgba[idx] = color[0];
          rgba[idx + 1] = color[1];
          rgba[idx + 2] = color[2];
          rgba[idx + 3] = color[3];
        }
      }
    }
  }

  return {
    id,
    name,
    width: 32,
    height: 32,
    dataUrl: encodeRgbaToPngDataUrl(rgba, 32, 32),
  };
}
