# DESIGN.md — Humans of ERP Brand & Design System

**Humans of ERP** (humansoferp.com) — *Real Stories of Real People Shaping the ERP
Landscape Today.* A story-driven community site by **Maintain Technology** that
spotlights the people behind enterprise software.

This file is the rulebook. The assets live in [`design-system/`](design-system/);
the visual board is [`design-system/brand-kit.html`](design-system/brand-kit.html)
(open it in a browser). Everything was extracted from the live site — when in
doubt, the extracted token/CSS files win over memory or taste.

## Folder map

```
design-system/
├── tokens.json          # machine-readable: colors, type scale, fonts, nav  (GENERATED)
├── colors.css           # --hoe-* custom properties, 5 scales + semantic    (GENERATED)
├── typography.css       # @font-face + .hoe-* type classes                  (GENERATED)
├── components.css       # .hoe-* component patterns from the live CSS       (hand-maintained)
├── components/README.md # component docs: what, where, rules
├── brand-kit.html       # visual brand board (open in browser)
├── logos/               # 6 canonical SVGs (HoE + Maintain Technology)
├── icons/               # 11 UI icon SVGs (arrows, contact, menu)
├── fonts/               # Albert Sans + Vela Sans TTFs (400/600/700)
└── scripts/build-tokens.mjs   # regenerates the GENERATED files from content/site.json
```

Regenerate tokens after any `content/site.json` change:

```bash
node design-system/scripts/build-tokens.mjs
```

`components.css` is hand-maintained (distilled from `public/styles/site.css` and
`src/styles/app.css`) — update it when site components change.

## Voice

Human, story-first, confident, plain English. People over process. Headlines are
short and often uppercase; body copy is warm and concrete. No enterprise jargon.

## Logos (`design-system/logos/`)

| File | Use | Notes |
|---|---|---|
| `HoE-logo.svg` | Primary wordmark (header) | Two-tone: ink `#07272D` + teal `#257A88`, 118×53 |
| `HoE-x-MT-logo.svg` | Co-branded lockup | Menu panel (144px wide there) |
| `HoE-favicon.svg` | Favicon / tiny sizes | Teal glyph, 429×512 |
| `HoE-mobile-menu.svg` | Mobile menu glyph | Ink `#101820` |
| `MaintainTechLogo_Horizontal_Primary_Light.svg` | MT horizontal logo | Orange `#FF5F00`; footer at 260px |
| `MT-Group.svg` | MT Group mark | Co-brand contexts |

Rules: use the SVGs **as-is** — never recolor, stretch, redraw, or add effects.
Footer co-brand row: HoE at 184px next to MT at 260px.

## Color

Core palette (full 50–950 scales in `tokens.json` / `colors.css`):

| Role | Token | Hex |
|---|---|---|
| Ink (primary text, dark UI) | Primary 950 | `#101820` |
| Dark teal (dark sections, CTA hover) | Secondary 950 | `#07272D` |
| Teal (CTAs, links, emphasis) | Accent 600 | `#257A88` |
| Cream (light page background) | Background Light | `#F5F5F1` |
| Aqua (page heroes, menu panel) | Secondary 50 | `#F1FCFC` |
| Body text gray | System text | `#5B616E` |
| Card hairline border | Gray Neutral 100 | `#EDEEF1` |
| Gold (footer top border) | — | `#E2D0A0` |

Supporting: 5 full scales (primary, secondary, accent, gray-neutral, gray-cool)
plus warm grays, `Text Light #FAFAFA`, `Text Dark #040E10` (header nav links).
Form feedback on dark surfaces: error salmon `#FF8A5C`, success mint `#8EE6A8`.
Dark gradient band ("Forge Blue"): `linear-gradient(116deg, #07252C → #0F1D20)`.

### Maintain Technology orange — co-brand only

`#FF5F00` (hover `#CC4302`) belongs to Maintain Technology, not HoE. It appears
in exactly three places: the MT logos, the form submit pill, and form focus
rings/hover borders. **Never** use it for HoE headlines, links, icons, section
backgrounds, or general CTAs.

## Typography

- **Display/headings**: Albert Sans 700 (600 for H6, card titles, eyebrows) —
  usually UPPERCASE.
- **Body**: Vela Sans 400. Bold moments: Vela Sans 600/700.
- **Never Roboto** — it's a leftover Elementor default in the export; ignore it.
- TTFs in `design-system/fonts/` (both families: 400/600/700). Embed or
  `@font-face` them — no Google-font lookalikes.

Fluid scale (from the Elementor kit, all in `typography.css` as `.hoe-*`):
Title Hero clamp 42–56px/1.1 · H1 40–48px/1.3 · H2 32–48px/1.3 · H3 28–32px/1.3 ·
H4 24–28px/1.4 · H5 20–24px/1.4 · H6 18–20px/1.4 (600) · body 16px/1.7 ·
eyebrow 14px/600/ls 0.2em. Signature: **two-tone headlines** — ink heading with a
teal `#257A88` `<span>`.

## Components

Implementation: [`design-system/components.css`](design-system/components.css).
Full docs: [`design-system/components/README.md`](design-system/components/README.md).
Highlights:

- **Primary CTA** `.hoe-btn`: teal pill, white uppercase text, 56px, radius 8px,
  hover → dark teal, arrow icon, press `scale(.97)`.
- **Soft arrow CTA** `.hoe-cta-link`: bare uppercase text + 24×24 stroked arrow
  (1.5px round caps) — light on dark sections, dark on cards (arrow trails on cards).
- **Co-brand submit** `.hoe-btn--mt`: the only orange button — full pill, form
  submits only.
- **Story card** `.hoe-card`: white, radius 10px, `#EDEEF1` hairline, 30px rhythm,
  −4px hover lift; grid 3/2/1 at 1024/767.
- **Featured/photo cards**: captions sit directly on photography — **no scrims or
  overlays, ever**. Portrait photos are 4:5, radius 8px.
- **Forms** `.hoe-form`: translucent fields on dark surfaces, orange focus ring.
- **Chrome**: transparent header → frosted sticky; aqua slide-in menu panel;
  light photo-backed footer with gold top border.

## Motion

Fast, physical, restrained: 150–250ms for hovers (`cubic-bezier(0.23,1,0.32,1)`),
press `scale(0.97)`, cards lift −4px, CTA arrows nudge 3px, menu slides in at
400ms `cubic-bezier(0.32,0.72,0,1)`, the home marquee drifts at 150s/loop and
pauses on hover. Everything respects `prefers-reduced-motion`.

## Layout

Breakpoints 1024px / 767px. Content column ~1140px (story content 1036px).
Section rhythm: heroes pad ~180px top under the absolute header; sections 80–130px
vertical. Radius ladder scales with element size: 8 → 10 → 12 → 20px (→ 999px
pill). One shadow site-wide: `0 1px 2px rgba(105,81,255,.05)`.

## Producing visual assets

Any infographic, social card, banner, or marketing visual for this project:

1. The **`design-system` skill** (`.claude/skills/design-system/SKILL.md`) loads
   automatically for visual requests — it enforces the load order and brand rules.
2. The **`brand-designer` agent** (`.claude/agents/brand-designer.md`) produces
   the asset, working only from `design-system/`.
3. Start from `brand-kit.html` as the visual reference; deliver self-contained
   HTML/SVG with fonts embedded from `design-system/fonts/`.

### Do / Don't

- ✅ Two-tone uppercase Albert Sans headlines (ink + teal span)
- ✅ Cream ↔ dark-teal alternating sections; aqua heroes
- ✅ Arrow-prefixed uppercase CTAs; generous whitespace; 4:5 portrait photography
- ❌ Orange for anything except MT co-brand logo/submit/focus
- ❌ Scrims, gradients, or overlays on photos
- ❌ Roboto, Google-font substitutes, recolored logos, invented colors or radii
