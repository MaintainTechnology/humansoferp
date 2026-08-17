// Download every referenced upload into public/assets, and the site's real
// stylesheets into src/styles/wp. Elementor's generated CSS is the ground truth
// for layout, so we take it verbatim rather than re-deriving it.
//
//   npm run assets

import fs from 'node:fs';
import path from 'node:path';
import config from '../site.config.mjs';

const ORIGIN = config.origin;
const assets = JSON.parse(fs.readFileSync('content/assets.json', 'utf8'));
const pages = JSON.parse(fs.readFileSync('content/pages.json', 'utf8'));
const stories = JSON.parse(fs.readFileSync('content/stories.json', 'utf8'));
const terms = JSON.parse(fs.readFileSync('content/site.json', 'utf8')).terms;

let ok = 0, fail = 0, skipped = 0;
const failures = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The origin rate-limits (429) under concurrency, so back off and retry rather
// than recording a phantom "missing asset".
async function download(url, dest, attempt = 0) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { skipped++; return true; }
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (site-migration)' } });
    if (res.status === 429 || res.status === 503) {
      if (attempt < 5) {
        await sleep(1000 * 2 ** attempt + Math.floor(Math.random() * 400));
        return download(url, dest, attempt + 1);
      }
      failures.push(`${res.status} (gave up after ${attempt} retries) ${url}`);
      fail++;
      return false;
    }
    if (!res.ok) { failures.push(`${res.status} ${url}`); fail++; return false; }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    ok++;
    return true;
  } catch (e) {
    if (attempt < 3) {
      await sleep(700 * 2 ** attempt);
      return download(url, dest, attempt + 1);
    }
    failures.push(`ERR ${url} :: ${e.message}`);
    fail++;
    return false;
  }
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()); }));
}

// --- 1. media ---------------------------------------------------------------
console.log(`[1/3] media: ${Object.keys(assets).length} files`);
await pool(Object.entries(assets), 4, ([remote, local]) =>
  download(remote, path.join('public', local.replace(/^\//, '')))
);
console.log(`      downloaded=${ok} cached=${skipped} failed=${fail}`);
failures.slice(0, 10).forEach((f) => console.warn('      ' + f));

// --- 2. discover stylesheets by crawling the live pages ---------------------
// Sample rather than crawl all 63 stories: they share one single-post template,
// so a handful is enough to see every stylesheet the template pulls in.
const urls = [
  '/',
  ...pages.filter((p) => p.status === 'publish' && p.slug !== 'home').map((p) => `/${p.slug}/`),
  ...stories.filter((s) => s.status === 'publish').slice(0, 6).map((s) => `/stories/${s.slug}/`),
  ...terms.slice(0, 3).map((t) => `/category/${t.slug}/`),
];

const sheets = new Set();
const scripts = new Set();

console.log(`[2/3] crawling ${urls.length} pages for the stylesheet graph`);
fs.mkdirSync('reference/html', { recursive: true });
await pool(urls, 5, async (u) => {
  try {
    const res = await fetch(ORIGIN + u, { headers: { 'user-agent': 'Mozilla/5.0 (site-migration)' } });
    if (!res.ok) { console.warn(`      ${res.status} ${u}`); return; }
    const html = await res.text();
    for (const m of html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/g)) sheets.add(m[1]);
    for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) scripts.add(m[1]);
    fs.writeFileSync(path.join('reference/html', (u.replace(/\//g, '_') || 'root') + '.html'), html);
  } catch (e) {
    console.warn(`      ERR ${u} :: ${e.message}`);
  }
});
console.log(`      found ${sheets.size} stylesheets, ${scripts.size} scripts`);

// --- 3. download the stylesheets we keep ------------------------------------
const keep = [...sheets].filter((s) => !config.cssSkip.some((re) => re.test(s)));
console.log(`[3/3] stylesheets: keeping ${keep.length}, skipping ${sheets.size - keep.length} (plugin CSS we replace)`);

ok = 0; fail = 0; skipped = 0;
await pool(keep, 8, async (href) => {
  const url = href.startsWith('http') ? href : ORIGIN + href;
  const clean = url.split('?')[0].replace(/^https?:\/\/[^/]+\//, '');
  await download(url, path.join('src/styles/wp', clean));
});
console.log(`      downloaded=${ok} cached=${skipped} failed=${fail}`);

fs.mkdirSync('reference', { recursive: true });
fs.writeFileSync('reference/stylesheets.json', JSON.stringify({
  kept: keep,
  skipped: [...sheets].filter((s) => config.cssSkip.some((re) => re.test(s))),
}, null, 2));
fs.writeFileSync('reference/scripts.json', JSON.stringify([...scripts], null, 2));
console.log('done. reference/ holds the live HTML + asset graph for comparison.');

