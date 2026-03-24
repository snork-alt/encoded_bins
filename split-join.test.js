const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'split-join-test-'));

function run(script, ...args) {
  return execFileSync('node', [path.resolve(script), ...args], { encoding: 'utf8' });
}

function cleanup() {
  fs.rmSync(TMP, { recursive: true, force: true });
}

function makeFile(name, size, pattern) {
  const filePath = path.join(TMP, name);
  const buf = Buffer.alloc(size);
  if (pattern === 'random') {
    for (let i = 0; i < size; i++) buf[i] = Math.floor(Math.random() * 256);
  } else if (pattern === 'sequential') {
    for (let i = 0; i < size; i++) buf[i] = i % 256;
  }
  fs.writeFileSync(filePath, buf);
  return filePath;
}

function partsDir(filePath) {
  return filePath + '.parts';
}

test('roundtrip: exact multiple of chunk size', () => {
  const src = makeFile('exact.bin', 3 * 100, 'sequential');
  run('split.js', src, '100');

  const dir = partsDir(src);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  assert.equal(meta.totalParts, 3);
  assert.equal(meta.totalBytes, 300);

  const out = path.join(TMP, 'exact_out.bin');
  run('join.js', dir, out);

  assert.deepEqual(fs.readFileSync(out), fs.readFileSync(src));
});

test('roundtrip: size not divisible by chunk size', () => {
  const src = makeFile('uneven.bin', 250, 'sequential');
  run('split.js', src, '100');

  const dir = partsDir(src);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  assert.equal(meta.totalParts, 3); // ceil(250/100)

  const out = path.join(TMP, 'uneven_out.bin');
  run('join.js', dir, out);

  assert.deepEqual(fs.readFileSync(out), fs.readFileSync(src));
});

test('roundtrip: random binary data', () => {
  const src = makeFile('random.bin', 1337, 'random');
  run('split.js', src, '200');

  const out = path.join(TMP, 'random_out.bin');
  run('join.js', partsDir(src), out);

  assert.deepEqual(fs.readFileSync(out), fs.readFileSync(src));
});

test('roundtrip: single-part file (smaller than chunk)', () => {
  const src = makeFile('small.bin', 50, 'sequential');
  run('split.js', src, '1000');

  const dir = partsDir(src);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  assert.equal(meta.totalParts, 1);

  const out = path.join(TMP, 'small_out.bin');
  run('join.js', dir, out);

  assert.deepEqual(fs.readFileSync(out), fs.readFileSync(src));
});

test('roundtrip: empty file', () => {
  const src = makeFile('empty.bin', 0, 'sequential');
  run('split.js', src, '100');

  const dir = partsDir(src);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  assert.equal(meta.totalParts, 0);
  assert.equal(meta.totalBytes, 0);

  const out = path.join(TMP, 'empty_out.bin');
  run('join.js', dir, out);

  assert.equal(fs.readFileSync(out).length, 0);
});

test('parts are valid base64', () => {
  const src = makeFile('b64check.bin', 300, 'random');
  run('split.js', src, '100');

  const dir = partsDir(src);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const b64Re = /^[A-Za-z0-9+/]*={0,2}$/;

  for (let i = 0; i < meta.totalParts; i++) {
    const partPath = path.join(dir, `part_${String(i).padStart(6, '0')}`);
    const content = fs.readFileSync(partPath, 'utf8');
    assert.match(content, b64Re, `part ${i} is not valid base64`);
  }
});

test('meta.json contains correct fields', () => {
  const src = makeFile('meta.bin', 512, 'sequential');
  run('split.js', src, '200');

  const meta = JSON.parse(fs.readFileSync(path.join(partsDir(src), 'meta.json'), 'utf8'));
  assert.equal(meta.fileName, 'meta.bin');
  assert.equal(meta.totalParts, 3); // ceil(512/200)
  assert.equal(meta.chunkSize, 200);
  assert.equal(meta.totalBytes, 512);
});

test('split errors without input file', () => {
  assert.throws(() => run('split.js'), { message: /Command failed/ });
});

test('join errors without parts folder', () => {
  assert.throws(() => run('join.js'), { message: /Command failed/ });
});

test('join errors when meta.json is missing', () => {
  const emptyDir = path.join(TMP, 'noMeta');
  fs.mkdirSync(emptyDir);
  assert.throws(() => run('join.js', emptyDir), { message: /Command failed/ });
});

// Cleanup after all tests
process.on('exit', cleanup);
