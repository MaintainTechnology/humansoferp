# humansoferp.com — Next.js

A WordPress → Next.js conversion of **Humans of ERP**, built from the WXR export
(`humansoferp.WordPress.2026-08-11.xml`). No WordPress, no PHP, no database at
runtime — every page is prerendered static HTML.

## Why this was tractable

The site is Elementor + JetEngine, which is already a structured, props-driven
component system:

| WordPress thing | What it became |
| --- | --- |
| `_elementor_data` (JSON layout tree) | React component tree (`src/lib/elementor/render.jsx`) |
| `[elementor-tag name="post-title"]` etc. | Dynamic-tag resolver (`src/lib/elementor/props.js`) |
| JetEngine Dynamic Visibility (`jedv_*`) | Conditional rendering |
| JetEngine listing grids + Slick carousel | `ListingGrid` + `Carousel.jsx` (no JS — the marquee is CSS) |
| JetEngine Custom Content Type (`story_gallery`) | `content/story-gallery.json` (recovered — see gaps) |
| Elementor Pro `loop-grid` + load-more | `LoopGrid.jsx` |
| Elementor Pro `taxonomy-filter` | `TaxonomyFilter.jsx` |
| Elementor Pro `off-canvas` / popup | `OffCanvas.jsx` + action handler in `Effects.jsx` |
| Elementor Pro `share-buttons` | `ShareButton.jsx` |
| Forminator forms | React forms + `/api/forms` (`Form.jsx`) |
| Elementor generated CSS | `public/styles/site.css` (taken verbatim) |
| Elementor Custom Code snippet | folded into the CSS bundle |
| jQuery + Slick + SmartMenus + Elementor JS | ~108 kB of app JS total |

## Layout

```
site.config.mjs       origin, XML path, per-site options (the pipeline is generic)
content/              extracted content model (JSON, the source of truth)
  site.json             design tokens, fonts, nav, taxonomy terms, permalinks
  pages.json            4 pages with their Elementor trees
  stories.json          63 stories with body, excerpt, thumbnail, categories
  components.json       3 JetEngine listings
  templates.json        header, footer, popup, single-post, archive, loop-item, sections
  story-gallery.json    13 CCT slides recovered from the live markup
  forms.json            2 forms with fields and conditional logic
  inline-css.json       CSS that only ever existed inline (loop-item styles)
public/
  assets/               downloaded media
  styles/site.css       the site's real stylesheets, concatenated
scripts/              the conversion pipeline + verification
src/
  app/                  routes
  components/           Carousel, OffCanvas, LoopGrid, TaxonomyFilter, ShareButton, Form, NavMenu, Effects
  lib/elementor/        the Elementor → React renderer
reference/            live-site HTML + screenshots, used for verification
```

## Pipeline

```bash
npm install
npm run extract                        # WXR -> content/*.json (offline, deterministic)
npm run assets                         # media + live stylesheets + reference HTML
node scripts/extract-cct.mjs           # recover the story_gallery CCT
node scripts/extract-inline-css.mjs    # CSS that is only ever inline
npm run images                         # responsive variants -> content/images.json
npm run css                            # -> public/styles/site.css
npm run build
```

`extract` is pure: re-running it on the same XML always produces the same JSON.
The other steps need the live site reachable.

## Verification

```bash
npm run check                      # 26 unit checks (parser, tags, visibility, content model)

npx next start -p 3200
LOCAL_ORIGIN=http://localhost:3200 npm run verify   # DOM/text parity vs reference/html (offline)
node scripts/behaviour-check.mjs   # the interactive pieces, in a real browser
npm run compare                    # full-page screenshot diff vs live (slow)
```

Current results:

```
structural:  9 routes | text recall 100.0% | missing element ids 0 | extra element ids 0
behaviour:   18 passed, 0 failed | 0 console errors
checks:      26 passed

rendered page height vs live:
  home        5294 / 5266   (+0.5%)
  stories     4684 / 4554   (+2.8%)
  a story     5799 / 5777   (+0.4%)
```

Widget counts, container counts, image counts and Elementor element IDs match
the live site exactly on every sampled route.

Two deliberate deltas show up in the structural diff and are correct: our
server-rendered HTML contains the marquee's duplicated slides and the
"Load More" button, both of which the live site injects with JavaScript after
load. Our SSR output matches the live *browser* DOM, not the live *server* HTML.

**Reading the screenshot diff.** Page heights match closely (home 5294 vs 5266 —
0.5%), but the pixel percentages stay high for one honest reason: the story
marquee never stops, so the two screenshots catch it at different frames. Slick
also reorders the strip with its clones, so even frozen at `translateX(0)` the
live site starts on a different card than we do. On a continuously scrolling
element that is a difference of phase, not of rendering. Pages without the
marquee land much lower (contact-us ≈ 6%).

## Animations and effects

Each was identified from the source rather than guessed, and is verified by
`scripts/behaviour-check.mjs`:

- **Story marquee** — the live site loads Slick, but the movement is a pure CSS
  animation (`#rtl_slide .slick-track { animation: rtlSlide 150s linear infinite }`,
  translating to `-50%`). So the React component just renders Slick's DOM with
  the slides duplicated once and lets the CSS run. **No JavaScript at all**, and
  the duplication makes the loop seamless — the live site's uneven Slick clone
  count makes it visibly jump once per cycle.
- **Side menu** — Elementor popup, opened via `#elementor-action:action=popup:open`
  URLs. One delegated handler in `Effects.jsx` parses those (including the
  base64 settings payload) and drives both popups and off-canvas panels.
- **Word-stagger reveal** — scoped to `[text-split]`, matching the original
  snippet.
- **Load more + infinite scroll** and **taxonomy filtering** — instant, because
  all 63 stories are prerendered into the page.
- **`prefers-reduced-motion`** is honoured throughout, including stopping the
  marquee. The original site ignores it.

## Three things that were only found by measuring

Each was invisible in the markup diff and only surfaced by comparing rendered
geometry against the live site:

1. **A stray `}` in Elementor's generated CSS.** `post-6.css` (the design-token
   kit) has an unclosed block, and two other files have extra closers. As
   separate `<link>`s each file is its own parse context so the damage is
   contained; concatenated, one bad brace silently kills every rule after it.
   `scripts/build-css.mjs` balances each stylesheet before joining, and warns.
2. **WordPress inlines Gutenberg block CSS**, as `wp-block-gallery-inline-css`
   and friends — there is no `block-library.css` to crawl. Skipping those (they
   start with `wp-`, which looked like boilerplate) left one story's gallery
   stacked full-width instead of in a grid, adding 2000 px to the page. That is
   59 kB of CSS that exists nowhere else.
3. **Elementor's responsive-visibility setting stores the class suffix, not a
   flag** — `hide_desktop: "hidden-desktop"`, not `"hidden"`. Reading it as a
   boolean meant a mobile-only image rendered on desktop too.

## Known gaps

- **JetEngine Custom Content Types are not in any WXR export.** The homepage
  slider is driven by the `story_gallery` CCT, whose records live in a dedicated
  database table. The 13 slides were recovered from the live site's rendered
  markup by `scripts/extract-cct.mjs`. **If those slides change, re-run that
  script** (or export the CCT properly from WordPress).
- **Three images 404 on the live site too** — all Elementor *editor* screenshots
  (`uploads/elementor/screenshots/...`), not site content.
- **Two published stories carry no category** (`jon-pepper…`, `jason-lante…`),
  so they never appear under any filter. That is true of the source data, not
  the conversion — worth fixing in the content.
- **Category archives (`/category/<term>/`) 404 on the live site**, so no such
  routes are generated here either. Filtering happens in place on `/stories`.
- An **off-canvas widget exists in the header but nothing opens it** — its only
  triggers are "close" actions pointing at a stale element id. Reproduced as-is
  rather than silently "fixed"; the working mobile menu is the popup.
- **Google Tag Manager (`GT-TNFZ3H7C`) was not carried over** — that is an
  analytics/consent decision, not a migration detail.
- **One story's image gallery still differs slightly.** WordPress crops gallery
  images to a uniform portrait aspect; ours keeps their natural aspect, so that
  page runs ~500 px longer. It affects the single story that uses a gallery
  block (`brandon-trabon…`); every other story matches within ~50 px.
- **Infinite scroll waits for a real scroll.** On a wide screen the first page
  of the archive fits above the fold, so an ungated observer pages straight
  through all 63 stories on load. It now arms on first scroll, with the
  "Load More" button as the other route.

## Configuration

Form submissions default to server-side logging so the site can deploy before a
mail provider is chosen:

```bash
FORM_WEBHOOK_URL=https://…   # Slack / Teams / Zapier / CRM endpoint
```

## Deploying

Static output plus one API route, so anything running Node works; Vercel is
zero-config. Before going live:

1. Point `metadataBase` in `src/app/layout.jsx` and `BASE` in
   `src/app/sitemap.js` at the production domain if it is not humansoferp.com.
2. Set `FORM_WEBHOOK_URL`.
3. Re-add analytics if you still want it.
