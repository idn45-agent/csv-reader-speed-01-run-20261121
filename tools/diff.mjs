// Diff harness: runs this repo's solve.js and csv-reader 1.0.0 (the kit
// baseline's vendor copy) over the practice set plus hand-built edge cases,
// and reports every byte-level mismatch (JSON.stringify comparison).
// Usage: node tools/diff.mjs [edge-only]
import { readFileSync } from 'node:fs';
import { run as mine } from '../solve.js';
import { readCsv as ref } from '/home/hatch/workspace/makefun/csv-reader-speed-01-run-20261121-kit-batch/csv-reader-speed-01-run-20261121-kit/baselines/csv-reader/vendor/csv-reader/index.js';

const KIT = '/home/hatch/workspace/makefun/csv-reader-speed-01-run-20261121-kit-batch/csv-reader-speed-01-run-20261121-kit';

const edge = [
  { text: '', header: true },
  { text: '', header: false },
  { text: '\uFEFF', header: true },
  { text: '\uFEFFa,b\n1,2', header: true },
  { text: 'a,b\n1,2', header: false },
  { text: 'a,b\r\n1,2\r\n', header: true },
  { text: 'a,b\n1,2', header: true }, // no trailing newline
  { text: 'a,b\n1,2\r', header: true }, // trailing lone CR
  { text: '\n\n\na,b\n\n1,2\n\n', header: true }, // blank lines
  { text: '\r\n\r\na,b\r\n1,2\r\n', header: true }, // blank CRLF lines
  { text: '\r\r\na,b\n1,2', header: true }, // stray CRs then CRLF
  { text: '\r', header: true }, // only a stray CR
  { text: '\r\r', header: false },
  { text: 'a,b\n\r1,2\n', header: true }, // line of only a stray CR
  { text: 'a,b\n1\r2,3\n', header: true }, // stray CR mid-field
  { text: 'a,b\n1\rb\n', header: false },
  { text: 'a,b\n"x\ry",2\n', header: true }, // lone CR inside quotes
  { text: 'a,b\n"x\r\ny",2\n', header: true }, // CRLF inside quotes
  { text: 'a,b\n"x\ny\nz",2\n', header: true }, // LFs inside quotes
  { text: 'a,b\n"x""y",2\n', header: true }, // doubled quote
  { text: 'a,b\n"""",2\n', header: true }, // quote pair then close
  { text: 'a,b\n""",2\n', header: true }, // three quotes
  { text: 'a,b\n"x', header: true }, // unterminated quote at EOF
  { text: 'a,b\n"x,y\n', header: true }, // unterminated quote, comma after
  { text: 'a,b\n"x\n1,2\n3,4\n', header: true }, // unterminated, later lines
  { text: 'a,b\n"x"junk,2\n', header: true }, // quote junk
  { text: 'a,b\n"x" junk,2\n', header: true }, // quote junk with space
  { text: 'a,b\n"x",2\n', header: true }, // quoted, no junk
  { text: 'a,b\n"x"\r,2\n', header: true }, // junk: lone CR then comma
  { text: 'a,b\n"x"\r', header: true }, // junk: lone CR at EOF
  { text: 'a,b\n"x"junk', header: true }, // junk to EOF
  { text: 'a,b\n"x"junk\r\n1,2\n', header: true },
  { text: 'a,b\n"x""y"z,2\n', header: true }, // doubled quote then junk
  { text: 'a,b\n"x"y"z,2\n', header: true }, // quote inside junk
  { text: 'a,b\nx"y,2\n', header: true }, // quote inside unquoted field
  { text: 'a,b\n"",2\n', header: true }, // quoted empty field
  { text: '""\n', header: true }, // single quoted empty field as header
  { text: '""\n', header: false },
  { text: 'a\n1\n', header: true }, // single column
  { text: 'a,b,c\n1,2\n', header: true }, // short row
  { text: 'a,b,c\n1,2,3,4,5\n', header: true }, // long row
  { text: 'a,b\n1\n2,3,4\n', header: true }, // short then long
  { text: 'a,b\n,,\n', header: true }, // empty fields
  { text: ',\n,\n', header: false },
  { text: 'a,b\n1,2\n3\n', header: true }, // short last record, no trailing NL
  { text: 'a,b\r1,2\r3,4', header: true }, // lone CRs as separators (stray)
  { text: 'a,b\n"x\ry\rz",2\n"p\rq",3\n', header: true }, // CRs in quotes, line count
  { text: 'a,b\n"line1\r\nline2\rlin3\nline4",2\nnext,here\n', header: true },
  { text: 'a,b\n"x",2\n"unterminated', header: true }, // unterminated last field
  { text: '\uFEFFa,b\n"1\n2",x\n', header: true }, // BOM + multiline quote
  { text: 'a,b\n"a""b""c",2\n', header: true }, // several doubled quotes
  { text: 'a,b\n"""" ,2\n', header: true }, // quoted quote + junk space
  { text: 'a,b\n"x" ,2\n', header: true }, // junk is a space
  { text: 'a,b\n"x"\t,2\n', header: true }, // junk is a tab
  { text: 'a,b\n1,2\r\n3,4\n5,6\r\n', header: true }, // mixed LF/CRLF
  { text: 'h1,h2,h3\n"a,b","c""d","e\nf"\n1,2,3\n', header: true },
  { text: 'a,b\n"q\n\n\n",2\nx,y\n', header: true }, // several LFs in quotes
  { text: 'a,b\n"x\ry",2\ns,t\n', header: false }, // header false, CR in quotes
  { text: 'a\n"unterminated\nmore\nand more', header: false },
  { text: 'a,b\n"x"junk"more",2\n', header: true },
  { text: 'a,b\n""x,2\n', header: true }, // quoted empty + junk
  { text: 'a,b\n"""x",2\n', header: true }, // quote, doubled, x
  { text: 'a,b\n1,2\n\n\n\n3,4\n', header: true }, // several blank lines
  { text: 'a,b\n1,2\n\r\n3,4\n', header: true }, // blank CRLF between records
  { text: 'a,b\n1,2\n\r3,4\n', header: true }, // stray CR line between records
  { text: 'a,b\n"a\r\rb",2\n', header: true }, // CR CRLF mix in quotes
  { text: 'x\n"a\rb\rc"\n', header: true },
  { text: 'x,y\n"a",\n"b",\n', header: true }, // trailing commas, empty 2nd field
  { text: 'x,y\n,\n', header: true }, // record of two empty fields
  { text: 'x\n,\n', header: false }, // long row: 2 fields vs width 1
];

let cases = [];
let names = [];
if (process.argv[2] !== 'edge-only') {
  const practice = JSON.parse(readFileSync(`${KIT}/practice/input/cases.json`, 'utf8'));
  for (const c of practice) { cases.push(c.input); names.push(c.id); }
}
for (let i = 0; i < edge.length; i++) { cases.push(edge[i]); names.push(`edge-${i}`); }

let mismatches = 0;
for (let i = 0; i < cases.length; i++) {
  const input = cases[i];
  let a, b;
  try { a = mine(input); } catch (e) { console.log(`MINE THREW ${names[i]}: ${e.message}`); mismatches++; continue; }
  try { b = ref(input); } catch (e) { console.log(`REF THREW ${names[i]}: ${e.message}`); mismatches++; continue; }
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) {
    mismatches++;
    console.log(`MISMATCH ${names[i]} input=${JSON.stringify(input).slice(0, 200)}`);
    // find first differing position
    let k = 0;
    while (k < Math.min(sa.length, sb.length) && sa[k] === sb[k]) k++;
    console.log(`  mine: ...${sa.slice(Math.max(0, k - 80), k + 160)}`);
    console.log(`  ref : ...${sb.slice(Math.max(0, k - 80), k + 160)}`);
    if (mismatches > 5) { console.log('... stopping after 6 mismatches'); break; }
  }
}
console.log(`\n${cases.length} cases, ${mismatches} mismatches`);
process.exit(mismatches === 0 ? 0 : 1);
