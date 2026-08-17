// Print the Elementor DOM skeleton (tags + classes, text elided) from a saved
// reference page, so the renderer can match Elementor's real output exactly.
import fs from 'node:fs';

const html = fs.readFileSync(process.argv[2], 'utf8');
const marker = process.argv[5] || 'data-elementor-type="wp-page"';
let start = html.indexOf(marker);
start = html.lastIndexOf('<', start); // back up to the opening tag
const endMark = html.indexOf('</footer>') > 0 ? html.indexOf('</footer>') : html.length;
let body = html.slice(start, endMark);

// strip scripts/styles/svg innards
body = body.replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, '');

const want = process.argv[3] || '';
let depth = 0;
const out = [];
const re = /<(\/?)([a-z][a-z0-9]*)((?:\s+[^>]*?)?)(\/?)>|([^<]+)/gi;
let m;
while ((m = re.exec(body))) {
  if (m[5] !== undefined) {
    const t = m[5].trim();
    if (t) out.push('  '.repeat(depth) + '· ' + t.slice(0, 60).replace(/\s+/g, ' '));
    continue;
  }
  const [, close, tag, attrs, selfClose] = m;
  if (close) { depth = Math.max(0, depth - 1); continue; }
  const cls = (attrs.match(/class="([^"]*)"/) || [, ''])[1];
  const wt = (attrs.match(/data-widget_type="([^"]*)"/) || [, ''])[1];
  const el = (attrs.match(/data-id="([^"]*)"/) || [, ''])[1];
  const line = '  '.repeat(depth) + `<${tag}` + (cls ? ` .${cls.split(/\s+/).join('.')}` : '') + (wt ? `  [widget=${wt}]` : '') + (el ? ` #${el}` : '') + '>';
  out.push(line);
  if (!selfClose && !['img', 'br', 'input', 'hr', 'meta', 'link', 'source'].includes(tag.toLowerCase())) depth++;
}

const text = out.join('\n');
console.log(want ? text.split('\n').filter((l) => l.includes(want)).slice(0, 40).join('\n') : text.slice(0, Number(process.argv[4] || 6000)));
