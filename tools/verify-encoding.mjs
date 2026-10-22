// Encoding guard: text sources are checked for a BOM, a replacement
// character, or mojibake before a round is called done. On Windows a
// PowerShell ANSI round trip can silently corrupt every non-ASCII string,
// and a BOM breaks hvigor's JSON5 parsing of the first line.
//
// Usage (from the project root, i.e. the repository root):
//   node tools/verify-encoding.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['entry/src/main/ets', 'entry/src/main/resources', 'AppScope', 'tools'];
const SKIP = new Set(['build', 'node_modules', '.hvigor', 'oh_modules']);
const TEXT = /\.(ets|ts|json|json5|mjs|md)$/;

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) {
        walk(path);
      }
    } else if (TEXT.test(entry.name)) {
      files.push(path);
    }
  }
}
for (const root of ROOTS) {
  walk(root);
}

let bom = 0;
let replacement = 0;
let mojibake = 0;
for (const file of files) {
  const bytes = readFileSync(file);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    console.log('BOM', file);
    bom++;
  }
  const text = bytes.toString('utf8');
  if (text.includes('\uFFFD')) {
    console.log('REPLACEMENT', file);
    replacement++;
  }
  if (/[\u00c3\u00c2][\u0080-\u00bf]/.test(text)) {
    console.log('MOJIBAKE', file);
    mojibake++;
  }
}
console.log(`scanned ${files.length} text files; BOM=${bom} replacement=${replacement} mojibake=${mojibake}`);
process.exitCode = bom + replacement + mojibake === 0 ? 0 : 1;
