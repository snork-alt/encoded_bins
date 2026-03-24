#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CHUNK_SIZE = 1024 * 1024; // 1MB per part

const inputFile = process.argv[2];
const chunkSize = parseInt(process.argv[3]) || CHUNK_SIZE;

if (!inputFile) {
  console.error('Usage: node split.js <file> [chunk-size-bytes]');
  process.exit(1);
}

const filePath = path.resolve(inputFile);
const fileName = path.basename(filePath);
const outDir = path.join(path.dirname(filePath), fileName + '.parts');

const data = fs.readFileSync(filePath);
const totalParts = Math.ceil(data.length / chunkSize);

fs.mkdirSync(outDir, { recursive: true });

for (let i = 0; i < totalParts; i++) {
  const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
  const partName = `part_${String(i).padStart(6, '0')}`;
  fs.writeFileSync(path.join(outDir, partName), chunk.toString('base64'));
}

// Write metadata
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({
  fileName,
  totalParts,
  chunkSize,
  totalBytes: data.length,
}, null, 2));

console.log(`Split into ${totalParts} parts → ${outDir}`);
