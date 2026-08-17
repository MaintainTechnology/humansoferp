// Concatenate the site's real stylesheets into one bundle, in the same cascade
// order the browser saw them, and localize every url() reference.
//
// We keep Elementor's generated CSS verbatim: it *is* the design, it is already
// build output rather than authored source, and reproducing it by hand would
// only introduce drift.
//
//   node scripts/build-css.mjs

import fs from 'node:fs';
import path from 'node:path';

import config from '../site.config.mjs';

const ORIGIN = config.origin;
const { kept } = JSON.parse(fs.readFileSync('reference/stylesheets.json', 'utf8'));
const siteModel = JSON.parse(fs.readFileSync('content/site.json', 'utf8'));
const fontsModel = siteModel.fonts;
// The kit stylesheet (post-<kitId>.css) defines every design token, so it has
// to land before the child theme and the per-document CSS.
const KIT = `post-${siteModel.tokens.kitId}.css`;

// Cascade order: the homepage's order wins; sheets only seen on inner pages get
// appended after. `kept` is already in first-seen order from the crawl.
const rank = (href) => {
  const f = href.split('?')[0];
  if (/jet-engine.*frontend\.css/.test(f)) return 0;
  if (/reset\.css/.test(f)) return 1;
  if (/themes\/hello-elementor\/assets\/css\/theme\.css/.test(f)) return 2;
  if (/header-footer\.css/.test(f)) return 3;
  if (/custom-frontend/.test(f)) return 4;
  if (/plugins\/elementor(-pro)?\/assets/.test(f)) return 5;
  if (/custom-(pro-)?widget/.test(f)) return 6;
  if (f.endsWith('/' + KIT)) return 7;            // Elementor kit: global tokens
  if (/themes\/[^/]*child/.test(f)) return 8;      // child theme overrides
  return 9;                                        // per-document CSS
};

const ordered = [...kept].sort((a, b) => rank(a) - rank(b) || kept.indexOf(a) - kept.indexOf(b));

const localPath = (href) => {
  const url = href.startsWith('http') ? href : ORIGIN + href;
  return path.join('src/styles/wp', url.split('?')[0].replace(/^https?:\/\/[^/]+\//, ''));
};

// --- resolve and fetch url() targets ---------------------------------------
const pending = new Map(); // absolute remote url -> local public path

const HOST = new URL(ORIGIN).host;

function rewriteUrls(css, sheetHref) {
  const base = new URL(sheetHref.startsWith('http') ? sheetHref : ORIGIN + sheetHref);
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, q, ref) => {
    if (/^(data:|#)/i.test(ref)) return whole;
    let abs;
    try { abs = new URL(ref, base).href; } catch { return whole; }
    const u = new URL(abs);
    // Leave genuinely third-party URLs alone; localize our own.
    if (u.host !== HOST) return whole;

    const clean = u.pathname.replace(/^\//, '');
    // uploads already live under /assets via the extractor's mapping
    if (clean.startsWith('wp-content/uploads/')) {
      return `url(${q}/assets/${clean.slice('wp-content/uploads/'.length)}${u.search ? '' : ''}${q})`;
    }
    const local = '/wp/' + clean.replace(/^wp-content\//, '');
    pending.set(u.origin + u.pathname, path.join('public', local.replace(/^\//, '')));
    return `url(${q}${local}${q})`;
  });
}

/**
 * Each stylesheet is its own parse context in the browser, so an unbalanced
 * brace in one file cannot affect another. Concatenation removes that
 * isolation: a single stray `}` silently swallows every rule that follows.
 * (One really is present here â€” it was killing the button CSS.) Balance each
 * chunk before joining so concatenation stays behaviour-preserving.
 */
function balance(css, label) {
  // Ignore braces inside comments and strings.
  const masked = css
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/"(?:[^"\\]|\\.)*"/g, (m) => ' '.repeat(m.length))
    .replace(/'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));

  let depth = 0;
  let out = '';
  let dropped = 0;
  for (let i = 0; i < css.length; i++) {
    const c = masked[i];
    if (c === '{') depth++;
    else if (c === '}') {
      if (depth === 0) { dropped++; continue; } // stray closer: drop it
      depth--;
    }
    out += css[i];
  }
  if (depth > 0) out += '\n' + '}'.repeat(depth); // unclosed blocks: close them
  if (dropped || depth) {
    console.warn(`  fixed ${label}: dropped ${dropped} stray '}', closed ${depth} open block(s)`);
  }
  return out;
}

// --- build ------------------------------------------------------------------
const chunks = [];
let missing = 0;

for (const href of ordered) {
  const file = localPath(href);
  if (!fs.existsSync(file)) { missing++; continue; }
  const label = href.split('?')[0].replace(ORIGIN, '');
  const css = balance(rewriteUrls(fs.readFileSync(file, 'utf8'), href), label);
  chunks.push(`\n/* ==== ${label} ==== */\n${css}`);
}

// --- @font-face for the two uploaded families -------------------------------
const fontCss = fontsModel
  .flatMap((f) =>
    f.faces.map((face) => {
      const src = Object.entries(face.files)
        .map(([fmt, url]) => `url("${url}") format("${fmt === 'ttf' ? 'truetype' : fmt}")`)
        .join(', ');
      return `@font-face{font-family:"${f.family}";font-style:${face.style};font-weight:${face.weight};font-display:swap;src:${src};}`;
    })
  )
  .join('\n');

// Output goes to public/, not through Next's CSS pipeline. Elementor emits a
// few rules that browsers tolerate but PostCSS rejects (dangling selector
// commas from hand-written custom CSS). Serving the file statically keeps it
// byte-identical to what the live site sends, which is the whole point.
// Our own app.css is appended last so its cascade position is deterministic.
const appCss = fs.existsSync('src/styles/app.css') ? fs.readFileSync('src/styles/app.css', 'utf8') : '';

// Elementor "Custom Code" snippets are injected into <head> and are not part of
// any stylesheet â€” on the live site they land after the child theme and before
// the per-document CSS, so that is where they go here too.
const snippets = fs.existsSync('content/snippets.json')
  ? JSON.parse(fs.readFileSync('content/snippets.json', 'utf8'))
  : [];
const snippetCss = snippets
  .filter((s) => s.css?.trim())
  .map((s) => `\n/* ==== custom code snippet: ${s.title} ==== */\n${balance(s.css, `snippet:${s.title}`)}`)
  .join('\n');

const childThemeIdx = chunks.findIndex((c) => /themes\/[^/]*child/.test(c));
if (snippetCss) {
  chunks.splice(childThemeIdx >= 0 ? childThemeIdx + 1 : chunks.length, 0, snippetCss);
}

// CSS that never becomes a stylesheet: loop-item templates and Elementor's
// inline per-document blocks. On the live site these sit in the markup, i.e.
// last in the cascade, so they go last here too.
const inlineBlocks = fs.existsSync('content/inline-css.json')
  ? JSON.parse(fs.readFileSync('content/inline-css.json', 'utf8'))
  : [];
for (const b of inlineBlocks) {
  chunks.push(`\n/* ==== inline: ${b.id} ==== */\n${balance(b.css, `inline:${b.id}`)}`);
}

fs.mkdirSync('public/styles', { recursive: true });
fs.writeFileSync(
  'public/styles/site.css',
  `/* GENERATED by scripts/build-css.mjs - do not edit. ${ordered.length - missing} stylesheets. */\n` +
    `\n/* ==== custom fonts ==== */\n${fontCss}\n` +
    chunks.join('\n') +
    `\n\n/* ==== app.css (hand-written: replaces dropped plugin behaviour) ==== */\n${appCss}`
);

// --- fetch the assets those stylesheets point at ----------------------------
console.log(`bundled ${ordered.length - missing} stylesheets (${missing} missing) -> public/styles/site.css`);
console.log(`  ${(fs.statSync('public/styles/site.css').size / 1024).toFixed(0)} kb`);
console.log(`  ${pending.size} css-referenced assets to fetch`);

let ok = 0, fail = 0;
await Promise.all(
  [...pending].map(async ([url, dest]) => {
    if (fs.existsSync(dest)) { ok++; return; }
    try {
      const res = await fetch(url);
      if (!res.ok) { fail++; return; }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      ok++;
    } catch { fail++; }
  })
);
console.log(`  fetched=${ok} failed=${fail}`);

