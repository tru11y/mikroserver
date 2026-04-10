/**
 * Generates icon-192.png and icon-512.png for the PWA manifest.
 * Run once: node scripts/generate-pwa-icons.mjs
 * Requires: npm install --save-dev sharp
 */
import { createCanvas } from 'node:canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background — indigo rounded rect
  const radius = size * 0.22;
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Wifi icon (simplified arcs)
  const cx = size / 2;
  const cy = size / 2;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';

  const unit = size / 10;

  // Outer arc
  ctx.lineWidth = unit * 0.7;
  ctx.beginPath();
  ctx.arc(cx, cy, unit * 3.2, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Middle arc
  ctx.lineWidth = unit * 0.65;
  ctx.beginPath();
  ctx.arc(cx, cy, unit * 2.0, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  // Inner arc
  ctx.lineWidth = unit * 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, unit * 0.9, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();

  // Dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy + unit * 0.1, unit * 0.45, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

try {
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'icon-192.png'), generateIcon(192));
  writeFileSync(join(publicDir, 'icon-512.png'), generateIcon(512));
  console.log('✓ icon-192.png and icon-512.png generated in public/');
} catch (err) {
  console.error('Error generating icons:', err.message);
  console.log('Install canvas first: npm install --save-dev canvas');
}
