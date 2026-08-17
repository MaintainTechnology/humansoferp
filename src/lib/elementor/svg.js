// Elementor inlines uploaded SVGs into the markup (so CSS can size and recolour
// them). We do the same at build time by reading the file out of public/.
import fs from 'node:fs';
import path from 'node:path';
import { FA_SVGS } from './fa-icons.js';

const cache = new Map();

export function inlineSvg(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.endsWith('.svg')) return null;
  if (cache.has(url)) return cache.get(url);

  let svg = null;
  try {
    const file = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
    svg = fs.readFileSync(file, 'utf8')
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/<!DOCTYPE[^>]*>/g, '')
      .trim();
  } catch {
    svg = null; // missing asset: caller falls back to <img>
  }
  cache.set(url, svg);
  return svg;
}

/**
 * Normalise Elementor's several icon shapes into something renderable.
 * Returns { svg } for inline markup, { img } for a file we couldn't read,
 * or null when there is no icon.
 */
export function iconOf(icon) {
  if (!icon) return null;

  // { value: { url, id }, library: 'svg' }
  if (icon.value && typeof icon.value === 'object' && icon.value.url) {
    const svg = inlineSvg(icon.value.url);
    return svg ? { svg } : { img: icon.value.url };
  }
  // { value: '<svg .../>' }
  if (typeof icon.value === 'string' && icon.value.includes('<svg')) return { svg: icon.value };
  // { value: 'fas fa-check', library: 'fa-solid' } - no icon font is loaded, so
  // serve the same inline SVG the live site embeds; class name as last resort.
  if (typeof icon.value === 'string' && icon.value.trim()) {
    const svg = FA_SVGS[icon.value.trim()];
    return svg ? { svg } : { className: icon.value };
  }
  // bare url
  if (typeof icon === 'string') {
    const svg = inlineSvg(icon);
    return svg ? { svg } : { img: icon };
  }
  return null;
}
