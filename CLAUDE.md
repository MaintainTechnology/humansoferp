# CLAUDE.md — humansoferp.com

Next.js 15 static conversion of the WordPress/Elementor site **Humans of ERP**
(humansoferp.com), built from the WXR export `humansoferp.WordPress.2026-08-11.xml`.
No WordPress, PHP, or database at runtime — every page prerenders to static HTML.

## Commands

```bash
npm run dev        # dev server (also: .claude/launch.json "humansoferp-dev", port 3000)
npm run build      # production build
npm run check      # 26 unit checks (parser, tags, visibility, content model)
npm run pipeline   # re-extract everything from the WXR: extract → assets → images → css
npm run verify     # DOM/text parity vs reference/html (needs `next start -p 3200` + LOCAL_ORIGIN)
npm run compare    # full-page screenshot diff vs live site (slow, needs Playwright)
```

## Architecture

- `content/` — the extracted content model (JSON). **Source of truth.**
  - `site.json` — design tokens (colors, typography), fonts, nav, taxonomy, permalinks
  - `pages.json` (4 pages), `stories.json` (63 stories), `templates.json` (header,
    footer, popup, master-cta-button, sections), `components.json`, `forms.json`,
    `story-gallery.json`, `inline-css.json`
- `src/lib/elementor/` — the Elementor-JSON → React renderer (`render.jsx`,
  dynamic-tag resolver in `props.js`)
- `src/components/` — interactive islands: Carousel, LoopGrid, TaxonomyFilter,
  OffCanvas, ShareButton, Form, NavMenu, Effects
- `src/app/` — routes: `/`, `/[slug]`, `/stories/[slug]`, `/api/forms`, robots, sitemap
- `public/styles/site.css` — the site's real stylesheets, concatenated verbatim
- `public/assets/` — all downloaded media (logos, fonts, story images)
- `reference/` — live-site HTML + screenshots used for verification

## Rules

- `content/*.json` and `public/styles/site.css` are **generated** by `npm run pipeline`
  from the WXR — don't hand-edit them; fix the pipeline scripts instead.
- Run `npm run check` after touching the renderer or content model.
- Visual parity with the live site is the bar: verify with `npm run verify` / `compare`.

## Design system (`design-system/`)

The complete brand kit lives in `design-system/` — see **`DESIGN.md`** (repo root)
for the full documentation. Quick map:

- `tokens.json` / `colors.css` / `typography.css` — generated from `content/site.json`
  by `node design-system/scripts/build-tokens.mjs`; regenerate rather than hand-edit
- `components.css` + `components` docs — button/card/form/chrome patterns from the live CSS
- `logos/`, `icons/`, `fonts/` — canonical SVG logos, UI icons, Albert Sans + Vela Sans TTFs
- `brand-kit.html` — open in a browser for the visual brand board

Brand shorthand: Albert Sans 700 headings (often uppercase), Vela Sans body,
ink `#101820`, dark-teal sections `#07272D`, teal CTAs `#257A88`, cream `#F5F5F1`.
The Maintain Technology orange is co-brand only (logo + footer submit).

When producing any visual/marketing asset, the `design-system` skill
(`.claude/skills/design-system/`) and the `brand-designer` agent
(`.claude/agents/brand-designer.md`) enforce these rules.
