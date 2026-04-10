// scripts/generate-icon.js
// Gera o ícone PNG do PETSKOD sem dependências externas (só Node.js nativo)

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// ── Gerador de PNG RGBA ───────────────────────────────────────────────────────
function createCirclePNG(size, r, g, b) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const ihdrChunk = pngChunk('IHDR', ihdr);

  // Pixels: círculo com borda levemente suave
  const cx = size / 2, cy = size / 2, radius = size / 2 - 1;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2);
      const alpha = dist < radius ? 255 : dist < radius + 1.5 ? Math.round(255 * (1 - (dist - radius) / 1.5)) : 0;
      row[1 + x * 4] = r;
      row[1 + x * 4 + 1] = g;
      row[1 + x * 4 + 2] = b;
      row[1 + x * 4 + 3] = alpha;
    }
    rows.push(row);
  }

  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 });
  const idatChunk = pngChunk('IDAT', compressed);
  const iendChunk = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// ── Gera os ícones ────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '../assets/icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Ícone principal (roxo vibrante)
fs.writeFileSync(path.join(outDir, 'petskod.png'), createCirclePNG(16, 124, 111, 255));
// Ícone maior para notificações
fs.writeFileSync(path.join(outDir, 'petskod_32.png'), createCirclePNG(32, 124, 111, 255));

console.log('[PETSKOD] Ícones gerados em assets/icons/');
