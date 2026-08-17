// WordPress serves resized variants (foo-1024x576.jpg) with a srcset; the WXR
// export only names the originals. Recover the variant set from the live HTML
// we captured, download the files, and emit a manifest the renderer can use to
// reproduce the same width/height/srcset markup.
//
//   node scripts/build-image-manifest.mjs

import fs from 'node:fs';
import path from 'node:path';

import config from '../site.config.mjs';
const ORIGIN = config.origin;
const dir = 'reference/html';

const uploads = (u) => u.replace(/^https?:\/\/[^/]+\/wp-content\/uploads\//, '');
// foo-1024x576.jpg -> foo.jpg  (the "original" key both sides agree on)
const baseOf = (rel) => rel.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '');

const manifest = {}; // "/assets/<base>" -> { width, height, srcset: [{url,w}], sizes }

for (const file of fs.readdirSync(dir)) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1];
    if (!src || !src.includes('/wp-content/uploads/')) continue;

    const rel = uploads(src.split('?')[0]);
    const key = '/assets/' + baseOf(rel);
    const width = Number((tag.match(/\swidth="(\d+)"/) || [])[1]) || null;
    const height = Number((tag.match(/\sheight="(\d+)"/) || [])[1]) || null;
    const sizes = (tag.match(/\ssizes="([^"]+)"/) || [])[1] || null;
    const srcsetRaw = (tag.match(/\ssrcset="([^"]+)"/) || [])[1] || '';

    const srcset = srcsetRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [u, w] = s.split(/\s+/);
        return { rel: uploads(u.split('?')[0]), w: parseInt(w, 10) || null };
      })
      .filter((e) => e.rel && e.w);

    const existing = manifest[key];
    // Keep the richest record we saw for this image.
    if (!existing || srcset.length > (existing.srcset?.length || 0)) {
      manifest[key] = {
        // `src` is the variant WordPress chose as the default for this slot.
        defaultRel: rel,
        width,
        height,
        sizes,
        srcset,
      };
    }
  }
}

console.log(`images with variant data: ${Object.keys(manifest).length}`);

// --- download every variant we don't already have --------------------------
const needed = new Set();
for (const entry of Object.values(manifest)) {
  needed.add(entry.defaultRel);
  for (const s of entry.srcset) needed.add(s.rel);
}

let ok = 0, cached = 0, fail = 0;
const list = [...needed];
const CONCURRENCY = 8;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (list.length) {
      const rel = list.shift();
      const dest = path.join('public/assets', rel);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { cached++; continue; }
      try {
        const res = await fetch(`${ORIGIN}/wp-content/uploads/${rel}`);
        if (!res.ok) { fail++; continue; }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
        ok++;
      } catch { fail++; }
    }
  })
);
console.log(`variants: downloaded=${ok} cached=${cached} failed=${fail}`);

// Drop any srcset entry whose file we couldn't get, so we never emit a 404.
for (const entry of Object.values(manifest)) {
  entry.srcset = entry.srcset.filter((s) => fs.existsSync(path.join('public/assets', s.rel)));
  if (!fs.existsSync(path.join('public/assets', entry.defaultRel))) entry.defaultRel = null;
}

fs.writeFileSync('content/images.json', JSON.stringify(manifest, null, 2));
console.log(`wrote content/images.json (${(fs.statSync('content/images.json').size / 1024).toFixed(0)} kb)`);

