// Self-check for the parts of the conversion that would fail silently:
// the PHP unserializer, dynamic-tag resolution, visibility rules, form logic
// and the content model's integrity. Plain asserts, no framework.
//
//   npm run check

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { phpUnserialize } from './lib/wxr.mjs';
import { parseTag, resolveTag, resolveSettings, isVisible, componentProps } from '../src/lib/elementor/props.js';

let n = 0;
const it = (name, fn) => {
  try { fn(); n++; } catch (e) {
    console.error(`FAIL: ${name}\n  ${e.message}`);
    process.exitCode = 1;
  }
};

// --- PHP unserialize --------------------------------------------------------
it('php: scalars and collections', () => {
  assert.equal(phpUnserialize('s:5:"hello";'), 'hello');
  assert.equal(phpUnserialize('i:42;'), 42);
  assert.equal(phpUnserialize('b:1;'), true);
  assert.equal(phpUnserialize('N;'), null);
  assert.deepEqual(phpUnserialize('a:2:{i:0;s:1:"a";i:1;s:1:"b";}'), ['a', 'b']);
  assert.deepEqual(phpUnserialize('a:1:{s:3:"key";s:3:"val";}'), { key: 'val' });
});

it('php: string lengths are byte counts, not character counts', () => {
  // "café" is 5 bytes but 4 JS characters — a naive reader loses the ';'.
  assert.equal(phpUnserialize('a:1:{s:1:"k";s:5:"café";}').k, 'café');
});

// --- dynamic tags -----------------------------------------------------------
const tag = (name, settings) =>
  `[elementor-tag id="x" name="${name}" settings="${encodeURIComponent(JSON.stringify(settings))}"]`;

it('tag: parses name and settings', () => {
  const t = parseTag(tag('post-title', {}));
  assert.equal(t.name, 'post-title');
});

it('tag: post fields resolve from context', () => {
  const post = { id: '99', title: 'A Story', url: '/stories/a-story', thumbnail: '/assets/x.jpg' };
  assert.equal(resolveTag(tag('post-title', {}), {}, { post }), 'A Story');
  assert.equal(resolveTag(tag('post-url', {}), {}, { post }), '/stories/a-story');
  assert.equal(resolveTag(tag('post-id', {}), {}, { post }), '99');
  assert.deepEqual(resolveTag(tag('post-featured-image', {}), {}, { post }), { url: '/assets/x.jpg' });
});

it('tag: post-terms joins the named taxonomy', () => {
  const post = { terms: [{ taxonomy: 'category', slug: 'a', name: 'Alpha' }, { taxonomy: 'category', slug: 'b', name: 'Beta' }] };
  assert.equal(resolveTag(tag('post-terms', { taxonomy: 'category' }), {}, { post }), 'Alpha, Beta');
});

it('tag: excerpt truncates by WORDS and appends `after`', () => {
  const v = resolveTag(
    tag('post-excerpt', { max_length: 3, apply_to_post_content: 'yes', after: '...' }),
    {},
    { post: { excerpt: '', html: '<p>one two three four five</p>' } }
  );
  assert.equal(v, 'one two three...');
});

it('tag: jet-cct-image reads the Custom Content Type record', () => {
  // CCT records are not in the export at all; see scripts/extract-cct.mjs.
  const post = { cct: { story_image: { url: '/assets/gallery/1.jpg' } } };
  const v = resolveTag(tag('jet-cct-image', { content_type_field: 'story_gallery__all___story_image' }), {}, { post });
  assert.deepEqual(v, { url: '/assets/gallery/1.jpg' });
});

it('tag: popup/off-canvas produce Elementor action URLs', () => {
  const v = resolveTag(tag('popup', { popup: '76' }));
  assert.ok(v.startsWith('#elementor-action:action=popup:open&settings='), v);
  const b64 = v.split('settings=')[1];
  assert.deepEqual(JSON.parse(Buffer.from(b64, 'base64').toString()), { id: '76', toggle: false });
});

it('tag: unknown families return undefined so static values survive', () => {
  assert.equal(resolveTag(tag('some-future-tag', {}), {}), undefined);
});

// --- nested resolution ------------------------------------------------------
it('settings: resolves __dynamic__ inside repeater rows', () => {
  const out = resolveSettings(
    { icon_list: [{ _id: 'a', text: 'placeholder', __dynamic__: { text: tag('post-title', {}) } }] },
    {},
    { post: { title: 'Real Title' } }
  );
  assert.equal(out.icon_list[0].text, 'Real Title');
});

it('settings: an empty dynamic result keeps the authored value', () => {
  // This is what preserves a button's styling classes when its optional
  // override prop is unset.
  const out = resolveSettings(
    { _css_classes: 'primary solid', __dynamic__: { _css_classes: tag('jet-component-tag', { control_name: 'missing' }) } },
    {}
  );
  assert.equal(out._css_classes, 'primary solid');
});

// --- visibility -------------------------------------------------------------
it('visibility: `exists` hides an element whose field is empty', () => {
  const settings = {
    jedv_enabled: 'yes',
    jedv_conditions: [{ jedv_condition: 'exists', __dynamic__: { jedv_field: tag('post-title', {}) } }],
  };
  assert.equal(isVisible(settings, {}, { post: { title: '' } }), false);
  assert.equal(isVisible(settings, {}, { post: { title: 'Something' } }), true);
});

it('visibility: absent jedv_enabled means always visible', () => {
  assert.equal(isVisible({}, {}), true);
});

// --- component props --------------------------------------------------------
it('props: text defaults are editor placeholders and must NOT render', () => {
  const comp = { props: [
    { name: 'card_title', type: 'text', default: 'Card Title' },
    { name: 'alignment', type: 'select', default: 'left' },
  ] };
  const bag = componentProps(comp, {});
  assert.equal(bag.card_title, undefined, 'placeholder text must not leak onto the page');
  assert.equal(bag.alignment, 'left', 'structural defaults still apply');
});

// --- content model ----------------------------------------------------------
const stories = JSON.parse(fs.readFileSync('content/stories.json', 'utf8'));
const pages = JSON.parse(fs.readFileSync('content/pages.json', 'utf8'));
const site = JSON.parse(fs.readFileSync('content/site.json', 'utf8'));
const forms = JSON.parse(fs.readFileSync('content/forms.json', 'utf8'));
const gallery = JSON.parse(fs.readFileSync('content/story-gallery.json', 'utf8'));

it('content: all 63 stories extracted, newest first', () => {
  assert.equal(stories.length, 63);
  const published = stories.filter((s) => s.status === 'publish');
  assert.ok(published.length >= 60, `expected 60+ published, got ${published.length}`);
  const dates = published.map((s) => s.date);
  assert.deepEqual(dates, [...dates].sort().reverse(), 'stories must be newest-first');
});

it('content: every story has a slug, title and body', () => {
  for (const s of stories.filter((x) => x.status === 'publish')) {
    assert.ok(s.slug, `story ${s.id} has no slug`);
    assert.ok(s.title, `story ${s.slug} has no title`);
    assert.ok(s.html && s.html.length > 200, `story ${s.slug} has no body`);
  }
});

it('content: every published story has a featured image', () => {
  const published = stories.filter((s) => s.status === 'publish');
  const missing = published.filter((s) => !s.thumbnail);
  assert.equal(missing.length, 0, `no thumbnail: ${missing.map((s) => s.slug).join(', ')}`);
});

it('content: categories are present (2 stories genuinely have none)', () => {
  // jon-pepper and jason-lante carry no category term in the export itself.
  // That is source data, not a conversion fault — but it does mean those two
  // never appear under any filter, which is worth knowing.
  const published = stories.filter((s) => s.status === 'publish');
  const uncategorised = published.filter((s) => s.terms.length === 0);
  assert.equal(uncategorised.length, 2, `expected exactly 2 uncategorised, got ${uncategorised.length}: ${uncategorised.map((s) => s.slug).join(', ')}`);
});

it('content: published pages have a layout tree', () => {
  for (const p of pages.filter((x) => x.status === 'publish')) {
    assert.ok(Array.isArray(p.tree), `page ${p.slug} has no tree`);
  }
});

it('content: the story-gallery CCT was recovered', () => {
  assert.ok(gallery.length >= 10, `expected 10+ gallery slides, got ${gallery.length}`);
  for (const g of gallery) {
    assert.ok(g.src?.startsWith('/assets/'), `gallery slide ${g.id} is not localized: ${g.src}`);
    assert.ok(fs.existsSync('public' + g.src), `gallery image missing on disk: ${g.src}`);
  }
});

it('content: no remote wp-content URLs survived the rewrite', () => {
  for (const file of ['pages.json', 'templates.json', 'components.json', 'stories.json']) {
    const raw = fs.readFileSync(`content/${file}`, 'utf8');
    const leaks = raw.match(/humansoferp\.com\\?\/wp-content\\?\/uploads/g) || [];
    assert.equal(leaks.length, 0, `${file} still points at ${leaks.length} remote upload(s)`);
  }
});

it('content: every referenced asset exists on disk', () => {
  const assets = JSON.parse(fs.readFileSync('content/assets.json', 'utf8'));
  const missing = Object.values(assets).filter((local) => !fs.existsSync('public' + local));
  // Three Elementor *editor* screenshots 404 on the origin too.
  assert.ok(missing.length <= 3, `missing assets (${missing.length}): ${missing.slice(0, 4).join(', ')}`);
});

it('content: SEO titles have no unexpanded Rank Math templates', () => {
  for (const i of [...pages, ...stories]) {
    assert.ok(!/%\w+%/.test(i.seo?.title || ''), `${i.slug}: unexpanded title "${i.seo.title}"`);
  }
});

it('content: both forms extracted with fields', () => {
  assert.equal(forms.length, 2);
  for (const f of forms) assert.ok(f.fields.length > 0, `form ${f.name} has no fields`);
});

it('content: taxonomy terms are present for the filter', () => {
  assert.ok(site.terms.length >= 40, `expected 40+ terms, got ${site.terms.length}`);
  assert.ok(site.terms.every((t) => t.slug && t.name && t.count > 0));
});

it('content: permalinks map stories under /stories/', () => {
  const s = stories.find((x) => x.status === 'publish');
  assert.equal(site.permalinks[s.id], `/stories/${s.slug}`);
});

console.log(`${n} checks passed`);
