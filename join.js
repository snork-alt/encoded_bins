#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const partsDir = process.argv[2];
const outputOverride = process.argv[3];

if (!partsDir) {
  console.error('Usage: node join.js <parts-folder> [output-file]');
  process.exit(1);
}

const dirPath = path.resolve(partsDir);
const metaPath = path.join(dirPath, 'meta.json');

if (!fs.existsSync(metaPath)) {
  console.error('meta.json not found in parts folder');
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const outFile = outputOverride
  ? path.resolve(outputOverride)
  : path.join(path.dirname(dirPath), meta.fileName);

const chunks = [];

for (let i = 0; i < meta.totalParts; i++) {
  const partName = `part_${String(i).padStart(6, '0')}`;
  const partPath = path.join(dirPath, partName);
  if (!fs.existsSync(partPath)) {
    console.error(`Missing part: ${partName}`);
    process.exit(1);
  }
  chunks.push(Buffer.from(fs.readFileSync(partPath, 'utf8'), 'base64'));
}

const result = Buffer.concat(chunks);

if (result.length !== meta.totalBytes) {
  console.error(`Size mismatch: expected ${meta.totalBytes}, got ${result.length}`);
  process.exit(1);
}

fs.writeFileSync(outFile, result);
console.log(`Joined ${meta.totalParts} parts → ${outFile}`);
