// One-shot discovery of everything site-specific: permalinks, option keys,
// dynamic tag families, the new widget types, and slider configuration.
import { readWxr, phpUnserialize, json } from './lib/wxr.mjs';

const { posts, site } = readWxr(process.argv[2]);
const meta = (p, k) => p.meta[k] || '';

// --- permalinks -------------------------------------------------------------
console.log('=== PERMALINK SHAPES');
for (const t of ['page', 'post']) {
  const sample = posts.filter((p) => p.type === t && p.link).slice(0, 3);
  sample.forEach((p) => console.log(`  ${t.padEnd(6)} ${p.link}`));
}

// --- dynamic tag families ---------------------------------------------------
const tags = {};
const optionKeys = new Map();
const raw = posts.map((p) => meta(p, '_elementor_data')).join('');
for (const m of raw.matchAll(/\[elementor-tag[^\]]*?name=\\?"([^"\\]+)\\?"[^\]]*?settings=\\?"([^"\\]*)\\?"/g)) {
  tags[m[1]] = (tags[m[1]] || 0) + 1;
  if (m[1] === 'jet-options-page') {
    try {
      const s = JSON.parse(decodeURIComponent(m[2].replace(/\\"/g, '"')));
      if (s.option_field) optionKeys.set(s.option_field, s);
    } catch {}
  }
}
console.log('\n=== DYNAMIC TAG FAMILIES');
Object.entries(tags).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
console.log('\n=== jet-options-page KEYS:', optionKeys.size);
for (const [k, v] of optionKeys) console.log(`   ${k}  ${JSON.stringify(v)}`);

// --- the widgets I have not implemented yet ---------------------------------
const NEW = ['loop-grid', 'taxonomy-filter', 'off-canvas', 'jet-listing-grid', 'nav-menu', 'share-buttons', 'post-info'];
console.log('\n=== SETTINGS FOR UNIMPLEMENTED / SPECIAL WIDGETS');
const seen = new Set();
const walk = (nodes, src) => {
  for (const n of nodes || []) {
    if (NEW.includes(n.widgetType) && !seen.has(n.widgetType)) {
      seen.add(n.widgetType);
      const s = { ...n.settings };
      delete s.__dynamic__;
      console.log(`\n--- ${n.widgetType}   (in "${src}", element ${n.id})`);
      console.log('   ' + JSON.stringify(s, null, 1).slice(0, 900).replace(/\n/g, '\n   '));
      if (n.settings?.__dynamic__) console.log('   dynamic:', JSON.stringify(n.settings.__dynamic__).slice(0, 300));
    }
    walk(n.elements, src);
  }
};
for (const p of posts) {
  const d = json(meta(p, '_elementor_data'), null);
  if (d) walk(d, p.title);
}

// --- slider / carousel configuration ----------------------------------------
console.log('\n=== SLIDER SECTIONS');
for (const p of posts.filter((x) => /slider/i.test(x.title))) {
  const d = json(meta(p, '_elementor_data'), []) || [];
  const grids = [];
  const w = (nodes) => { for (const n of nodes || []) { if (n.widgetType) grids.push(n); w(n.elements); } };
  w(d);
  console.log(`\n--- "${p.title}" (id ${p.id}) widgets: ${grids.map((g) => g.widgetType).join(', ')}`);
  for (const g of grids.filter((x) => x.widgetType === 'jet-listing-grid')) {
    const s = g.settings || {};
    const carousel = Object.fromEntries(Object.entries(s).filter(([k]) => /carousel|slide|arrow|dots|autoplay|infinite|speed|columns|lisitng|listing/i.test(k)));
    console.log('   carousel settings:', JSON.stringify(carousel).slice(0, 700));
  }
}

// --- loop-item / archive templates -------------------------------------------
console.log('\n=== ELEMENTOR LIBRARY TEMPLATE TYPES');
for (const p of posts.filter((x) => x.type === 'elementor_library')) {
  console.log(`  ${String(meta(p, '_elementor_template_type')).padEnd(14)} id=${String(p.id).padEnd(6)} "${p.title}"`);
}

// --- jet-engine components ----------------------------------------------------
console.log('\n=== JET-ENGINE ITEMS');
for (const p of posts.filter((x) => x.type === 'jet-engine')) {
  console.log(`  id=${p.id} "${p.title}" entry=${meta(p, '_entry_type')} listing=${JSON.stringify(phpUnserialize(meta(p, '_listing_data')) || {}).slice(0, 200)}`);
  const props = phpUnserialize(meta(p, '_component_props') || '') || [];
  const list = Array.isArray(props) ? props : Object.values(props);
  if (list.length) console.log('     props:', list.map((c) => c.control_name).join(', '));
}

// --- post meta keys (what the story posts carry) ------------------------------
const story = posts.find((p) => p.type === 'post' && p.status === 'publish');
console.log(`\n=== STORY POST META KEYS ("${story.title.slice(0, 50)}")`);
console.log('  ', Object.keys(story.meta).filter((k) => !k.startsWith('_')).join(', '));
console.log('   featured image id:', meta(story, '_thumbnail_id'));

// --- taxonomies ---------------------------------------------------------------
const cats = new Set();
for (const p of posts.filter((x) => x.type === 'post')) {
  for (const c of p.categories || []) cats.add(`${c.domain}:${c.slug}`);
}
console.log('\n=== TAXONOMY TERMS ON POSTS:', [...cats].join(', ').slice(0, 600));

// --- custom code snippet ------------------------------------------------------
console.log('\n=== SNIPPETS');
for (const p of posts.filter((x) => x.type === 'elementor_snippet')) {
  const code = meta(p, '_elementor_code');
  console.log(`  "${p.title}" location=${meta(p, '_elementor_location')} bytes=${code.length}`);
}
