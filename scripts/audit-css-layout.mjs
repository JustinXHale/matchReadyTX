#!/usr/bin/env node
/**
 * CSS layout audit — catches modularization regressions:
 * - rs-* classes used in TSX but missing from any CSS file
 * - feature *.css files not imported from a TS/TSX entry
 * - BrandLogo fluid wrap antipattern (32px masthead box + large logo)
 *
 * Run: npm run audit:css
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const IGNORED_RS_CLASSES = new Set([
  // Dynamic / conditional hooks with no dedicated rules today
  'rs-list-row__inline-away-wrap',
  'rs-detail-meta__row--fees',
  'rs-coach-fb-criterion__head',
  // Layout roots — children carry the real styles (rs-stack, rs-list, etc.)
  'rs-member-edit',
  'rs-queue-list',
]);

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (name === 'node_modules') continue;
      walk(path, ext, out);
    } else if (path.endsWith(ext)) {
      out.push(path);
    }
  }
  return out;
}

function extractRsClassesFromTsx(content) {
  const classes = new Set();
  const re =
    /\brs-[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?/g;
  for (const line of content.split('\n')) {
    if (!line.includes('className')) continue;
    let m;
    while ((m = re.exec(line))) {
      classes.add(m[0]);
    }
  }
  return classes;
}

function extractDefinedRsClasses(css) {
  const defined = new Set();
  const re = /\.(rs-[a-z0-9_-]+)/gi;
  let m;
  while ((m = re.exec(css))) {
    defined.add(m[1]);
  }
  return defined;
}

function classIsDefined(cls, defined) {
  if (defined.has(cls)) return true;
  const root = cls.split(/(?:__|--)/)[0];
  if (defined.has(root)) return true;
  for (const d of defined) {
    if (d.startsWith(`${cls}__`) || d.startsWith(`${cls}--`)) return true;
    if (cls.startsWith(`${d}__`) || cls.startsWith(`${d}--`)) return true;
  }
  return false;
}

const tsxFiles = walk(SRC, '.tsx');
const cssFiles = walk(SRC, '.css');

const usedClasses = new Set();
for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf8');
  for (const cls of extractRsClassesFromTsx(content)) {
    usedClasses.add(cls);
  }
}

const definedClasses = new Set();
const cssByFile = new Map();
for (const file of cssFiles) {
  const content = readFileSync(file, 'utf8');
  cssByFile.set(file, content);
  for (const cls of extractDefinedRsClasses(content)) {
    definedClasses.add(cls);
  }
}

const missing = [...usedClasses]
  .filter((cls) => !IGNORED_RS_CLASSES.has(cls))
  .filter((cls) => !classIsDefined(cls, definedClasses))
  .sort();

// Feature CSS import graph — each feature stylesheet must be imported somewhere
const allTs = walk(SRC, '.ts').concat(tsxFiles);
const featureCss = cssFiles.filter((f) => f.includes('/features/'));
const orphanedCss = featureCss.filter((file) => {
  const name = basename(file);
  return !allTs.some((tsFile) => readFileSync(tsFile, 'utf8').includes(name));
});

// BrandLogo antipattern
const brandLogoSrc = readFileSync(join(SRC, 'ui/BrandLogo.tsx'), 'utf8');
const brandLogoIssues = [];
if (
  brandLogoSrc.includes("'rs-brand-logo-wrap rs-brand-logo-wrap--fluid'") ||
  brandLogoSrc.includes('"rs-brand-logo-wrap rs-brand-logo-wrap--fluid"')
) {
  brandLogoIssues.push(
    'BrandLogo applies masthead rs-brand-logo-wrap (32×32) together with fluid — causes login overlap',
  );
}

const mastheadCss = readFileSync(
  join(SRC, 'styles/shell/brand-masthead.css'),
  'utf8',
);
if (
  !mastheadCss.includes('.rs-brand-logo-wrap--fluid') ||
  !mastheadCss.includes('height: auto')
) {
  brandLogoIssues.push(
    'brand-masthead.css missing fluid wrap height:auto reset',
  );
}

// Shared detail chrome must live in shell, not match-detail only
const detailShared = readFileSync(
  join(SRC, 'styles/shell/detail-shared.css'),
  'utf8',
);
const sharedDetailSelectors = [
  'rs-detail__back',
  'rs-detail-sticky',
  'rs-detail-tools',
];
const detailSharedMissing = sharedDetailSelectors.filter(
  (sel) => !detailShared.includes(`.${sel}`),
);

let exitCode = 0;
const problems = [];

if (missing.length) {
  exitCode = 1;
  problems.push(
    `Missing CSS for ${missing.length} rs-* class(es) used in TSX:\n  ${missing.join('\n  ')}`,
  );
}

if (orphanedCss.length) {
  exitCode = 1;
  problems.push(
    `Orphaned feature CSS (not imported from any TS/TSX):\n  ${orphanedCss.map((f) => relative(ROOT, f)).join('\n  ')}`,
  );
}

if (brandLogoIssues.length) {
  exitCode = 1;
  problems.push(`BrandLogo layout:\n  ${brandLogoIssues.join('\n  ')}`);
}

if (detailSharedMissing.length) {
  exitCode = 1;
  problems.push(
    `Shared detail chrome missing from detail-shared.css:\n  ${detailSharedMissing.join(', ')}`,
  );
}

if (problems.length === 0) {
  console.log(
    `audit:css OK — ${usedClasses.size} rs classes used, ${definedClasses.size} defined, ${featureCss.length} feature stylesheets wired`,
  );
} else {
  console.error('audit:css FAILED\n');
  for (const p of problems) console.error(`${p}\n`);
}

process.exit(exitCode);
