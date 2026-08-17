// Visual + structural diff of the Next.js build against the live WordPress site.
//
//   npx next start -p 3100   (in another shell)
//   node scripts/compare.mjs
//
// Produces reference/compare/report.html plus per-route PNGs.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const LOCAL = process.env.LOCAL_ORIGIN || 'http://localhost:3200';
const LIVE = 'https://humansoferp.com';
const OUT = 'reference/compare';
const WIDTHS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];

const pages = JSON.parse(fs.readFileSync('content/pages.json', 'utf8'));
const stories = JSON.parse(fs.readFileSync('content/stories.json', 'utf8')).filter((s) => s.status === 'publish');

// Every page, plus a sample of stories — all 63 share one template, so shooting
// them all would only re-measure the same layout 60 more times.
const routes = [
  { local: '/', live: '/', name: 'home' },
  ...pages
    .filter((p) => p.status === 'publish' && p.slug !== 'home')
    .map((p) => ({ local: `/${p.slug}`, live: `/${p.slug}/`, name: p.slug })),
  ...stories.slice(0, 6).map((s) => ({
    local: `/stories/${s.slug}`,
    live: `/stories/${s.slug}/`,
    name: 'story-' + s.slug.slice(0, 38),
  })),
].filter((r) => (process.argv[2] ? r.name.includes(process.argv[2]) : true));

fs.mkdirSync(OUT, { recursive: true });

// Hide things that legitimately differ (cookie banners, tracking iframes) and
// freeze animations so screenshots are deterministic.
// The story marquee is a running CSS animation, so it is never in the same
// position twice. Freeze every animation and pin the track to its start.
const SETTLE_CSS = `
  *, *::before, *::after { animation: none !important; transition: none !important; }
  [text-split] .word { opacity: 1 !important; transform: none !important; }
  .slick-track { transform: translateX(0) !important; }
  iframe[src*="googletagmanager"], #onetrust-banner-sdk, .forminator-loading { display: none !important; }
`;

async function shoot(page, url, file) {
  // `networkidle` never settles on the live site (tracking beacons keep firing),
  // so wait for load and then give lazy assets a bounded window.
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.addStyleTag({ content: SETTLE_CSS });

  // Drive lazy-loaded imagery into view before capturing.
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight) requestAnimationFrame(step);
        else { window.scrollTo(0, 0); setTimeout(res, 400); }
      };
      step();
    });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: file, fullPage: true });

  return page.evaluate(() => ({
    height: document.body.scrollHeight,
    elements: document.querySelectorAll('*').length,
    widgets: document.querySelectorAll('[data-widget_type]').length,
    containers: document.querySelectorAll('[data-element_type="container"]').length,
    images: [...document.querySelectorAll('img')].filter((i) => i.currentSrc || i.src).length,
    brokenImages: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).length,
    headings: [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => h.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean),
    links: [...document.querySelectorAll('a[href]')].length,
    text: document.body.innerText.replace(/\s+/g, ' ').trim(),
  }));
}

// Compare two PNGs by decoding through the browser (avoids a native dep).
async function diffPng(page, a, b) {
  const toDataUrl = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  return page.evaluate(
    async ([aSrc, bSrc]) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = src;
        });
      const [ia, ib] = await Promise.all([load(aSrc), load(bSrc)]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      if (!w || !h) return { pct: 100, w, h };
      const mk = (img) => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
        return c.getContext('2d').getImageData(0, 0, w, h).data;
      };
      const da = mk(ia), db = mk(ib);
      let diff = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 36) diff++;
      }
      return { pct: (diff / (w * h)) * 100, w, h, heightDelta: Math.abs(ia.height - ib.height) };
    },
    [toDataUrl(a), toDataUrl(b)]
  );
}

const results = [];
const browser = await chromium.launch();

for (const vp of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });

  // Stub IntersectionObserver before any page script runs. The capture below
  // scrolls the whole page, which would otherwise trip infinite scroll on the
  // archive and grow it to all 63 stories — correct behaviour, but it makes the
  // two screenshots incomparable. (Reveal animations are frozen by SETTLE_CSS,
  // so nothing else depends on it here.)
  await ctx.addInitScript(() => {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
  });

  const page = await ctx.newPage();
  page.on('pageerror', () => {});

  for (const r of routes) {
    const base = path.join(OUT, `${r.name}.${vp.name}`);
    const row = { route: r.name, viewport: vp.name, local: r.local };
    try {
      row.localStats = await shoot(page, LOCAL + r.local, `${base}.local.png`);
    } catch (e) { row.error = 'local: ' + e.message.split('\n')[0]; }
    try {
      row.liveStats = await shoot(page, LIVE + r.live, `${base}.live.png`);
    } catch (e) { row.error = (row.error || '') + ' live: ' + e.message.split('\n')[0]; }

    if (row.localStats && row.liveStats) {
      try {
        row.diff = await diffPng(page, `${base}.local.png`, `${base}.live.png`);
      } catch (e) { row.error = 'diff: ' + e.message.split('\n')[0]; }

      // Text-content recall: how much of the live copy made it across.
      const liveWords = new Set(row.liveStats.text.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
      const localWords = new Set(row.localStats.text.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
      const missing = [...liveWords].filter((w) => !localWords.has(w));
      row.textRecall = liveWords.size ? (1 - missing.length / liveWords.size) * 100 : 100;
      row.missingWords = missing.slice(0, 25);

      const liveH = new Set(row.liveStats.headings);
      row.missingHeadings = [...liveH].filter((h) => !row.localStats.headings.includes(h)).slice(0, 12);
    }
    results.push(row);
    const d = row.diff ? `${row.diff.pct.toFixed(1)}% px` : 'n/a';
    const t = row.textRecall != null ? `${row.textRecall.toFixed(0)}% text` : '';
    console.log(`${vp.name.padEnd(8)} ${r.name.padEnd(46)} ${d.padStart(10)}  ${t}  ${row.error || ''}`);
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));

// --- HTML report ------------------------------------------------------------
const rowsHtml = results
  .map((r) => {
    const base = `${r.route}.${r.viewport}`;
    const pct = r.diff ? r.diff.pct : null;
    const colour = pct == null ? '#888' : pct < 2 ? '#1a7f37' : pct < 8 ? '#9a6700' : '#cf222e';
    return `<tr>
      <td><b>${r.route}</b><br><small>${r.viewport}</small></td>
      <td style="color:${colour};font-weight:700">${pct == null ? 'n/a' : pct.toFixed(2) + '%'}</td>
      <td>${r.textRecall == null ? '-' : r.textRecall.toFixed(1) + '%'}</td>
      <td><small>w ${r.localStats?.widgets ?? '-'} / ${r.liveStats?.widgets ?? '-'}<br>
                 img ${r.localStats?.images ?? '-'} / ${r.liveStats?.images ?? '-'}<br>
                 h ${r.localStats?.height ?? '-'} / ${r.liveStats?.height ?? '-'}</small></td>
      <td><small>${(r.missingHeadings || []).join('<br>') || '-'}</small></td>
      <td><a href="${base}.local.png">local</a> · <a href="${base}.live.png">live</a></td>
      <td><small style="color:#cf222e">${r.error || ''}</small></td>
    </tr>`;
  })
  .join('\n');

fs.writeFileSync(
  path.join(OUT, 'report.html'),
  `<!doctype html><meta charset=utf-8><title>Next.js vs WordPress</title>
<style>body{font:14px system-ui;margin:2rem;max-width:1100px}table{border-collapse:collapse;width:100%}
td,th{border-bottom:1px solid #ddd;padding:.5rem;vertical-align:top;text-align:left}</style>
<h1>Next.js build vs live WordPress</h1>
<p>Pixel diff is the share of differing pixels over the shared area; text recall is the share of live words present locally.</p>
<table><tr><th>Route</th><th>Pixel diff</th><th>Text recall</th><th>widgets/img/height<br><small>local / live</small></th><th>Missing headings</th><th>Shots</th><th>Error</th></tr>
${rowsHtml}</table>`
);

const scored = results.filter((r) => r.diff);
const avg = scored.reduce((a, r) => a + r.diff.pct, 0) / (scored.length || 1);
const avgText = scored.reduce((a, r) => a + (r.textRecall || 0), 0) / (scored.length || 1);
console.log(`\naverage pixel diff ${avg.toFixed(2)}%  |  average text recall ${avgText.toFixed(1)}%`);
console.log(`report -> ${path.join(OUT, 'report.html')}`);
