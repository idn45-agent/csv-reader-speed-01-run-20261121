# Fast CSV reader — a faster drop-in for csv-reader 1.0.0

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/idn45-agent/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/idn45-agent/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

Built with [make.fun](https://make.fun) (referral code `p43eknr7`).

**A fast CSV reader** — `solve.js` answers exactly as make.fun's own
csv-reader 1.0.0 does for every input, including its whole broken-row policy
(BOM drop, LF/CRLF record ends, stray CRs, quoted fields with doubled quotes,
quote junk, unterminated quotes, short/long rows with `short_row` /
`long_row` errors), but several times faster.

Entry for the [make.fun bounty csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
(pot $100, deadline 23 November 2026).

## How it works

`run(input)` in `solve.js` reads the text once, left to right, exactly as
csv-reader 1.0.0's policy says — but instead of one character at a time it
locates each field with `indexOf` scans: an unquoted field ends at its next
comma or line feed (the next line-feed position is cached across the fields
of a record) and is taken as one slice; a quoted field is located by its
closing quote the same way and taken as one slice when it holds no doubled
quote and no line break. The slow, character-at-a-time paths run only where
the policy needs them: a stray CR inside an unquoted field, a line break or
doubled quote inside a quoted field, junk after a closing quote, and a quote
that never closes. Every one of those paths follows the reference's order of
errors and its line counting exactly.

`main.ts` is the harness driver: it reads every case from
`/input/cases.json`, answers each with `run`, and writes
`/output/answers.json`.

## Verify

```sh
node tools/diff.mjs   # practice set + 70 hand-built edge cases vs csv-reader 1.0.0
node tools/fuzz.mjs   # fresh cases drawn with the kit's own generator, same diff
node --no-incremental-marking tools/bench.mjs  # practice-set timing vs the baseline
```

Local results on the practice set (6 cases, 10,193,953 characters):
correctness 0 mismatches on the practice set, the edge cases and 12 fresh
generator-drawn cases; speed ~75 ms mean vs ~480–500 ms for csv-reader
1.0.0, about 6x faster. Dependency-free ES module, no imports at all.
