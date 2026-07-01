// check-docs.mjs — doc-freshness QA (CLAUDE.md §8 release checklist / §9 definition of done).
// Fails (exit 1) when the mechanical claims in the docs drift from reality, so a stale README
// fails CI instead of shipping. Dev-only (§4/§6): zero dependencies, never loaded at runtime.
//
// What it gates (the things that rot fastest, per the 2026-07 docs review):
//   1. README's version claim matches package.json.
//   2. README's dataset claim (paint count + brand count) matches src/data/paints.json.
//   3. CLAUDE.md §4 tree ↔ disk, both directions: every path named in the tree exists, and every
//      file in the app-critical dirs appears in the tree (the tree's own rule: same-commit index).
//   4. CHANGELOG has an [Unreleased] heading, no duplicated section headings inside it, a heading
//      for the current package.json version, and no placeholder (example.com) links.
// Prose freshness (feature descriptions, statuses) can't be machine-checked — that's §9 item 7.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = p => readFileSync(join(root, p), 'utf8');
const problems = [];
const fail = msg => problems.push(msg);

/* 1+2 — README claims */
const pkg = JSON.parse(read('package.json'));
const readme = read('README.md');
if (!readme.includes(`**v${pkg.version}**`))
  fail(`README.md: version claim **v${pkg.version}** (package.json) not found — refresh the Status section.`);

const dataset = JSON.parse(read('src/data/paints.json'));
const paintCount = dataset.paints.length;
const brandCount = new Set(dataset.paints.map(p => p.brand)).size;
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const claim = `**${fmt(paintCount)} paints across ${brandCount} brands**`;
if (!readme.includes(claim))
  fail(`README.md: dataset claim ${claim} not found — the repo map must state the real counts.`);

/* 3 — CLAUDE.md §4 tree ↔ disk */
const constitution = read('CLAUDE.md');
const treeMatch = constitution.match(/```\n\/\n([\s\S]*?)```/);
if (!treeMatch) fail('CLAUDE.md: could not locate the §4 file tree code block.');
const tree = treeMatch ? treeMatch[1] : '';

// all repo files (skip the heavy/derived dirs)
const SKIP = new Set(['.git', 'node_modules', '.ds-sync', '.design-sync']);
const repoFiles = [];
(function walk(dir) {
  for (const e of readdirSync(join(root, dir))) {
    if (SKIP.has(e)) continue;
    const rel = dir ? `${dir}/${e}` : e;
    if (statSync(join(root, rel)).isDirectory()) walk(rel);
    else repoFiles.push(rel);
  }
})('');

// forward: every file-looking token in the tree must exist somewhere in the repo
const tokens = tree.split('\n').flatMap(line => {
  const body = line.replace(/[│├└─]/g, ' ').split('←')[0];
  return body.split('·').map(t => t.trim()).filter(t => /^[\w.@-]+\.[\w]+$/.test(t));   // files only (name.ext)
});
for (const t of new Set(tokens)) {
  if (!repoFiles.some(f => f === t || f.endsWith('/' + t)))
    fail(`CLAUDE.md §4 tree names "${t}" but no such file exists in the repo.`);
}

// reverse: files in the app-critical dirs must be indexed in the tree (the tree's same-commit rule)
const INDEXED_DIRS = ['src/js', 'src/styles', 'src/data', 'docs', 'scripts', '.github/workflows'];
for (const dir of INDEXED_DIRS) {
  for (const f of repoFiles.filter(f => f.startsWith(dir + '/'))) {
    const base = relative(dir, f);
    if (base.includes('/')) continue;                       // only the dir's direct children are itemised
    if (!tree.includes(base))
      fail(`CLAUDE.md §4 tree is missing "${f}" — the tree is the authoritative index (add it in the same commit).`);
  }
}

/* 4 — CHANGELOG hygiene */
const changelog = read('CHANGELOG.md');
const unrel = changelog.match(/## \[Unreleased\]([\s\S]*?)(?=\n## \[|$)/);
if (!unrel) fail('CHANGELOG.md: no [Unreleased] section.');
else {
  const heads = [...unrel[1].matchAll(/^### (\w+)/gm)].map(m => m[1]);
  for (const h of new Set(heads))
    if (heads.filter(x => x === h).length > 1)
      fail(`CHANGELOG.md [Unreleased]: "### ${h}" appears ${heads.filter(x => x === h).length}× — merge into one (Keep a Changelog).`);
}
if (!changelog.includes(`## [${pkg.version}]`))
  fail(`CHANGELOG.md: no heading for the current version ${pkg.version} — cut the release section (§8 checklist).`);
if (changelog.includes('example.com'))
  fail('CHANGELOG.md: placeholder example.com link(s) present — point at the real repo.');

/* verdict */
if (problems.length) {
  console.error(`check-docs: ${problems.length} freshness failure(s)\n` + problems.map(p => '  ✗ ' + p).join('\n'));
  process.exit(1);
}
console.log(`check-docs: PASS ✓  (v${pkg.version} · ${fmt(paintCount)} paints / ${brandCount} brands · tree + CHANGELOG consistent)`);
