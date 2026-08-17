// Everything site-specific lives here so the pipeline scripts stay generic.
// (This is the second WordPress site through this toolchain; the first one had
// these values inlined, which is exactly why they are pulled out now.)

export const site = {
  name: 'Humans Of ERP',
  origin: 'https://humansoferp.com',
  xml: '../humansoferp.WordPress.2026-08-11.xml',

  // Where each post type lives once rendered. Derived from the <link> values in
  // the export — stories sit at the site root, not under /blog.
  permalinks: {
    page: (slug) => `/${slug}`,
    post: (slug) => `/${slug}`,
  },

  // Stylesheets belonging to plugins we replace outright.
  cssSkip: [/forminator/i, /wp-includes/i, /godaddy/i, /\/dist\/components\//i],

  // Vendor scripts replaced by src/components/Effects.jsx. Anything matching
  // these is dropped from HTML widgets rather than re-loaded.
  replacedVendorScripts: [/jquery/i, /\bgsap\b/i, /ScrollTrigger/i, /split-type/i, /SplitType/i, /slick/i],

  // JetEngine "Options Pages" live in wp_options and are absent from every WXR
  // export. Values recovered from the live site's rendered HTML — see
  // scripts/probe-options.mjs. Edit here if they change.
  options: {},
};

export default site;
