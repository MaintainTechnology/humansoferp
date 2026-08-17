// Fast, network-light fidelity check: compare our rendered HTML against the
// saved live HTML in reference/html. No browser, no live requests.
//
//   node scripts/structural-diff.mjs [route ...]

import fs from 'node:fs';
import path from 'node:path';

const LOCAL = process.env.LOCAL_ORIGIN || 'http://localhost:3100';
const pages = JSON.parse(fs.readFileSync('content/pages.json', 'utf8'));
const stories = JSON.parse(fs.readFileSync('content/stories.json', 'utf8'));

// Only routes we actually captured a reference page for.
const captured = new Set(fs.readdirSync('reference/html'));
const routes = [
  { local: '/', ref: '_.html', name: 'home' },
  ...pages
    .filter((p) => p.status === 'publish' && p.slug !== 'home')
    .map((p) => ({ local: `/${p.slug}`, ref: `_${p.slug}_.html`, name: p.slug })),
  ...stories
    .filter((s) => s.status === 'publish')
    .map((s) => ({
      local: `/stories/${s.slug}`,
      ref: `_stories_${s.slug}_.html`,
      name: 'story:' + s.slug.slice(0, 34),
    })),
].filter((r) => captured.has(r.ref));

const only = process.argv.slice(2);
const selected = only.length ? routes.filter((r) => only.some((o) => r.name.includes(o))) : routes;

// Strip <script> first: Next.js serialises the RSC payload into inline scripts,
// which would otherwise be counted as rendered markup.
const strip = (h) => h.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, '');
const markupOnly = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, '');

// Visible text, normalised. Ignores whitespace, case and entity encoding —
// the live site writes curly apostrophes as &#8217; while we emit the literal
// character, which is the same text and must not read as a difference.
const NAMED = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', mdash: '—', ndash: '–' };

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

function textOf(html) {
  return decodeEntities(strip(html).replace(/<[^>]+>/g, ' '))
    // Normalise curly punctuation to ASCII so both sides tokenise identically.
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const countOf = (html, re) => (html.match(re) || []).length;

function widgetHistogram(html) {
  const out = {};
  for (const m of html.matchAll(/data-widget_type="([^".]+)/g)) out[m[1]] = (out[m[1]] || 0) + 1;
  return out;
}

function elementIds(html) {
  return new Set([...html.matchAll(/elementor-element-([a-z0-9]+)/g)].map((m) => m[1]));
}

const report = [];

for (const r of selected) {
  const refFile = path.join('reference/html', r.ref);
  if (!fs.existsSync(refFile)) {
    console.log(`skip ${r.name} (no reference capture)`);
    continue;
  }
  let local;
  try {
    const res = await fetch(LOCAL + r.local);
    local = await res.text();
    if (!res.ok) throw new Error(`local ${res.status}`);
  } catch (e) {
    console.log(`FAIL ${r.name}: ${e.message}`);
    continue;
  }
  const live = fs.readFileSync(refFile, 'utf8');

  const localM = markupOnly(local);
  const liveM = markupOnly(live);

  const lw = widgetHistogram(localM);
  const vw = widgetHistogram(liveM);
  const widgetDelta = {};
  for (const k of new Set([...Object.keys(lw), ...Object.keys(vw)])) {
    const d = (lw[k] || 0) - (vw[k] || 0);
    if (d !== 0) widgetDelta[k] = `${lw[k] || 0}/${vw[k] || 0}`;
  }

  const lIds = elementIds(localM);
  const vIds = elementIds(liveM);
  const missingIds = [...vIds].filter((i) => !lIds.has(i));
  const extraIds = [...lIds].filter((i) => !vIds.has(i));

  // Text recall both ways: what the live site shows that we don't (missing),
  // and what we show that it doesn't (extra — catches placeholder leakage).
  const words = (t) => new Set(t.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []);
  const lWords = words(textOf(localM));
  const vWords = words(textOf(liveM));
  const missingWords = [...vWords].filter((w) => !lWords.has(w));
  const extraWords = [...lWords].filter((w) => !vWords.has(w));
  const recall = vWords.size ? (1 - missingWords.length / vWords.size) * 100 : 100;

  const row = {
    route: r.name,
    widgets: `${countOf(localM, /data-widget_type=/g)}/${countOf(liveM, /data-widget_type=/g)}`,
    containers: `${countOf(localM, /data-element_type="container"/g)}/${countOf(liveM, /data-element_type="container"/g)}`,
    imgs: `${countOf(localM, /<img\b/g)}/${countOf(liveM, /<img\b/g)}`,
    elementIds: `${lIds.size}/${vIds.size}`,
    missingIds: missingIds.length,
    extraIds: extraIds.length,
    textRecall: recall,
    missingWords: missingWords.slice(0, 18),
    extraWords: extraWords.slice(0, 18),
    widgetDelta,
  };
  report.push(row);

  const clean = recall > 99 && missingIds.length === 0 && extraIds.length === 0 && extraWords.length === 0;
  const flag = clean ? 'OK  ' : recall > 95 && missingIds.length === 0 ? 'NEAR' : recall > 85 ? 'WARN' : 'BAD ';
  console.log(
    `${flag} ${r.name.padEnd(44)} widgets ${row.widgets.padEnd(9)} cont ${row.containers.padEnd(9)} ` +
    `img ${row.imgs.padEnd(8)} ids ${row.elementIds.padEnd(9)} miss=${String(missingIds.length).padEnd(3)} ` +
    `extra=${String(extraIds.length).padEnd(3)} text ${recall.toFixed(1)}%`
  );
  if (Object.keys(widgetDelta).length) console.log(`      widget delta (local/live): ${JSON.stringify(widgetDelta)}`);
  if (missingWords.length) console.log(`      missing: ${missingWords.slice(0, 14).join(', ')}`);
  if (extraWords.length) console.log(`      extra:   ${extraWords.slice(0, 14).join(', ')}`);
}

fs.mkdirSync('reference/compare', { recursive: true });
fs.writeFileSync('reference/compare/structural.json', JSON.stringify(report, null, 2));

const avg = report.reduce((a, r) => a + r.textRecall, 0) / (report.length || 1);
const totalMissing = report.reduce((a, r) => a + r.missingIds, 0);
const totalExtra = report.reduce((a, r) => a + r.extraIds, 0);
console.log(
  `\n${report.length} routes | average text recall ${avg.toFixed(1)}% | ` +
  `missing element ids ${totalMissing} | extra element ids ${totalExtra}`
);
