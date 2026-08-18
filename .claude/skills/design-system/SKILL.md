---
name: design-system
description: Use when creating ANY visual output for Humans of ERP — UI components, pages, infographics, marketing visuals, social cards, product assets, presentations, or images. Loads the brand's real tokens, logos, fonts, and component styles so output is on-brand. Trigger on "infographic", "marketing visual", "social card", "banner", "brand asset", "new page", "new component", or any design/visual request.
---

# Humans of ERP — Design System Skill

All brand truth lives in `design-system/` at the repo root. Never invent colors,
fonts, or logo variants — read them from there.

## Load order

1. `design-system/tokens.json` — colors (5 scales + semantic), type scale, fonts, nav.
2. `design-system/colors.css` + `design-system/typography.css` — drop-in CSS custom
   properties (`--hoe-*`) and type classes (`.hoe-*`).
3. `design-system/components.css` — button, card, form, and chrome patterns from the live site.
4. `design-system/DESIGN.md` (repo root `DESIGN.md`) — usage rules, logo guidelines, voice.

## Non-negotiable brand rules

- **Headings / display**: Albert Sans, weight 700 (600 for H6/eyebrows). Often UPPERCASE.
- **Body text**: Vela Sans 400. Never Roboto (a leftover Elementor default — ignore it).
- **Core palette**: Primary 950 `#101820` (ink/navy), Secondary 950 `#07272D` (dark teal
  sections), Accent 600 `#257A88` (CTAs/links), Background Light `#F5F5F1` (cream),
  Text `#5B616E`. Full 50–950 scales in tokens.json.
- **Maintain Technology orange** appears ONLY in the MT logo and the footer Submit
  button — it is a co-brand accent, not a HoE brand color. Check
  `design-system/components.css` for its exact value before using it.
- **Logos**: use the SVGs in `design-system/logos/` as-is. `HoE-logo.svg` is the primary
  wordmark; `HoE-x-MT-logo.svg` is the co-branded lockup; `HoE-favicon.svg` for tiny sizes.
  Never recolor, stretch, or redraw them.
- Fonts ship in `design-system/fonts/` (TTF). Embed or `@font-face` them — do not
  substitute Google-font lookalikes.

## For marketing/social assets

Start from `design-system/brand-kit.html` for a visual reference of every approved
color, type style, button, and logo treatment. Match the site's voice: human,
story-first, confident, plain English.
