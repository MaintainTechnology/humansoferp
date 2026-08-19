// Renders a form submission as the notification email. Lives outside the route
// because Next only permits its own exports from a route file, and the escaping
// below is the one part of the delivery path worth asserting on.

export const esc = (v) =>
  String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Every value here came off a public form, so nothing reaches the HTML part
// unescaped. The plain-text part is there so the mail reads anywhere.
export function compose(submission) {
  const rows = Object.entries(submission.fields);

  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    `Form: ${submission.form}`,
    `Received: ${submission.receivedAt}`,
  ].join('\n');

  const cells = rows
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:6px 16px 6px 0;vertical-align:top;color:#5b6670">${esc(label)}</td>` +
        `<td style="padding:6px 0;vertical-align:top;white-space:pre-wrap">${esc(value)}</td>` +
        `</tr>`
    )
    .join('');

  const html =
    `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#101820">` +
    `<h2 style="margin:0 0 16px;font-size:18px">${esc(submission.subject)}</h2>` +
    `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">${cells}</table>` +
    `<p style="margin:20px 0 0;font-size:12px;color:#5b6670">` +
    `${esc(submission.form)} &middot; ${esc(submission.receivedAt)} &middot; humansoferp.com` +
    `</p></div>`;

  return { text, html };
}
