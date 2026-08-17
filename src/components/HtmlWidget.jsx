import Form from './Form.jsx';
import ExternalScripts from './ExternalScripts.jsx';
import { forms } from '../lib/content.js';

// Vendor libraries the original site pulled from CDNs purely to drive effects
// that Effects.jsx now implements natively. Re-loading them would undo the win.
const REPLACED = [/jquery/i, /\bgsap\b/i, /ScrollTrigger/i, /split-type/i, /SplitType/i];

const SHORTCODE = /\[forminator_form[^\]]*id=["']?(\d+)["']?[^\]]*\]/gi;

export default function HtmlWidget({ html: source }) {
  const raw = String(source || '');
  if (!raw.trim()) return null;

  // 1. External scripts worth keeping (e.g. the Zoho Recruit jobs board).
  const keepScripts = [];
  for (const m of raw.matchAll(/<script[^>]*\ssrc=["']([^"']+)["'][^>]*><\/script>/gi)) {
    if (!REPLACED.some((re) => re.test(m[1]))) keepScripts.push(m[1]);
  }

  // 2. Inline scripts that initialise those embeds. The Zoho board is inert
  //    without its `rec_embed_js.load({...})` call, so dropping every inline
  //    script would silently break the careers page. Anything that merely
  //    drives the vendor libraries we replaced is discarded.
  const keepInline = [];
  if (keepScripts.length) {
    for (const m of raw.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      const code = m[1];
      if (!code.trim()) continue;
      if (REPLACED.some((re) => re.test(code))) continue;
      keepInline.push(code);
    }
  }

  // 3. Strip every script tag from the markup itself; the kept ones are run by
  //    ExternalScripts in the right order. <style> and <iframe> stay.
  let markup = raw.replace(/<script[\s\S]*?<\/script>/gi, '');

  // 3. Split on form shortcodes so each becomes a real React form.
  const parts = [];
  let last = 0;
  SHORTCODE.lastIndex = 0;
  for (const m of markup.matchAll(SHORTCODE)) {
    if (m.index > last) parts.push({ html: markup.slice(last, m.index) });
    parts.push({ formId: m[1] });
    last = m.index + m[0].length;
  }
  if (last < markup.length) parts.push({ html: markup.slice(last) });

  const nodes = parts
    .map((part, i) => {
      if (part.formId) {
        const form = forms.find((f) => String(f.id) === part.formId);
        return form ? <Form key={`f${i}`} form={form} /> : null;
      }
      return part.html.trim() ? (
        <div key={`h${i}`} dangerouslySetInnerHTML={{ __html: part.html }} />
      ) : null;
    })
    .filter(Boolean);

  if (!nodes.length && !keepScripts.length) return null;

  return (
    <>
      {nodes}
      {keepScripts.length > 0 && <ExternalScripts srcs={keepScripts} inline={keepInline} />}
    </>
  );
}
