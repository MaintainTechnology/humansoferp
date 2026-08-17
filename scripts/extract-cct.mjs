// JetEngine "Custom Content Types" store their records in dedicated database
// tables, so a WXR export contains none of them. The homepage story slider is
// driven by the `story_gallery` CCT, which means those images exist only in the
// live site's rendered markup.
//
// Recover them from the captured page and download the files.
//
//   node scripts/extract-cct.mjs   ->  content/story-gallery.json

import fs from 'node:fs';
import path from 'node:path';
import config from '../site.config.mjs';

const HOST = new URL(config.origin).host;
const html = fs.readFileSync('reference/html/_.html', 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '');

// Isolate the slider grid (listing 602), then take each item's <img>.
const start = html.indexOf('jet-listing-grid--602');
if (start < 0) {
  console.error('listing 602 not found in reference/html/_.html — re-run `npm run assets` first');
  process.exit(1);
}
// The grid ends where the widget after it begins.
const after = html.indexOf('elementor-widget-html', start);
const segment = html.slice(start, after > 0 ? after : start + 200000);

const items = [];
for (const m of segment.matchAll(/<div class="jet-listing-grid__item[^"]*"[^>]*>([\s\S]*?)(?=<div class="jet-listing-grid__item|$)/g)) {
  const block = m[1];
  const img = block.match(/<img\b[^>]*>/);
  if (!img) continue;
  const tag = img[0];
  const get = (attr) => (tag.match(new RegExp(`\\s${attr}="([^"]*)"`)) || [, ''])[1];
  const src = get('src');
  if (!src) continue;

  const rel = src.replace(new RegExp(`^https?://(?:www\\.)?${HOST.replace(/\./g, '\\.')}/wp-content/uploads/`), '');
  const srcset = get('srcset');
  items.push({
    src: '/assets/' + rel,
    remote: src,
    alt: get('alt'),
    width: Number(get('width')) || null,
    height: Number(get('height')) || null,
    sizes: get('sizes') || null,
    srcset: srcset
      ? srcset.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
          const [u, w] = s.split(/\s+/);
          return {
            src: '/assets/' + u.replace(new RegExp(`^https?://(?:www\\.)?${HOST.replace(/\./g, '\\.')}/wp-content/uploads/`), ''),
            remote: u,
            w: parseInt(w, 10) || null,
          };
        })
      : [],
  });
}

console.log(`story_gallery records recovered: ${items.length}`);

// --- download anything we don't already have --------------------------------
const wanted = new Map();
for (const it of items) {
  wanted.set(it.remote, path.join('public', it.src.replace(/^\//, '')));
  for (const s of it.srcset) wanted.set(s.remote, path.join('public', s.src.replace(/^\//, '')));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, cached = 0, fail = 0;
const list = [...wanted];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (list.length) {
      const [url, dest] = list.shift();
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { cached++; continue; }
      let done = false;
      for (let attempt = 0; attempt < 5 && !done; attempt++) {
        try {
          const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (site-migration)' } });
          if (res.status === 429 || res.status === 503) { await sleep(1000 * 2 ** attempt); continue; }
          if (!res.ok) { fail++; done = true; break; }
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
          ok++; done = true;
        } catch { await sleep(700 * 2 ** attempt); }
      }
      if (!done) fail++;
    }
  })
);
console.log(`  images: downloaded=${ok} cached=${cached} failed=${fail}`);

// Strip the remote URLs before writing: the model should reference local paths.
const clean = items.map(({ remote, srcset, ...rest }, i) => ({
  id: `gallery-${i + 1}`,
  ...rest,
  srcset: srcset.map(({ remote: _r, ...s }) => s),
}));

fs.writeFileSync('content/story-gallery.json', JSON.stringify(clean, null, 2));
console.log(`wrote content/story-gallery.json (${clean.length} slides)`);
