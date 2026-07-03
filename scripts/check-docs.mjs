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

const root = new URL('..', import.meta.url).pathname;   // repo root (this script lives in /scripts)
const read = p => readFileSync(join(root, p), 'utf8');   // read a repo-relative file as text
const problems = [];                    // collected freshness failures
const fail = msg => problems.push(msg); // record one failure (we report them all at the end, not fail-fast)

/* 1+2 — README claims */
// Gate 1: the README must literally contain the current version from package.json, e.g. "**v1.4.0**".
const pkg = JSON.parse(read('package.json'));
const readme = read('README.md');
if (!readme.includes(`**v${pkg.version}**`))
  fail(`README.md: version claim **v${pkg.version}** (package.json) not found — refresh the Status section.`);

// Gate 2: the README's headline counts must match the real dataset. Derive the true paint + brand counts…
const dataset = JSON.parse(read('src/data/paints.json'));
const paintCount = dataset.paints.length;
const brandCount = new Set(dataset.paints.map(p => p.brand)).size;
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');   // thousands separators, e.g. 1234 → "1,234"
// …then require that exact phrasing to appear verbatim in the README.
const claim = `**${fmt(paintCount)} paints across ${brandCount} brands**`;
if (!readme.includes(claim))
  fail(`README.md: dataset claim ${claim} not found — the repo map must state the real counts.`);

/* 3 — CLAUDE.md §4 tree ↔ disk */
// Gate 3 checks the §4 file tree against the actual repo in BOTH directions. First extract the tree: it's the
// fenced code block that starts with a lone "/" (the repo-root line).
const constitution = read('CLAUDE.md');
const treeMatch = constitution.match(/```\n\/\n([\s\S]*?)```/);
if (!treeMatch) fail('CLAUDE.md: could not locate the §4 file tree code block.');
const tree = treeMatch ? treeMatch[1] : '';

// Walk the whole repo to list every real file (recursively), skipping heavy/derived/VCS dirs.
const SKIP = new Set(['.git', 'node_modules', '.ds-sync', '.design-sync']);
const repoFiles = [];
(function walk(dir) {
  for (const e of readdirSync(join(root, dir))) {
    if (SKIP.has(e)) continue;
    const rel = dir ? `${dir}/${e}` : e;                    // build the repo-relative path
    if (statSync(join(root, rel)).isDirectory()) walk(rel); // recurse into subdirectories
    else repoFiles.push(rel);
  }
})('');

// forward: every file-looking token in the tree must exist somewhere in the repo.
// Strip the box-drawing characters, drop any "← comment", split on the "·" separator, and keep only tokens
// that look like a filename (name.ext).
const tokens = tree.split('\n').flatMap(line => {
  const body = line.replace(/[│├└─]/g, ' ').split('←')[0];
  return body.split('·').map(t => t.trim()).filter(t => /^[\w.@-]+\.[\w]+$/.test(t));   // files only (name.ext)
});
for (const t of new Set(tokens)) {
  // A tree filename is satisfied by any repo file with that exact name (as a whole path or a path suffix).
  if (!repoFiles.some(f => f === t || f.endsWith('/' + t)))
    fail(`CLAUDE.md §4 tree names "${t}" but no such file exists in the repo.`);
}

// reverse: files in the app-critical dirs must be indexed in the tree (the tree's same-commit rule).
// This catches a file that was added to the code but never listed in the constitution's tree.
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
// Gate 4 keeps the CHANGELOG in Keep-a-Changelog shape. Isolate the [Unreleased] section (everything up to
// the next "## [" version heading, or end of file).
const changelog = read('CHANGELOG.md');
const unrel = changelog.match(/## \[Unreleased\]([\s\S]*?)(?=\n## \[|$)/);
if (!unrel) fail('CHANGELOG.md: no [Unreleased] section.');
else {
  // Inside [Unreleased], each "### Added/Changed/Fixed/…" subsection should appear at most once.
  const heads = [...unrel[1].matchAll(/^### (\w+)/gm)].map(m => m[1]);
  for (const h of new Set(heads))
    if (heads.filter(x => x === h).length > 1)
      fail(`CHANGELOG.md [Unreleased]: "### ${h}" appears ${heads.filter(x => x === h).length}× — merge into one (Keep a Changelog).`);
}
// There must be a released heading matching the current package.json version (release checklist §8).
if (!changelog.includes(`## [${pkg.version}]`))
  fail(`CHANGELOG.md: no heading for the current version ${pkg.version} — cut the release section (§8 checklist).`);
// Placeholder-link check: parse the footer link definitions and compare the real hostname (not a
// substring — this is a freshness check, but do it the URL-correct way).
// Every "[label]: url" footer link must be a valid URL that doesn't point at the example.com placeholder.
for (const [, label, href] of changelog.matchAll(/^\[([^\]]+)\]:\s+(\S+)/gm)) {
  let host = null;
  try { host = new URL(href).hostname; } catch { /* not a URL */ }   // unparseable → host stays null → flagged
  if (host === null || host === 'example.com' || host.endsWith('.example.com'))
    fail(`CHANGELOG.md: link definition [${label}] points at a placeholder or invalid URL (${href}) — point at the real repo.`);
}

/* verdict */
// Any collected problem fails the build (exit 1) and lists them; otherwise print a one-line PASS summary.
if (problems.length) {
  console.error(`check-docs: ${problems.length} freshness failure(s)\n` + problems.map(p => '  ✗ ' + p).join('\n'));
  process.exit(1);
}
console.log(`check-docs: PASS ✓  (v${pkg.version} · ${fmt(paintCount)} paints / ${brandCount} brands · tree + CHANGELOG consistent)`);
