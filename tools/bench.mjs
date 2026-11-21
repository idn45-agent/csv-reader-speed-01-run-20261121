// Benchmark: times this repo's solve.js vs csv-reader 1.0.0 (the kit
// baseline's vendor copy) on the practice set, several runs each, after a
// warm-up. Run with --no-incremental-marking, as the harness driver does.
// Usage: node --no-incremental-marking tools/bench.mjs [runs]
import { readFileSync } from 'node:fs';
import { run as mine } from '../solve.js';
import { readCsv as ref } from '/home/hatch/workspace/makefun/csv-reader-speed-01-run-20261121-kit-batch/csv-reader-speed-01-run-20261121-kit/baselines/csv-reader/vendor/csv-reader/index.js';

const KIT = '/home/hatch/workspace/makefun/csv-reader-speed-01-run-20261121-kit-batch/csv-reader-speed-01-run-20261121-kit';
const cases = JSON.parse(readFileSync(`${KIT}/practice/input/cases.json`, 'utf8')).map((c) => c.input);
const totalChars = cases.reduce((s, c) => s + c.text.length, 0);
const runs = Number(process.argv[2] ?? 7);

function time(fn) {
  const ts = [];
  for (let r = 0; r < runs; r++) {
    const t0 = process.hrtime.bigint();
    for (const c of cases) fn(c);
    const t1 = process.hrtime.bigint();
    ts.push(Number(t1 - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  const mean = ts.reduce((s, v) => s + v, 0) / ts.length;
  return { ts, mean, median: ts[Math.floor(ts.length / 2)] };
}

// Warm-up (also lets V8 optimise both functions).
for (const c of cases) { mine(c); ref(c); }
global.gc?.();

const m = time(mine);
const b = time(ref);
console.log(`practice set: ${cases.length} cases, ${totalChars} chars, ${runs} runs each`);
console.log(`mine     : mean ${m.mean.toFixed(1)} ms, median ${m.median.toFixed(1)} ms  [${m.ts.map((v) => v.toFixed(0)).join(', ')}]`);
console.log(`baseline : mean ${b.mean.toFixed(1)} ms, median ${b.median.toFixed(1)} ms  [${b.ts.map((v) => v.toFixed(0)).join(', ')}]`);
console.log(`speedup  : ${(b.mean / m.mean).toFixed(2)}x (mean), ${(b.median / m.median).toFixed(2)}x (median)`);
console.log(`throughput mine: ${(totalChars / 1e6 / (m.mean / 1000)).toFixed(1)} MB/s, baseline: ${(totalChars / 1e6 / (b.mean / 1000)).toFixed(1)} MB/s`);
