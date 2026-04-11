#!/usr/bin/env node
/**
 * generate-icons.js — pure Node.js PNG icon generator (zero external deps)
 * Renders a WiFi signal icon on a dark navy background at 192×192 and 512×512.
 * Uses only Node.js built-ins: zlib, fs, path.
 *
 * Usage: node scripts/generate-icons.js
 */
'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─── PNG encoder ─────────────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const l = Buffer.allocUnsafe(4); l.writeUInt32BE(data.length, 0);
  const c = Buffer.allocUnsafe(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([l, t, data, c]);
}

function encodePNG(w, h, rgba) {
  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = ihdr[11] = ihdr[12] = 0; // 8-bit RGBA

  const stride = 1 + w * 4;
  const raw    = Buffer.allocUnsafe(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter byte: None
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4, di = y * stride + 1 + x * 4;
      raw[di] = rgba[si]; raw[di+1] = rgba[si+1]; raw[di+2] = rgba[si+2]; raw[di+3] = rgba[si+3];
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Renderer ────────────────────────────────────────────────────────────────

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Renders a WiFi-on-dark-navy icon at the given pixel size.
 * Returns a Uint8Array of RGBA pixels (size × size × 4 bytes).
 */
function renderIcon(SIZE) {
  const rgba = new Uint8Array(SIZE * SIZE * 4);

  // Geometry — all values relative to SIZE so the icon scales cleanly
  const RX      = SIZE * 0.208;  // rounded rect corner radius
  const CX      = SIZE * 0.500;  // WiFi signal origin X (horizontal center)
  const CY      = SIZE * 0.734;  // WiFi signal origin Y (lower third)
  const AA      = Math.max(1.0, SIZE * 0.005); // anti-alias half-width in px

  const DOT_R   = SIZE * 0.052;  // filled dot radius

  // Arcs drawn outer→inner; innermost colour wins (composited on top)
  const ARCS = [
    // [innerRadius, outerRadius, r, g, b]
    [SIZE * 0.333, SIZE * 0.406,  99, 102, 241],  // #6366f1 — indigo-500
    [SIZE * 0.219, SIZE * 0.286, 165, 180, 252],  // #a5b4fc — indigo-300
    [SIZE * 0.104, SIZE * 0.172, 255, 255, 255],  // white   — inner arc
  ];

  const MAX_ANG = 0.800; // ±45.8° from vertical — controls arc fan width

  // Fast rounded-rect test (corner distance)
  function inRoundRect(px, py) {
    const cx2 = Math.max(RX, Math.min(SIZE - RX, px));
    const cy2 = Math.max(RX, Math.min(SIZE - RX, py));
    const dx = px - cx2, dy = py - cy2;
    return dx * dx + dy * dy <= RX * RX;
  }

  const SS = 3; // 3× supersampling → 9 samples per pixel for crisp AA

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let R = 0, G = 0, B = 0, A = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fpx = px + (sx + 0.5) / SS;
          const fpy = py + (sy + 0.5) / SS;

          // Pixels outside the rounded rect are fully transparent
          if (!inRoundRect(fpx, fpy)) { A += 0; continue; }

          // Base layer: dark navy background #0f172a
          let r = 15, g = 23, b = 42, a = 255;

          const dx       = fpx - CX;
          const dy       = fpy - CY;
          const dist     = Math.sqrt(dx * dx + dy * dy);
          // Angle from "straight up" (−Y in screen coords): 0 at top, grows sideways
          const angFromUp = Math.abs(Math.atan2(dx, -dy));

          // Angular fade — smoothly cuts off the arc fan at MAX_ANG
          const angFade = 1 - smoothstep(MAX_ANG - 0.06, MAX_ANG + 0.06, angFromUp);

          // Draw arcs (upper half only: dy < ~dot_radius so arcs don't bleed below dot)
          if (dy <= DOT_R + AA && angFade > 0) {
            for (const [ir, or, cr, cg, cb] of ARCS) {
              // Smooth annular ring: 1 between ir and or, 0 outside with AA feather
              const outsideInner = smoothstep(ir - AA, ir + AA, dist);
              const insideOuter  = 1 - smoothstep(or - AA, or + AA, dist);
              const cov          = outsideInner * insideOuter * angFade;

              if (cov > 0) {
                r = r * (1 - cov) + cr * cov;
                g = g * (1 - cov) + cg * cov;
                b = b * (1 - cov) + cb * cov;
              }
            }
          }

          // Draw centre dot — white filled circle, composited last (on top)
          const dotCov = 1 - smoothstep(DOT_R - AA, DOT_R + AA, dist);
          if (dotCov > 0) {
            r = r * (1 - dotCov) + 255 * dotCov;
            g = g * (1 - dotCov) + 255 * dotCov;
            b = b * (1 - dotCov) + 255 * dotCov;
          }

          R += r; G += g; B += b; A += a;
        }
      }

      const n = SS * SS;
      const idx = (py * SIZE + px) * 4;
      rgba[idx]   = Math.round(R / n);
      rgba[idx+1] = Math.round(G / n);
      rgba[idx+2] = Math.round(B / n);
      rgba[idx+3] = Math.round(A / n);
    }
  }

  return rgba;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

for (const size of [192, 512]) {
  const t0     = Date.now();
  const pixels = renderIcon(size);
  const png    = encodePNG(size, size, pixels);
  const out    = path.join(PUBLIC_DIR, `icon-${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`  icon-${size}.png  ${(png.length / 1024).toFixed(1)} KB  (${Date.now() - t0}ms)`);
}
