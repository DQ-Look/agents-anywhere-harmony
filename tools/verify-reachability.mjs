// Reports ETS sources that are neither compiled nor statically imported.
//
// hvigor only type-checks what the registered pages and their imports can
// reach, so a file that was written but never wired in is never compiled: it
// can drift, or reference something that no longer exists, without failing
// the build.
//
// Two signals are combined so that pure type-only modules (whose imports the
// compiler erases from the output) are not false positives:
//   1. `sourceMaps.map` from the last build lists what was compiled;
//   2. the static `import ... from './...'` graph rooted at the compiled set
//      covers everything referenced only as types.
//
// Run it after a build; without a build output it falls back to the import
// graph rooted at the pages registered in `main_pages.json`.
//
// Usage (from the project root, i.e. the repository root):
//   node tools/verify-reachability.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SOURCE_ROOT = join(ROOT, 'entry', 'src', 'main', 'ets');
const SOURCE_MAP = join(
  ROOT, 'entry', 'build', 'default', 'intermediates', 'loader_out', 'default', 'ets', 'sourceMaps.map',
);
const MAIN_PAGES = join(ROOT, 'entry', 'src', 'main', 'resources', 'base', 'profile', 'main_pages.json');

function collect(directory, found) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      collect(path, found);
    } else if (entry.endsWith('.ets')) {
      found.push(relative(SOURCE_ROOT, path).split('\\').join('/'));
    }
  }
  return found;
}

const sources = collect(SOURCE_ROOT, []).sort();
const sourceSet = new Set(sources);

/** Every relative `import ... from '...'` edge of one file, as source-root-relative ids. */
function importsOf(file) {
  const text = readFileSync(join(SOURCE_ROOT, file), 'utf8');
  const out = new Set();
  for (const match of text.matchAll(/from\s+'(\.[^']+)'/g)) {
    const specifier = match[1];
    const base = relative(SOURCE_ROOT, resolve(join(SOURCE_ROOT, dirname(file)), specifier))
      .split('\\').join('/');
    for (const candidate of [base, `${base}.ets`, join(base, 'Index').split('\\').join('/') + '.ets']) {
      if (sourceSet.has(candidate.replace(/\.ets$/, '') + '.ets')) {
        out.add(candidate.replace(/\.ets$/, ''));
        break;
      }
    }
  }
  return out;
}

// Build the full import graph up front.
const graph = new Map();
for (const file of sources) {
  graph.set(file.replace(/\.ets$/, ''), importsOf(file));
}

// Roots: everything the last build compiled, or (without a build) every page
// registered in main_pages.json.
const roots = new Set();
if (existsSync(SOURCE_MAP)) {
  const map = readFileSync(SOURCE_MAP, 'utf8');
  for (const match of map.matchAll(/src\/main\/ets\/([^"]+?)\.ets"/g)) {
    roots.add(match[1]);
  }
} else {
  console.log('no build output found; rooting the import graph at main_pages.json instead');
  const pages = JSON.parse(readFileSync(MAIN_PAGES, 'utf8')).src;
  for (const page of pages) {
    const id = page.replace(/^pages\//, '').replace(/\.ets$/, '').split('\\').join('/');
    if (graph.has(id)) {
      roots.add(id);
    }
  }
}

// BFS the import graph from the roots.
const visited = new Set(roots);
const queue = [...roots];
while (queue.length > 0) {
  const current = queue.pop();
  for (const next of graph.get(current) || []) {
    if (!visited.has(next)) {
      visited.add(next);
      queue.push(next);
    }
  }
}

const orphans = sources
  .map((path) => path.replace(/\.ets$/, ''))
  .filter((id) => !visited.has(id));
for (const id of orphans) {
  console.error(`not compiled and not imported (unreachable): ${id}.ets`);
}
console.log(`scanned ${sources.length} ETS file(s); roots=${roots.size}; unreachable=${orphans.length}`);
process.exitCode = orphans.length === 0 ? 0 : 1;
