// WXR -> structured JSON content model.
//   npm run extract
// Writes content/*.json. Nothing here touches the network.

import fs from 'node:fs';
import path from 'node:path';
import { readWxr, phpUnserialize, json } from './lib/wxr.mjs';
import config from '../site.config.mjs';

const SRC = process.argv[2] || path.resolve(config.xml);
const OUT = path.resolve('content');
fs.mkdirSync(OUT, { recursive: true });

const { site, posts } = readWxr(SRC);
const byId = new Map(posts.map((p) => [p.id, p]));
const host = new URL(config.origin).host;

// --- asset URL rewriting ----------------------------------------------------
// Every wp-content/uploads URL becomes a local /assets/... path. We collect the
// mapping as we go so the downloader knows exactly what to fetch.
const assets = new Map(); // remoteUrl -> localPath
const uploadsRe = new RegExp(
  `https?:\\\\?/\\\\?/(?:www\\.)?${host.replace(/\./g, '\\.')}\\\\?/wp-content\\\\?/uploads\\\\?/[^"'\\s)\\\\]+`,
  'gi'
);

function localize(url) {
  if (typeof url !== 'string') return url;
  const m = url.match(new RegExp(`^https?://(?:www\\.)?${host.replace(/\./g, '\\.')}/wp-content/uploads/(.+?)(\\?.*)?$`, 'i'));
  if (!m) return url;
  const local = '/assets/' + m[1];
  assets.set(url.split('?')[0], local);
  return local;
}

function localizeDeep(node) {
  if (typeof node === 'string') {
    return node.replace(uploadsRe, (raw) => localize(raw.replace(/\\\//g, '/')));
  }
  if (Array.isArray(node)) return node.map(localizeDeep);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = localizeDeep(v);
    return out;
  }
  return node;
}

const tree = (p) => localizeDeep(json(p.meta['_elementor_data'], []) || []);

// --- Permalinks -------------------------------------------------------------
// `internal-url` dynamic tags reference posts by numeric id, so we need an
// id -> path map. Derived from each item's own <link>, which the export carries.
function extractPermalinks() {
  const map = {};
  for (const p of posts) {
    if (!p.link || !p.id) continue;
    if (['attachment', 'nav_menu_item', 'elementor_library', 'jet-engine'].includes(p.type)) continue;
    let pathname;
    try { pathname = new URL(p.link).pathname; } catch { continue; }
    // Query-string permalinks mean "no pretty link yet" (drafts); fall back.
    if (!pathname || pathname === '/' ) {
      pathname = p.slug === 'home' || p.type === 'page' ? '/' : `/${p.slug}`;
    }
    pathname = pathname.replace(/\/$/, '') || '/';
    if (pathname === '/home') pathname = '/';
    map[p.id] = pathname;
  }
  return map;
}

// --- Design tokens from the Elementor kit -----------------------------------
function extractTokens() {
  const kit = posts.find((p) => p.meta['_elementor_template_type'] === 'kit');
  if (!kit) return { colors: {}, typography: {}, layout: {} };
  const k = phpUnserialize(kit.meta['_elementor_page_settings'] || '') || {};

  const colors = {};
  for (const c of [...(k.system_colors || []), ...(k.custom_colors || [])]) {
    if (c && c._id) colors[c._id] = { title: c.title || c._id, color: c.color };
  }
  const typography = {};
  for (const t of [...(k.system_typography || []), ...(k.custom_typography || [])]) {
    if (!t || !t._id) continue;
    typography[t._id] = {
      title: t.title || t._id,
      family: t.typography_font_family,
      weight: t.typography_font_weight,
      size: t.typography_font_size,
      lineHeight: t.typography_line_height,
    };
  }
  return {
    colors,
    typography,
    layout: {
      containerWidth: k.container_width,
      body: {
        family: k.body_typography_font_family,
        size: k.body_typography_font_size,
        weight: k.body_typography_font_weight,
      },
    },
    kitId: kit.id,
  };
}

// --- Custom fonts -----------------------------------------------------------
function extractFonts() {
  return posts
    .filter((p) => p.type === 'elementor_font')
    .map((p) => {
      const faces = phpUnserialize(p.meta['elementor_font_files'] || '') || [];
      return {
        family: p.title,
        faces: (Array.isArray(faces) ? faces : Object.values(faces))
          .map((f) => ({
            weight: f.font_weight || 'normal',
            style: f.font_style || 'normal',
            files: Object.fromEntries(
              ['woff2', 'woff', 'ttf', 'svg', 'eot']
                .map((fmt) => [fmt, f[fmt]?.url ? localize(f[fmt].url) : null])
                .filter(([, v]) => v)
            ),
          }))
          .filter((f) => Object.keys(f.files).length),
      };
    });
}

// --- JetEngine listings / components ----------------------------------------
function extractComponents() {
  const out = {};
  for (const p of posts.filter((x) => x.type === 'jet-engine')) {
    const raw = phpUnserialize(p.meta['_component_props'] || '') || [];
    const list = Array.isArray(raw) ? raw : Object.values(raw);
    out[p.id] = {
      id: p.id,
      name: p.title,
      entryType: p.meta['_entry_type'] || 'component',
      props: list.map((c) => ({
        name: c.control_name,
        label: c.control_label,
        type: c.control_type || 'text',
        default: c.control_default_image ? localizeDeep(c.control_default_image) : c.control_default,
        options: c.control_options
          ? String(c.control_options).split('\n').filter(Boolean).map((o) => {
              const [value, label] = o.split('::');
              return { value, label: label ?? value };
            })
          : undefined,
      })),
      tree: tree(p),
      listing: p.meta['_listing_data'] ? phpUnserialize(p.meta['_listing_data']) : null,
      css: p.meta['_jet_engine_listing_css'] || '',
    };
  }
  return out;
}

// --- Elementor library: header / footer / popup / loop-item / archive -------
function extractTemplates() {
  const out = {};
  for (const p of posts.filter((x) => x.type === 'elementor_library')) {
    if (p.meta['_elementor_template_type'] === 'kit') continue;
    out[p.id] = {
      id: p.id,
      name: p.title,
      kind: p.meta['_elementor_template_type'] || 'section',
      tree: tree(p),
      settings: localizeDeep(json(p.meta['_elementor_page_settings'], {}) || {}),
      conditions: phpUnserialize(p.meta['_elementor_conditions'] || '') || null,
    };
  }
  return out;
}

// --- Navigation -------------------------------------------------------------
function extractNav() {
  const items = posts
    .filter((p) => p.type === 'nav_menu_item')
    .map((p) => {
      const objectType = p.meta['_menu_item_object'];
      const objectId = p.meta['_menu_item_object_id'];
      const target = objectType === 'custom' ? null : byId.get(objectId);
      let url;
      if (objectType === 'custom') url = p.meta['_menu_item_url'] || '#';
      else if (target) {
        try { url = new URL(target.link).pathname.replace(/\/$/, '') || '/'; }
        catch { url = `/${target.slug}`; }
      } else url = '#';
      // Same-site absolute URLs become relative so client navigation works.
      if (url.startsWith(config.origin)) url = url.slice(config.origin.length) || '/';
      return {
        id: p.id,
        parent: p.meta['_menu_item_menu_item_parent'] || '0',
        order: p.order,
        objectType,
        menu: (p.categories || []).find((c) => c.domain === 'nav_menu')?.slug || 'default',
        label: p.title || target?.title || '',
        url,
      };
    })
    .sort((a, b) => a.order - b.order);

  const map = new Map(items.map((i) => [i.id, { ...i, children: [] }]));
  const roots = [];
  for (const item of map.values()) {
    const parent = map.get(item.parent);
    if (parent && parent.id !== item.id) parent.children.push(item);
    else roots.push(item);
  }
  return roots;
}

// --- SEO --------------------------------------------------------------------
function expandSeoTemplate(tpl, post) {
  if (!tpl || !tpl.includes('%')) return tpl;
  return tpl
    .replace(/%title%/g, post.title)
    .replace(/%sitename%/g, site.title)
    .replace(/%sitedesc%/g, site.description || '')
    .replace(/%sep%/g, '|')
    .replace(/%page%/g, '')
    .replace(/%excerpt%/g, (post.excerpt || '').replace(/<[^>]+>/g, '').trim())
    .replace(/%currentyear%/g, String(new Date().getFullYear()))
    .replace(/%[a-z_]+%/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*\|\s*$/, '')
    .trim();
}

const seo = (p) => ({
  title: expandSeoTemplate(p.meta['rank_math_title'], p) || p.title,
  description: expandSeoTemplate(p.meta['rank_math_description'], p) || '',
  ogImage: localize(p.meta['rank_math_facebook_image'] || '') || null,
});

const thumbOf = (p) => localize(byId.get(p.meta['_thumbnail_id'])?.attachmentUrl || '') || null;

// --- Pages ------------------------------------------------------------------
function extractPages() {
  return posts
    .filter((p) => p.type === 'page')
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      template: p.meta['_wp_page_template'] || 'default',
      tree: tree(p),
      settings: localizeDeep(json(p.meta['_elementor_page_settings'], {}) || {}),
      html: localizeDeep(p.content),
      seo: seo(p),
    }));
}

// --- Stories (the `post` type) ----------------------------------------------
function extractStories() {
  return posts
    .filter((p) => p.type === 'post')
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      date: p.date,
      excerpt: localizeDeep(p.excerpt),
      html: localizeDeep(p.content),
      thumbnail: thumbOf(p),
      terms: (p.categories || []).map((c) => ({ taxonomy: c.domain, slug: c.slug, name: c.name })),
      seo: seo(p),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// --- Forms (Forminator) -----------------------------------------------------
function extractForms() {
  return posts
    .filter((p) => p.type === 'forminator_forms')
    .map((p) => {
      const data = phpUnserialize(p.meta['forminator_form_meta'] || '') || {};
      const fields = [];
      for (const w of data.fields || data.wrappers || []) {
        for (const fld of w.fields || [w]) {
          if (!fld || !fld.element_id) continue;
          fields.push({
            id: fld.element_id,
            row: w.wrapper_id || null,
            type: fld.type || fld.element_id.split('-')[0],
            label: fld.field_label || '',
            placeholder: fld.placeholder || '',
            description: fld.consent_description || fld.description || '',
            required: fld.required === 'true' || fld.required === true || fld.required === 1 || fld.required === '1',
            options: fld.options?.map((o) => ({
              label: o.label,
              value: o.value,
              default: o.default === '1' || o.default === 1 || o.default === true,
            })) || undefined,
            conditionAction: fld.condition_action || 'show',
            conditionRule: fld.condition_rule || 'all',
            conditions: (fld.conditions || []).map((c) => ({ field: c.element_id, rule: c.rule, value: c.value })),
            fileTypes: fld.filetypes || undefined,
            uploadLimit: fld['upload-limit'] || undefined,
            fileSize: fld.filesize || undefined,
          });
        }
      }
      const s = data.settings || {};
      return {
        id: p.id,
        name: p.title,
        slug: p.slug,
        fields,
        thankYou: s['thankyou-message'] || 'Thank you for getting in touch. We will be in contact shortly.',
        submitLabel: s['submit-button-text'] || 'Submit',
      };
    });
}

// --- Elementor Custom Code snippets -----------------------------------------
// Injected into <head>/<body> on every page and NOT part of any stylesheet.
// The "Master CTA Button" snippet carries ~22 kB of button/design-token CSS.
function extractSnippets() {
  return posts
    .filter((p) => p.type === 'elementor_snippet' && p.status === 'publish')
    .map((p) => {
      const code = localizeDeep(p.meta['_elementor_code'] || '');
      return {
        id: p.id,
        title: p.title,
        location: p.meta['_elementor_location'] || 'elementor_head',
        priority: Number(p.meta['_elementor_priority'] || 10),
        css: [...code.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n'),
        js: [...code.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n'),
        scriptSrcs: [...code.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map((m) => m[1]),
      };
    })
    .sort((a, b) => a.priority - b.priority);
}

// --- Taxonomy terms ---------------------------------------------------------
function extractTerms() {
  const counts = new Map();
  for (const p of posts.filter((x) => x.type === 'post' && x.status === 'publish')) {
    for (const c of p.categories || []) {
      if (c.domain !== 'category') continue;
      const k = c.slug;
      if (!counts.has(k)) counts.set(k, { slug: c.slug, name: c.name, count: 0 });
      counts.get(k).count++;
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// --- Elementor page CSS fallback --------------------------------------------
function writePageCss() {
  const dir = path.join(OUT, 'page-css');
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const p of posts) {
    const css = [...p.content.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    if (!css.trim()) continue;
    fs.writeFileSync(path.join(dir, `${p.type}-${p.id}-${p.slug || 'untitled'}.css`), css);
    n++;
  }
  return n;
}

// --- Write ------------------------------------------------------------------
const model = {
  site: { ...site, sourceUrl: site.url },
  tokens: extractTokens(),
  fonts: extractFonts(),
  nav: extractNav(),
  components: extractComponents(),
  templates: extractTemplates(),
  pages: extractPages(),
  stories: extractStories(),
  forms: extractForms(),
  snippets: extractSnippets(),
  terms: extractTerms(),
};

for (const a of posts.filter((p) => p.type === 'attachment')) {
  if (a.attachmentUrl) localize(a.attachmentUrl);
}

const write = (name, data) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return `${name} ${(fs.statSync(file).size / 1024).toFixed(0)}kb`;
};

const permalinks = extractPermalinks();

const written = [
  write('site.json', {
    site: model.site,
    tokens: model.tokens,
    fonts: model.fonts,
    nav: model.nav,
    terms: model.terms,
    options: config.options,
    permalinks,
  }),
  write('components.json', model.components),
  write('templates.json', model.templates),
  write('pages.json', model.pages),
  write('stories.json', model.stories),
  write('forms.json', model.forms),
  write('snippets.json', model.snippets),
  write('assets.json', Object.fromEntries([...assets].sort())),
];

// The dynamic-tag resolver must import cleanly from plain Node as well as from
// Next, so emit a real ES module rather than relying on JSON import attributes.
fs.writeFileSync(
  path.join(OUT, 'site-data.js'),
  '// GENERATED by scripts/extract.mjs - do not edit.\n' +
    `export const options = ${JSON.stringify(config.options, null, 2)};\n\n` +
    `export const permalinks = ${JSON.stringify(permalinks, null, 2)};\n`
);

const cssFiles = writePageCss();

console.log('extracted ->', written.join(' | '));
console.log(`  page-css fallback: ${cssFiles} files`);
console.log(
  `  pages=${model.pages.length} stories=${model.stories.length} components=${Object.keys(model.components).length}` +
  ` templates=${Object.keys(model.templates).length} forms=${model.forms.length} snippets=${model.snippets.length}` +
  ` terms=${model.terms.length} assets=${assets.size}`
);
console.log(`  colors=${Object.keys(model.tokens.colors).length} typography=${Object.keys(model.tokens.typography).length} fonts=${model.fonts.length}`);
