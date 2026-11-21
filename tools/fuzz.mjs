// Fuzz: draws fresh cases with the kit's own published generator
// (program/generator/subject/csv-cases.mjs) under several seeds and diffs
// this repo's solve.js against csv-reader 1.0.0 on each.
// Usage: node tools/fuzz.mjs [count] [seedPrefix]
import { createHash } from 'node:crypto';
import { run as mine } from '../solve.js';
import { readCsv as ref } from '/home/hatch/workspace/makefun/csv-reader-speed-01-run-20261121-kit-batch/csv-reader-speed-01-run-20261121-kit/baselines/csv-reader/vendor/csv-reader/index.js';
import { generate } from '/home/hatch/workspace/makefun/csv-reader-speed-01-run-20261121-kit-batch/csv-reader-speed-01-run-20261121-kit/program/generator/subject/csv-cases.mjs';

// xoshiro128** + streamFor, as in the kit's program/generator/rng.ts.
const rotl = (x, k) => (x << k) | (x >>> (32 - k));
class Rng {
  constructor(key) {
    const v = new DataView(key.buffer, key.byteOffset, 16);
    this.a = v.getUint32(0) | 0; this.b = v.getUint32(4) | 0;
    this.c = v.getUint32(8) | 0; this.d = v.getUint32(12) | 0;
  }
  u32() {
    const a = this.a, b = this.b;
    const result = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
    const t = b << 9;
    let c = this.c ^ a, d = this.d ^ b;
    const nb = b ^ c, na = a ^ d;
    c ^= t; d = rotl(d, 11);
    this.a = na; this.b = nb; this.c = c; this.d = d;
    return result;
  }
  int(lo, hi) {
    const span = hi - lo + 1;
    const limit = Math.floor(2 ** 32 / span) * span;
    let x = this.u32();
    while (x >= limit) x = this.u32();
    return lo + (x % span);
  }
  float() { return this.u32() / 2 ** 32; }
  pick(xs) { return xs[this.int(0, xs.length - 1)]; }
  chance(p) { return this.float() < p; }
}
function streamFor(seed, label, index) {
  const key = createHash('sha256').update(`makefun/speed-home/rng/v1\n${seed}\n${label}\n${index}`).digest();
  return new Rng(key);
}

const count = Number(process.argv[2] ?? 12);
const prefix = process.argv[3] ?? 'fuzz';
let mismatches = 0;
for (let i = 0; i < count; i++) {
  const seed = createHash('sha256').update(`${prefix}-${i}`).digest('hex');
  const input = generate(streamFor(seed, 'case', i), i);
  const a = JSON.stringify(mine(input));
  const b = JSON.stringify(ref(input));
  if (a !== b) {
    mismatches++;
    console.log(`MISMATCH fuzz-${i} (seed ${seed.slice(0, 12)}…, ${input.text.length} chars, header=${input.header})`);
    let k = 0;
    while (k < Math.min(a.length, b.length) && a[k] === b[k]) k++;
    console.log(`  mine: ...${a.slice(Math.max(0, k - 80), k + 160)}`);
    console.log(`  ref : ...${b.slice(Math.max(0, k - 80), k + 160)}`);
    if (mismatches >= 3) break;
  } else {
    console.log(`ok fuzz-${i}: ${input.text.length} chars, header=${input.header}`);
  }
}
console.log(`\n${count} fuzz cases, ${mismatches} mismatches`);
process.exit(mismatches === 0 ? 0 : 1);
