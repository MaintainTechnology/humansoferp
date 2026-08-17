// Single entry point for the extracted content model.
// Everything is plain JSON on disk, so this is all static-import cheap.

import site from '../../content/site.json';
import componentsJson from '../../content/components.json';
import templatesJson from '../../content/templates.json';
import pagesJson from '../../content/pages.json';
import storiesJson from '../../content/stories.json';
import formsJson from '../../content/forms.json';
import imagesJson from '../../content/images.json';
import galleryJson from '../../content/story-gallery.json';

export const components = componentsJson;
export const templates = templatesJson;
export const pages = pagesJson;
export const forms = formsJson;
/** Responsive variants recovered from the live markup; see scripts/build-image-manifest.mjs */
export const images = imagesJson;
export const tokens = site.tokens;
export const fonts = site.fonts;
export const siteMeta = site.site;
export const terms = site.terms;
export const nav = site.nav;

export const publishedPages = pages.filter((p) => p.status === 'publish');
export const pageBySlug = (slug) => pages.find((p) => p.slug === slug);

/** Templates by their Elementor role. */
const ofKind = (kind) => Object.values(templates).find((t) => t.kind === kind);
export const header = ofKind('header');
export const footer = ofKind('footer');
export const popup = ofKind('popup');
export const error404 = ofKind('error-404');
export const singlePost = ofKind('single-post');
export const archiveTemplate = ofKind('archive');
export const loopItem = ofKind('loop-item');
export const templateById = (id) => templates[String(id)] || null;

/**
 * Stories are the site's only content type. Already newest-first from the
 * extractor; WordPress orders archives the same way.
 */
export const stories = storiesJson
  .filter((s) => s.status === 'publish')
  .map((s) => ({
    ...s,
    url: `/stories/${s.slug}`,
    fields: {},
  }));

export const storyBySlug = (slug) => stories.find((s) => s.slug === slug);

export const storiesInTerm = (termSlug) =>
  stories.filter((s) => s.terms.some((t) => t.taxonomy === 'category' && t.slug === termSlug));

/**
 * The homepage slider is driven by a JetEngine Custom Content Type
 * (`story_gallery`), whose records live in their own database table and are
 * therefore absent from the WXR export entirely. These were recovered from the
 * live markup — see scripts/extract-cct.mjs.
 */
export const storyGallery = galleryJson.map((g) => ({
  id: g.id,
  terms: [],
  // Shaped for the `jet-cct-image` dynamic tag, which addresses fields by name.
  cct: { story_image: { url: g.src, alt: g.alt, width: g.width, height: g.height, srcset: g.srcset, sizes: g.sizes } },
}));

/**
 * Data behind each JetEngine listing grid, keyed by listing id.
 * "Card - Story Gallery" (602) renders CCT records; the other two render posts.
 */
const GALLERY_LISTING = '602';

export const listings = Object.fromEntries(
  Object.values(components)
    .filter((c) => c.entryType === 'listing')
    .map((c) => [c.id, c.id === GALLERY_LISTING ? storyGallery : stories])
);

export const rows = { stories, storyGallery };
