import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs
  .readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function filesBelow(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(absolute, extension);
    return entry.name.endsWith(extension) ? [absolute] : [];
  });
}

function undefinedCssTokens() {
  const css = filesBelow(path.join(root, 'src'), '.css').map((file) => [
    file,
    fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
  ]);
  const definitions = new Set(
    css.flatMap(([, contents]) =>
      [...contents.matchAll(/(--rs-[\w-]+)\s*:/g)].map((match) => match[1]),
    ),
  );
  return css.flatMap(([file, contents]) =>
    [...contents.matchAll(/var\(\s*(--rs-[\w-]+)\s*(,)?/g)]
      .filter((match) => !match[2] && !definitions.has(match[1]))
      .map(
        (match) =>
          `${path.relative(root, file)} uses undefined token ${match[1]}`,
      ),
  );
}

function variablesFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Theme block not found: ${selector}`);
  return Object.fromEntries(
    [...match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((entry) => [
      entry[1],
      entry[2].trim(),
    ]),
  );
}

function resolveColor(name, variables, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular color token: ${name}`);
  seen.add(name);
  const value = variables[name];
  if (!value) throw new Error(`Missing color token: ${name}`);
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (reference) return resolveColor(reference[1], variables, seen);
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  throw new Error(`Unsupported color value for ${name}: ${value}`);
}

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return (
    0.2126 * channels[0] +
    0.7152 * channels[1] +
    0.0722 * channels[2]
  );
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const base = variablesFor(':root.rs-theme');
const themes = [
  ['light', base],
  ['dark', { ...base, ...variablesFor('.pf-v6-theme-dark.rs-theme') }],
];
const pairs = [
  ['primary text', '--rs-color-ink', '--rs-color-surface'],
  ['secondary text', '--rs-color-muted', '--rs-color-surface'],
  ['surface variant text', '--rs-color-ended', '--rs-color-surface'],
  ['filled primary', '--rs-color-on-primary', '--rs-color-primary'],
  ['filled secondary', '--rs-color-on-secondary', '--rs-color-secondary'],
  ['filled success', '--rs-color-on-ok', '--rs-color-ok'],
  ['filled warning', '--rs-color-on-warn', '--rs-color-warn'],
  ['urgent surface', '--rs-color-on-urgent', '--rs-color-urgent'],
  ['urgent metadata', '--rs-color-urgent-meta', '--rs-color-urgent'],
  [
    'success container',
    '--rs-color-on-success-container',
    '--rs-color-success-container',
  ],
  [
    'warning container',
    '--rs-color-on-warning-container',
    '--rs-color-warning-container',
  ],
  [
    'error container',
    '--rs-color-on-error-container',
    '--rs-color-error-container',
  ],
];

const failures = undefinedCssTokens();
const requiredFoundations = [
  ['light', base, '--rs-color-bg', '#ffffff'],
  ['light', base, '--rs-color-surface', '#ffffff'],
  ['dark', themes[1][1], '--rs-color-bg', '#000000'],
  ['dark', themes[1][1], '--rs-color-surface', '#000000'],
];
for (const [theme, variables, token, expected] of requiredFoundations) {
  const actual = resolveColor(token, variables).toLowerCase();
  if (actual !== expected) {
    failures.push(`${theme} ${token} must be ${expected}; found ${actual}`);
  }
}
for (const [theme, variables] of themes) {
  for (const [label, foregroundToken, backgroundToken] of pairs) {
    const foreground = resolveColor(foregroundToken, variables);
    const background = resolveColor(backgroundToken, variables);
    const ratio = contrast(foreground, background);
    if (ratio < 4.5) {
      failures.push(
        `${theme} ${label}: ${ratio.toFixed(2)}:1 (${foreground} on ${background})`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`audit:contrast failed\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(
    `audit:contrast OK — ${pairs.length} semantic text pairs pass 4.5:1 in light and dark`,
  );
}
