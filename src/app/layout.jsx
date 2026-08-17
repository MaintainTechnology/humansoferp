import fs from 'node:fs';
import { ElementorDocument } from '../lib/elementor/render.jsx';
import { header, footer, popup, siteMeta, tokens } from '../lib/content.js';
import { renderCtx } from '../lib/render-ctx.jsx';
import Effects from '../components/Effects.jsx';

export const metadata = {
  metadataBase: new URL('https://humansoferp.com'),
  title: { default: siteMeta.title, template: `%s | ${siteMeta.title}` },
  description: siteMeta.description,
  icons: {
    icon: [
      { url: '/assets/2025/07/HoE-favicon.svg', sizes: '32x32' },
      { url: '/assets/2025/07/HoE-favicon.svg', sizes: '192x192' },
    ],
    apple: '/assets/2025/07/HoE-favicon.svg',
  },
};

// Body classes the stylesheets key off. `elementor-kit-<id>` carries every
// design token as a CSS custom property, so it is load-bearing, not cosmetic.
const BODY_CLASSES = [
  'wp-singular',
  'wp-custom-logo',
  'wp-embed-responsive',
  'wp-theme-hello-elementor',
  'wp-child-theme-mbs-theme-child',
  'hello-elementor-default',
  'elementor-default',
  'elementor-template-full-width',
  `elementor-kit-${tokens.kitId}`,
];

// The generated bundle's mtime is the cache key.
const CSS_VERSION = (() => {
  try {
    return Math.floor(fs.statSync('public/styles/site.css').mtimeMs).toString(36);
  } catch {
    return '0';
  }
})();

export default function RootLayout({ children }) {
  const ctx = renderCtx();

  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        {/* Scroll-reveal styles only engage under `html.js`, so content is
            never hidden for no-JS visitors. Runs before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {/* Served statically rather than bundled: this is Elementor's generated
            output, and a couple of its rules are browser-tolerated but not
            PostCSS-parseable. See scripts/build-css.mjs. */}
        <link rel="stylesheet" href={`/styles/site.css?v=${CSS_VERSION}`} />
      </head>
      <body className={BODY_CLASSES.join(' ')}>
        <a className="skip-link" href="#content">Skip to content</a>

        {header && (
          <ElementorDocument
            id={header.id}
            tree={header.tree}
            kind="header"
            className="elementor-location-header"
            ctx={ctx}
          />
        )}

        <main id="content">{children}</main>

        {footer && (
          <ElementorDocument
            id={footer.id}
            tree={footer.tree}
            kind="footer"
            className="elementor-location-footer"
            ctx={ctx}
          />
        )}

        {popup && (
          <ElementorDocument
            id={popup.id}
            tree={popup.tree}
            kind="popup"
            className="elementor-location-popup"
            ctx={ctx}
          />
        )}

        <Effects />
      </body>
    </html>
  );
}

