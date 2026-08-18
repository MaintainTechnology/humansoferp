#!/usr/bin/env node
// Generates design-system/tokens.json, colors.css, typography.css from content/site.json.
// Run from repo root: node design-system/scripts/build-tokens.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const OUT = path.resolve(here, '..');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'site.json'), 'utf8'));

// ---------- colors ----------
const scales = {}; // scaleKey -> { step -> hex }
const semantic = {}; // name -> hex
const system = {}; // elementor system ids (primary/secondary/text/accent) -> {title, hex}

const SCALE_RE = /^(Primary|Secondary|Accent|Grays - Cool|Grays - Neutral)\s+(\d+)$/;
const SCALE_KEY = {
  'Primary': 'primary',
  'Secondary': 'secondary',
  'Accent': 'accent',
  'Grays - Cool': 'gray-cool',
  'Grays - Neutral': 'gray-neutral',
};

for (const [id, { title, color }] of Object.entries(site.tokens.colors)) {
  const hex = color.toUpperCase();
  const m = title.match(SCALE_RE);
  if (['primary', 'secondary', 'text', 'accent'].includes(id)) {
    system[id] = { title, hex };
  }
  if (m) {
    const key = SCALE_KEY[m[1]];
    (scales[key] ??= {})[m[2]] = hex;
  } else if (!['primary', 'secondary', 'text', 'accent'].includes(id)) {
    semantic[title] = hex;
  }
}

const kebab = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let css = `/* Humans of ERP — color tokens. Generated from content/site.json — do not hand-edit.\n * Regenerate: node design-system/scripts/build-tokens.mjs */\n:root {\n`;
for (const [scale, steps] of Object.entries(scales)) {
  css += `\n  /* ${scale} */\n`;
  for (const step of Object.keys(steps).sort((a, b) => a - b)) {
    css += `  --hoe-${scale}-${step}: ${steps[step]};\n`;
  }
}
css += `\n  /* semantic */\n`;
for (const [name, hex] of Object.entries(semantic)) {
  css += `  --hoe-${kebab(name)}: ${hex};\n`;
}
css += `\n  /* elementor global system colors (aliases) */\n`;
for (const [id, { hex }] of Object.entries(system)) {
  css += `  --hoe-system-${id}: ${hex};\n`;
}
css += `}\n`;
fs.writeFileSync(path.join(OUT, 'colors.css'), css);

// ---------- typography ----------
const fontsCfg = site.fonts ?? [];
let tcss = `/* Humans of ERP — typography. Generated from content/site.json — do not hand-edit.\n * Regenerate: node design-system/scripts/build-tokens.mjs */\n`;
for (const font of fontsCfg) {
  for (const face of font.faces ?? []) {
    const file = path.basename(face.files.ttf);
    tcss += `@font-face {\n  font-family: '${font.family}';\n  font-style: ${face.style};\n  font-weight: ${face.weight === 'normal' ? 400 : face.weight};\n  font-display: swap;\n  src: url('./fonts/${file}') format('truetype');\n}\n`;
  }
}

const typo = {};
tcss += `\n/* type scale (from Elementor global kit) */\n`;
for (const [id, t] of Object.entries(site.tokens.typography)) {
  if (/Don't change/i.test(t.title)) continue; // deprecated Elementor defaults (Roboto)
  const cls = kebab(t.title);
  typo[cls] = t;
  const size = t.size?.unit === 'custom' ? String(t.size.size).replace(/;$/, '') : t.size ? `${t.size.size}${t.size.unit}` : null;
  const lh = t.lineHeight ? `${t.lineHeight.size}${t.lineHeight.unit === 'em' ? '' : t.lineHeight.unit}` : null;
  tcss += `.hoe-${cls} {\n  font-family: '${t.family}', sans-serif;\n  font-weight: ${t.weight};\n`;
  if (size) tcss += `  font-size: ${size};\n`;
  if (lh) tcss += `  line-height: ${lh};\n`;
  if (t.letterSpacing) tcss += `  letter-spacing: ${t.letterSpacing.size}${t.letterSpacing.unit};\n`;
  if (t.textTransform) tcss += `  text-transform: ${t.textTransform};\n`;
  tcss += `}\n`;
}
fs.writeFileSync(path.join(OUT, 'typography.css'), tcss);

// ---------- tokens.json ----------
const tokens = {
  $meta: {
    brand: site.site.title,
    tagline: site.site.description,
    url: site.site.url,
    source: 'content/site.json (Elementor global kit)',
    generatedBy: 'design-system/scripts/build-tokens.mjs',
  },
  colors: { ...scales, semantic, system: Object.fromEntries(Object.entries(system).map(([k, v]) => [k, v.hex])) },
  typography: typo,
  fonts: fontsCfg.map((f) => ({
    family: f.family,
    faces: (f.faces ?? []).map((face) => ({
      weight: face.weight === 'normal' ? 400 : Number(face.weight),
      style: face.style,
      file: `fonts/${path.basename(face.files.ttf)}`,
    })),
  })),
  nav: site.nav?.map((n) => ({ label: n.label, url: n.url })),
};
fs.writeFileSync(path.join(OUT, 'tokens.json'), JSON.stringify(tokens, null, 2) + '\n');

console.log('wrote colors.css (%d color vars), typography.css (%d styles), tokens.json',
  Object.values(scales).reduce((n, s) => n + Object.keys(s).length, 0) + Object.keys(semantic).length + Object.keys(system).length,
  Object.keys(typo).length);
