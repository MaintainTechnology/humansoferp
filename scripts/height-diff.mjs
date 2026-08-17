// Pinpoint layout divergence: measure every Elementor element by data-id on
// both sites and report the ones whose height differs most.
//
//   node scripts/height-diff.mjs /why-maintain /why-maintain/

import { chromium } from 'playwright';

const localPath = process.argv[2] || '/';
const livePath = process.argv[3] || '/';
const LOCAL = process.env.LOCAL_ORIGIN || 'http://localhost:3200';
const LIVE = 'https://humansoferp.com';

const measure = async (page, url) => {
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important}
              .pretty,.split-word{opacity:1!important;transform:none!important}`,
  });
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[data-id]')) {
      const r = el.getBoundingClientRect();
      const id = el.getAttribute('data-id');
      if (!out[id]) out[id] = { h: Math.round(r.height), w: Math.round(r.width), type: el.getAttribute('data-widget_type') || 'container' };
    }
    return { els: out, total: document.body.scrollHeight };
  });
};

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
page.on('pageerror', () => {});

const a = await measure(page, LOCAL + localPath);
const b = await measure(page, LIVE + livePath);
await browser.close();

console.log(`total height  local ${a.total}  live ${b.total}  delta ${a.total - b.total}`);

const rows = [];
for (const [id, la] of Object.entries(a.els)) {
  const lb = b.els[id];
  if (!lb) { rows.push({ id, type: la.type, local: la.h, live: null, delta: la.h }); continue; }
  const d = la.h - lb.h;
  if (Math.abs(d) > 8) rows.push({ id, type: la.type, local: la.h, live: lb.h, delta: d });
}
rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

console.log(`\n${rows.length} elements differ by >8px. Top 22 (nested, so parents repeat children's delta):`);
for (const r of rows.slice(0, 22)) {
  console.log(`  ${r.id.padEnd(12)} ${String(r.type).padEnd(30)} local ${String(r.local).padStart(6)}  live ${String(r.live ?? '-').padStart(6)}  Δ ${r.delta > 0 ? '+' : ''}${r.delta}`);
}

// Leaf-level offenders: elements that differ but whose children mostly don't.
const ids = new Set(rows.map((r) => r.id));
console.log('\nLikely root causes (widgets, not containers):');
rows.filter((r) => r.type && r.type !== 'container').slice(0, 15)
  .forEach((r) => console.log(`  ${r.id.padEnd(12)} ${r.type.padEnd(30)} local ${r.local} live ${r.live} Δ ${r.delta}`));
