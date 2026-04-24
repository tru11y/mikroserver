#!/usr/bin/env node
/**
 * generate-assets.js — pure Node.js mobile icon/splash generator (zero external deps)
 * Generates: icon.png (1024×1024), adaptive-icon.png (1024×1024),
 *            splash.png (1080×2160), favicon.png (48×48)
 *
 * Usage: node scripts/generate-assets.js
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
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = ihdr[11] = ihdr[12] = 0;
  const stride = 1 + w * 4;
  const raw    = Buffer.allocUnsafe(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
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
 * Core WiFi signal renderer.
 *
 * @param {number}  W        - image width in pixels
 * @param {number}  H        - image height in pixels
 * @param {number}  CX       - horizontal center of WiFi signal
 * @param {number}  CY       - vertical position of the dot (signal origin)
 * @param {number}  OR       - outer radius of outermost arc
 * @param {number}  bgR/G/B/A - background RGBA (set A=0 for transparent)
 * @param {number}  SS       - supersampling factor (2 or 3)
 */
function renderWiFi(W, H, CX, CY, OR, bgR, bgG, bgB, bgA, SS = 3) {
  const rgba = new Uint8Array(W * H * 4);
  const AA   = Math.max(0.8, OR * 0.005);

  // Arc proportions relative to OR (derived from SVG geometry)
  const ARCS = [
    [OR * 0.820, OR * 1.000,  99, 102, 241],  // #6366f1 — outer
    [OR * 0.538, OR * 0.706, 165, 180, 252],  // #a5b4fc — middle
    [OR * 0.256, OR * 0.424, 255, 255, 255],  // white   — inner
  ];
  const DOT_R  = OR * 0.128;
  const MAX_ANG = 0.800; // ±45.8° from vertical up

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      let R = 0, G = 0, B = 0, A = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fpx = px + (sx + 0.5) / SS;
          const fpy = py + (sy + 0.5) / SS;

          let r = bgR, g = bgG, b = bgB, a = bgA;

          const dx        = fpx - CX;
          const dy        = fpy - CY;
          const dist      = Math.sqrt(dx * dx + dy * dy);
          const angFromUp = Math.abs(Math.atan2(dx, -dy));
          const angFade   = 1 - smoothstep(MAX_ANG - 0.06, MAX_ANG + 0.06, angFromUp);

          // Arcs — upper half of signal fan
          if (dy <= DOT_R + AA && angFade > 0) {
            for (const [ir, or, cr, cg, cb] of ARCS) {
              const cov = (1 - smoothstep(or - AA, or + AA, dist))
                        * smoothstep(ir - AA, ir + AA, dist)
                        * angFade;
              if (cov > 0) {
                const al = cov;
                r = r * (1 - al) + cr * al;
                g = g * (1 - al) + cg * al;
                b = b * (1 - al) + cb * al;
                if (bgA === 0) a = Math.max(a, Math.round(cov * 255));
              }
            }
          }

          // Centre dot
          const dotCov = 1 - smoothstep(DOT_R - AA, DOT_R + AA, dist);
          if (dotCov > 0) {
            r = r * (1 - dotCov) + 255 * dotCov;
            g = g * (1 - dotCov) + 255 * dotCov;
            b = b * (1 - dotCov) + 255 * dotCov;
            if (bgA === 0) a = Math.max(a, Math.round(dotCov * 255));
          }

          R += r; G += g; B += b; A += a;
        }
      }

      const n = SS * SS;
      const idx = (py * W + px) * 4;
      rgba[idx]   = Math.round(R / n);
      rgba[idx+1] = Math.round(G / n);
      rgba[idx+2] = Math.round(B / n);
      rgba[idx+3] = Math.round(A / n);
    }
  }
  return rgba;
}

// ─── Asset generators ────────────────────────────────────────────────────────

/**
 * icon.png — 1024×1024, dark navy bg, WiFi logo centred
 * Used as-is for iOS (masked by the OS) and as Android legacy icon.
 */
function genIcon(size = 1024) {
  const CX = size / 2;
  const CY = size * 0.734;
  const OR = size * 0.406;
  return renderWiFi(size, size, CX, CY, OR, 15, 23, 42, 255, 3);
}

/**
 * adaptive-icon.png — 1024×1024, fully transparent background.
 * Android uses this as the foreground layer; background colour comes from app.json.
 * Content sized to fit within the 72% safe zone (radius ≤ 368 px from centre).
 */
function genAdaptiveIcon(size = 1024) {
  // Scale down 30% so signal comfortably fits the safe zone
  const CX = size / 2;
  const CY = size / 2 + size * 0.13;  // slightly below centre
  const OR = size * 0.284;            // safe zone = 368 px, OR < 368 → fits
  return renderWiFi(size, size, CX, CY, OR, 0, 0, 0, 0, 3);
}

/**
 * splash.png — 1080×2160 portrait, near-black bg, logo centred.
 * Displayed with resizeMode: contain, so bg colour must match splash.backgroundColor.
 */
function genSplash(W = 1080, H = 2160) {
  const CX = W / 2;
  const CY = H * 0.42;    // slightly above vertical centre for visual balance
  const OR = W * 0.230;   // ~248 px — prominent but not overwhelming
  return renderWiFi(W, H, CX, CY, OR, 10, 10, 15, 255, 2);
}

/**
 * favicon.png — 48×48 for web/Expo web target.
 */
function genFavicon(size = 48) {
  const CX = size / 2;
  const CY = size * 0.734;
  const OR = size * 0.406;
  return renderWiFi(size, size, CX, CY, OR, 15, 23, 42, 255, 2);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const jobs = [
  { name: 'icon.png',          fn: () => genIcon(1024),       w: 1024, h: 1024 },
  { name: 'adaptive-icon.png', fn: () => genAdaptiveIcon(1024), w: 1024, h: 1024 },
  { name: 'splash.png',        fn: () => genSplash(1080, 2160), w: 1080, h: 2160 },
  { name: 'favicon.png',       fn: () => genFavicon(48),       w: 48,   h: 48   },
];

for (const { name, fn, w, h } of jobs) {
  const t0     = Date.now();
  const pixels = fn();
  const png    = encodePNG(w, h, pixels);
  fs.writeFileSync(path.join(ASSETS_DIR, name), png);
  console.log(`  ${name.padEnd(22)} ${(png.length / 1024).toFixed(1).padStart(6)} KB  (${Date.now() - t0}ms)`);
}
