import { publishedPages, stories } from '../lib/content.js';

const BASE = 'https://humansoferp.com';

export default function sitemap() {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    ...publishedPages
      .filter((p) => p.slug !== 'home')
      .map((p) => ({ url: `${BASE}/${p.slug}`, changeFrequency: 'monthly', priority: 0.8 })),
    ...stories.map((s) => ({
      url: `${BASE}${s.url}`,
      lastModified: s.date ? new Date(s.date.replace(' ', 'T') + 'Z') : undefined,
      changeFrequency: 'yearly',
      priority: 0.6,
    })),
  ];
}
