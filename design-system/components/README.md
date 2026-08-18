# Humans of ERP — Component Patterns

Every pattern here was extracted from the live site's CSS (`public/styles/site.css`
Elementor kit + "Master CTA Button" snippet, `content/inline-css.json`, and the
`.mt-form`/motion layer in `src/styles/app.css`). Nothing is invented.

The drop-in implementation is [`../components.css`](../components.css) (`.hoe-*`
classes; requires `colors.css` + `typography.css`). The visual reference is
[`../brand-kit.html`](../brand-kit.html). Brand rules live in the repo-root
`DESIGN.md`.

## Buttons

The live site's button system is a variant grammar
(`{primary|secondary|accent|dark|light} × {solid|outline|soft}` + size utilities)
defined by one WordPress CSS snippet. Only four combinations are actually used:

| Pattern | Class | Where on the site | Key facts |
|---|---|---|---|
| Primary CTA pill | `.hoe-btn` | "Read More Stories", "Submit Your Story" pill | Teal `#257A88`, white uppercase 600 text, 56px tall, radius 8px, 1px `#07272D` outline, shadow `0 1px 2px rgba(105,81,255,.05)`, hover → `#07272D` |
| Quiet pill | `.hoe-btn--quiet` | Header/side-menu "Contact Us" | The only sentence-case, weight-400 button; Vela Sans 1rem, 8px/20px padding; the only button with a `:focus` style |
| Co-brand submit | `.hoe-btn--mt` | Footer + contact form submit | MT orange `#FF5F00`, full pill (999px). **The site's only orange CTA.** Disabled: opacity .6 + `cursor: progress` |
| Ghost | `.hoe-btn--ghost` | File-upload control (dark surfaces) | White 10% fill, 22% border; orange border on hover, orange focus ring |

Soft arrow CTA (`.hoe-cta-link` + `--light`/`--dark`, `--md`, `--reverse`): bare
uppercase text + 24×24 stroked arrow (1.5px, round caps), no background, no padding.
Arrow sits **before** the text everywhere except the story-card "Read more", which
row-reverses it (`--reverse`). No hover color — feedback is the 3px arrow nudge.

Shared motion: press `scale(0.97)` (160ms `cubic-bezier(0.23,1,0.32,1)`), arrow
nudge `translateX(3px)` on hover (pointer devices only).

## Headings & labels

- **Two-tone headline** (`.hoe-two-tone`): ink heading, teal `#257A88` emphasis
  span. Live markup: `<h1>Real Stories … <span style="color:#257A88">the ERP
  Landscape Today</span></h1>`.
- **Eyebrow** (`.hoe-eyebrow`): Albert Sans 600 uppercase 0.875rem,
  letter-spacing 0.2em — small label above headings.

## Section bands

Pages alternate: cream `#F5F5F1` · aqua `#F1FCFC` (page heroes, popup panel) ·
dark teal `#07272D` · ink `#101820` · "Forge Blue" gradient
(`linear-gradient(116deg, #07252C → #0F1D20)`). Classes: `.hoe-section--cream/
--aqua/--dark/--ink/--gradient`. Section rhythm: heroes pad ~180px top (under the
absolute header); content sections ~80–130px vertical.

## Cards

| Pattern | Class | Where | Key facts |
|---|---|---|---|
| Story index card | `.hoe-card` | /stories grid | White, radius 10px, 1px `#EDEEF1` border, 16:9 image clipped on top, 30px padding rhythm, Albert Sans 600 uppercase title `#101820`, Vela Sans 1rem/1.7 excerpt `#5B616E`, trailing-arrow "Read more" |
| Card grid | `.hoe-card-grid` | /stories | 3 / 2 / 1 columns (breaks 1024/767), 30px gaps, equal-height rows |
| Photo card | `.hoe-photo-card` | Home marquee slides | Bare 4:5 portrait photo, radius 8px, nothing else |
| Featured card | `.hoe-featured-card` | Home featured story | Photo ≥515px, white Albert Sans 700 uppercase caption (−1.1px tracking) **directly on the photo — no scrim** |
| Related card | `.hoe-related-card` | Story page "keep reading" | Borderless: 588px cover photo, title + excerpt below, arrow link |

Hover: all cards lift `translateY(-4px)` over 250ms (pointer devices;
disabled under `prefers-reduced-motion`).

**Verified negatives** — things the brand deliberately does *not* do: no overlays/
scrims on photography; no taxonomy chips on cards (the Elementor filter widget is
`display:none` on the live site); no prev/next navigation on story pages (the
related grid is the only routing).

## Marquee (home "carousel")

Not a swiper: a pure-CSS marquee. Two copies of the slide set, track animates
`translateX(0 → −50%)` over **150s linear infinite**, gap 0, pauses on hover.
No arrows, no dots. Classes: `.hoe-marquee` > `.hoe-marquee__track` (+ `--ltr`).

## Forms (`.hoe-form` / `.hoe-field` — the `.mt-form` system)

Designed for dark/co-brand surfaces: 1rem grid gaps, translucent inputs (white 6%
fill, white 18% 1px border, radius 8px, `.75rem 1rem` padding), 0.875rem/500
labels, textarea min 8rem. Two-column rows via `.hoe-form__row--2` (≥768px).

- **Focus ring**: `outline: 2px solid #FF5F00; outline-offset: 2px` — the MT
  orange is the interaction color for the entire form system.
- **Feedback**: errors salmon `#FF8A5C`, success mint `#8EE6A8`.
- **Submit**: the orange pill (`.hoe-btn--mt`).
- Light-surface variant: wrap in `.hoe-form-panel` (cream-gold `#F9F4EA` card,
  radius 12px, 32px padding — the contact page treatment).

## Chrome

- **Header** (`.hoe-header`): transparent, absolute over light heroes, 20px
  padding, z-index 99999. Nav: Vela Sans 1rem `#040E10`, 42px gaps, no underline
  hover. Sticky after 100px scroll (`--sticky`): frosted white
  `rgba(255,255,255,.55)` + `backdrop-blur(10px)`, logo shrinks to 150px over .5s.
- **Menu popup** (`.hoe-popup-overlay`/`-panel`/`-close`): ink 55% blurred
  overlay; aqua `#F1FCFC` full-height panel slides from the right (400ms
  `cubic-bezier(0.32,0.72,0,1)`), 50px padding, 144px co-brand logo, 30px ink
  circle close button; ink links with teal hover.
- **Footer** (`.hoe-footer`): reads **light** — washed near-white photo
  (`footer-bg.jpg`) over an ink fallback, 3px gold `#E2D0A0` top border, 120px
  top padding. Ink text: uppercase Albert Sans 600 nav, Vela Sans 1.5rem/700
  subscribe headline, 1px `#244A55` bordered legal row. Co-brand logo row:
  HoE 184px / MT 260px.

## Radius & shadow ladder

8px (buttons, inputs, marquee/featured cards) → 10px (story cards) → 12px (form
panel) → 20px (story featured image) → 999px (orange submit). One shadow
site-wide: `0 1px 2px rgba(105,81,255,.05)`. Breakpoints: 1024px, 767px.
