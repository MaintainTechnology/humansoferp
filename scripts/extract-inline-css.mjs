// Some Elementor CSS never becomes a stylesheet: loop-item templates ship as
// <style id="loop-277"> inside the markup, and Elementor inlines per-document
// CSS under <style id="elementor-post-N">. Neither is reachable by crawling
// <link> tags, so pull them out of the captured pages.
//
//   node scripts/extract-inline-css.mjs   ->  content/inline-css.json

import fs from 'node:fs';
import path from 'node:path';
import config from '../site.config.mjs';

const HOST = new URL(config.origin).host;
const dir = 'reference/html';
const blocks = new Map(); // id -> css (deduped; identical ids repeat per page)

for (const file of fs.readdirSync(dir)) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const m of html.matchAll(/<style[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/style>/g)) {
    const [, id, css] = m;
    if (!css.trim()) continue;
    // WordPress inlines each Gutenberg block's stylesheet as
    // `wp-block-<name>-inline-css` rather than shipping block-library.css, so
    // those are the ONLY copy of the gallery/columns/image layout rules —
    // dropping them stacks a gallery into full-width images. Skip only the
    // genuine noise (emoji, admin bar).
    if (/^(wp-emoji|admin-bar|wp-block-library-theme)/.test(id)) continue;
    if (blocks.has(id) && blocks.get(id).length >= css.length) continue;
    blocks.set(id, css);
  }
}

// Localize uploads URLs the same way the extractor does.
const localize = (css) =>
  css.replace(
    new RegExp(`https?://(?:www\\.)?${HOST.replace(/\./g, '\\.')}/wp-content/uploads/`, 'gi'),
    '/assets/'
  );

const out = [...blocks].map(([id, css]) => ({ id, bytes: css.length, css: localize(css) }));
out.sort((a, b) => a.id.localeCompare(b.id));

fs.writeFileSync('content/inline-css.json', JSON.stringify(out, null, 2));
console.log(`inline CSS blocks: ${out.length}`);
for (const b of out) console.log(`  ${b.id.padEnd(34)} ${String(b.bytes).padStart(7)} bytes`);
console.log(`total ${(out.reduce((a, b) => a + b.bytes, 0) / 1024).toFixed(0)} kb -> content/inline-css.json`);
