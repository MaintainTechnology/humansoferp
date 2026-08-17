// For each widget type, print ONE real example of Elementor's DOM output,
// pulled from the saved reference HTML. This is the spec the renderer matches.
import fs from 'node:fs';
import path from 'node:path';

const dir = 'reference/html';
const seen = new Map();
const want = new Set((process.argv[2] || '').split(',').filter(Boolean));

for (const f of fs.readdirSync(dir)) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8').replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '');
  for (const m of html.matchAll(/<div class="[^"]*elementor-widget-([a-z0-9-]+)"[^>]*data-widget_type="([^"]+)"[^>]*>/g)) {
    const type = m[2].split('.')[0];
    if (seen.has(type)) continue;
    if (want.size && !want.has(type)) continue;
    // capture a bounded slice starting at the widget
    const slice = html.slice(m.index, m.index + 1400);
    seen.set(type, slice);
  }
}

for (const [type, slice] of seen) {
  console.log(`\n${'='.repeat(70)}\n### ${type}\n${'='.repeat(70)}`);
  console.log(
    slice
      .replace(/></g, '>\n<')
      .split('\n')
      .slice(0, 26)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
  );
}
console.log('\n\nWIDGET TYPES SEEN:', [...seen.keys()].join(', '));
