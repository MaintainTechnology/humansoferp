// Minimal WXR (WordPress eXtended RSS) reader + PHP unserializer.
// No deps: the export is regular enough that regex beats pulling in an XML parser.

import fs from 'node:fs';

const decodeEntities = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export function readWxr(path) {
  const xml = fs.readFileSync(path, 'utf8');

  const chan = (tag) => {
    const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
    return m ? m[1] : '';
  };

  const items = xml.split('<item>').slice(1).map((s) => s.split('</item>')[0]);

  const field = (s, tag) => {
    const m = s.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
    return m ? m[1] : '';
  };

  const postmeta = (s) => {
    const out = {};
    const re = /<wp:postmeta>\s*<wp:meta_key><!\[CDATA\[([\s\S]*?)\]\]><\/wp:meta_key>\s*<wp:meta_value><!\[CDATA\[([\s\S]*?)\]\]><\/wp:meta_value>\s*<\/wp:postmeta>/g;
    let m;
    while ((m = re.exec(s))) out[m[1]] = m[2];
    return out;
  };

  // <category domain="nav_menu" nicename="main-menu">Main Menu</category>
  const categories = (s) =>
    [...s.matchAll(/<category domain="([^"]+)" nicename="([^"]+)">(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/g)]
      .map((m) => ({ domain: m[1], slug: m[2], name: m[3] }));

  const posts = items.map((s) => ({
    categories: categories(s),
    id: field(s, 'wp:post_id'),
    title: decodeEntities(field(s, 'title')),
    type: field(s, 'wp:post_type'),
    status: field(s, 'wp:status'),
    slug: field(s, 'wp:post_name'),
    parent: field(s, 'wp:post_parent'),
    order: parseInt(field(s, 'wp:menu_order') || '0', 10),
    date: field(s, 'wp:post_date_gmt'),
    link: field(s, 'link'),
    excerpt: field(s, 'excerpt:encoded'),
    content: field(s, 'content:encoded'),
    attachmentUrl: field(s, 'wp:attachment_url'),
    meta: postmeta(s),
  }));

  return {
    site: { title: chan('title'), url: chan('wp:base_site_url'), description: chan('description') },
    posts,
    raw: xml,
  };
}

// --- PHP serialize() reader -------------------------------------------------
// WordPress stores option-ish arrays PHP-serialized. Needed for _component_props,
// the Elementor kit, and custom font file maps.
export function phpUnserialize(input) {
  let i = 0;
  const s = input;

  const expect = (ch) => {
    if (s[i] !== ch) throw new Error(`php: expected '${ch}' at ${i}, got '${s[i]}'`);
    i++;
  };

  function value() {
    const t = s[i];
    if (t === 'N') { i += 2; return null; }
    if (t === 'b') { i += 2; const v = s[i] === '1'; i += 2; return v; }
    if (t === 'i') { i += 2; const j = s.indexOf(';', i); const v = parseInt(s.slice(i, j), 10); i = j + 1; return v; }
    if (t === 'd') { i += 2; const j = s.indexOf(';', i); const v = parseFloat(s.slice(i, j)); i = j + 1; return v; }
    if (t === 's') {
      i += 2;
      const colon = s.indexOf(':', i);
      const len = parseInt(s.slice(i, colon), 10);
      i = colon + 1;
      expect('"');
      // `len` is a BYTE length; walk by bytes so multibyte content survives.
      let byteLen = 0, end = i;
      while (byteLen < len && end < s.length) {
        byteLen += Buffer.byteLength(s[end], 'utf8');
        end++;
      }
      const v = s.slice(i, end);
      i = end;
      expect('"'); expect(';');
      return v;
    }
    if (t === 'a') {
      i += 2;
      const colon = s.indexOf(':', i);
      const n = parseInt(s.slice(i, colon), 10);
      i = colon + 1;
      expect('{');
      const obj = {};
      let allInt = true;
      for (let k = 0; k < n; k++) {
        const key = value();
        if (typeof key !== 'number') allInt = false;
        obj[key] = value();
      }
      expect('}');
      // PHP list -> JS array
      if (allInt && Object.keys(obj).every((k, idx) => Number(k) === idx)) return Object.values(obj);
      return obj;
    }
    throw new Error(`php: unknown type '${t}' at ${i}`);
  }

  try { return value(); } catch { return null; }
}

export const json = (v, fallback = null) => { try { return JSON.parse(v); } catch { return fallback; } };
