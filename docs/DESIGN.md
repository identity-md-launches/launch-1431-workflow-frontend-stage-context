# Hive Wars design

## Overview

Hive Wars is a dark war room for a 61-territory onchain strategy game. The main hierarchy is campaign status, the interactive Comb and selected-territory orders, then colony choice, personal troops, supply, settlement history and badges. A near-black olive surface, condensed headlines and amber action emphasis support the requested military strategy direction. It is deliberately dark-only; no unused light-theme toggle is presented.

This document is at `docs/DESIGN.md` because the overriding assignment write budget excludes repository-root `DESIGN.md`. All descriptions below refer to implemented source, not a future design proposal.

## Colors

Source: `web/src/style.css:5`; colony categories: `web/src/domain.ts:4`.

| Token | Implemented value | Role |
| --- | --- | --- |
| `--bg` / `--olive-950` | `#10120f` | Page and selected-territory panel |
| `--surface` / `--olive-900` | `#171b15` | Map, campaign status and cards |
| `--surface-raised` / `--olive-850` | `#1d221a` | Notices |
| `--surface-hover` / `--olive-800` | `#242b20` | Selected segments and hover surfaces |
| `--text` / `--paper-50` | `#f2f1e6` | Primary text |
| `--muted` / `--paper-300` | `#b6bcae` | Supporting text and labels |
| `--accent` / `--amber-500` | `#f5a524` | Primary action fill and campaign accent |
| `--on-accent` | `#17160c` | Text on primary action fill |
| `--border` | `#394032` | Structural separators |
| `--field-border` | `#6d765f` | Input and button boundaries |
| `--focus` | `#fff1b6` | Keyboard outline and focused map stroke |
| `--error` | `#ffabae` | Recoverable errors |
| `--success` | `#97d4ac` | Live/read-success and approval cues |

Colony identity uses the specified Amber `#F5A524`, Obsidian `#8B8BA7`, Jade `#2BB673` and Crimson `#E5484D`. Categories have visible names/initials and accessible names in addition to color. Hex fills mix their colony color at 13% with the solid surface; selected cells use amber at 18%. Contested cells add dashed borders and an exclamation mark, with optional pulse animation.

Measured browser-computed contrast examples: primary text/page 16.59:1, secondary text/page 9.68:1, secondary text/panel 8.96:1, primary-button text/fill 8.90:1. Representative map label/fill pairs were also measured above 4.5:1; exact pairs are in `frontend/accessibility-results.json`. These measurements do not certify every composited or animated state.

## Typography

Sources: `web/src/style.css:2` (font faces), `web/src/style.css:12` (families), `web/src/style.css:170` (annotation floor).

- Display: locally bundled Barlow Condensed, weights 600 and 700; fallback Arial Narrow, sans-serif. Hero is uppercase, weight 700, line-height .96, with amber on its second phrase. Its desktop size is `clamp(3.4rem, 6.5vw, 5.9rem)` and mobile size is `clamp(3.8rem, 15vw, 5.2rem)`.
- Body: Arial/Helvetica/sans-serif at 16px and 1.55 line-height. Most dense supporting UI text is 14px. Prose is generally limited to 50–55 characters per line in panels.
- Labels and numbers: local IBM Plex Mono 400, with monospace fallback. Time, points, balances and IDs use tabular figures. Small uppercase labels use controlled letter spacing. Most annotations have a 12px minimum; compact map annotations, the mobile shortened wallet address and the logo subtitle remain smaller. Complete territory names and controls are available outside the map through a native selector and detail panel.
- Section headings use `clamp(2rem, 3.4vw, 2.75rem)`; general panel headings use 1.75rem. The selected territory title uses 2rem. Headings balance wrapping; paragraphs use `text-wrap: pretty`; full addresses can wrap anywhere.
- Inputs remain at least 16px to avoid mobile Safari's small-input zoom. Only WOFF2 font files ship. Font load checks passed in Chromium.

## Layout

Source: `web/src/style.css`; composition: `web/src/App.tsx`, `Map.tsx`, `Sections.tsx`, `Swap.tsx`, `Observability.tsx`.

The page container is at most 1280px wide with 40px desktop gutters. Spacing mostly follows an 8px rhythm: 8/16px within groups, 24/28px panel padding, 24px between larger panels and 76px between sections. Mobile uses 16px gutters and 48px section spacing. Form controls stay inside gutters.

At 1120px, gutters become 24px and the map's detail column narrows to 300px. At 880px, navigation gets a second row, the map detail panel moves below the map into two columns, colonies use two columns and personal army panels stack. At 640px, hero, supply, logs and hall become single-column; the territory panel returns to normal document flow; the field manual becomes a numbered vertical list. The keeper action precedes the log visually on mobile. Colony cards remain a compact two-column comparison.

The map is an axial radius-4 board in a 720:620 area. Cell positions mirror the deployed implementation's ring order. Native hex buttons support pointer selection, a single Tab entry point, arrow-key movement and Home for the Core. The native territory selector provides a larger equivalent control, including on narrow screens. Map geometry is physical, so its coordinates do not mirror for writing direction.

Rendered checks cover 1440, 768, 390 and 320 CSS pixels without horizontal document overflow. Other widths, native 200% browser zoom, actual phones and RTL/localization were not comprehensively tested. The interface is English-only. Scrolling tables/logs preserve bounded panel height for long histories.

## Elevation & Depth

The system is flat. Tonal surfaces and 1px borders separate regions; no floating-card shadows, dialogs or overlays are needed. A small campaign accent rule identifies the status panel. Fine map grid lines and circular guides sit behind cells and ignore pointer input. Decorative map guides disappear on small screens.

## Shapes

Shared controls/cards use `--radius: 6px`; nested segments use 3px with a 4px inset. Map and campaign frames use nearly square 2–3px corners. Colony sigils and map tiles share a pointy-top hexagon. Ordinary focus uses a 2px outline with 5px offset; clipped map buttons instead use a 5px SVG stroke. Forced-colors mode supplies system colors for map boundaries and selection.

## Components

| Component/pattern | Source | Behavior |
| --- | --- | --- |
| `Action` | `web/src/ui.tsx` | Secondary/primary variants; requires verified current state and correct chain; per-action checking/wallet/receipt labels; shared signing lock |
| `TxFeedback` | `web/src/ui.tsx` | Persistent inline live region, translated errors, receipt link and recheck action |
| `WalletGate` | `web/src/ui.tsx` | Connect affordance, wrong-network explanation or read-verification status |
| `AddressLink` | `web/src/ui.tsx` | Checksummed address, explorer link, full-address title, copy button and feedback |
| `SectionTitle` | `web/src/ui.tsx` | Eyebrow + heading with optional trailing status/control; wraps on small screens |
| `Icon` | `web/src/ui.tsx` | Small local SVG set, `currentColor`, 1.6px stroke; decorative SVGs hidden from assistive technology |
| Hex board/detail panel | `web/src/Map.tsx` | Controller identity, pending contests, accessible selection, active/pending table and order form |
| Segmented controls | `style.css`, `Map.tsx`, `Swap.tsx` | Native buttons with `aria-pressed`, visible selected surface and focus styling |
| Fields and notices | `style.css` | Persistent labels, 46px minimum controls, inline validation and recoverable status text |
| Token amount formatting | `web/src/domain.ts` | Integer parsing without rounding, token-specific units and full precision where needed |

Empty states describe what belongs in the section and how to begin. Failed RPC reads preserve labeled last-known state and disable writes. Disabled transaction buttons use reduced opacity and surrounding prerequisite text; they never imply a completed approval. Skeleton/fake game values are not generated.

Motion is opt-in under `prefers-reduced-motion: no-preference`: button changes last 150ms, press scale is .96, contested pulses last 2 seconds, and pending spinners rotate. There is an explicit pause button for map pulses; reduced motion disables animation and smooth scrolling. No page-entry animation is used.

## Do's and Don'ts

- Reuse the container, `SectionTitle`, panel, field and transaction primitives for another view. Place product content first, transaction prerequisites beside its controls, and evidence links in supporting details.
- Use semantic surface/text tokens. Use colony colors for colony identity with a redundant text cue. Prefer one emphasized action within each task panel.
- Keep state facts tied to their returned block and disable writes when stale. Decode amounts with token decimals; never display an invented USD conversion.
- Keep a single deployment manifest at runtime. Add ABI interfaces centrally; obtain addresses from the attested handoff/network, never from component constants.
- Keep static paths relative and route with anchors or explicitly exported pages. Do not add backend-only routes to this static export.
- Preserve native controls, visible focus, reduced-motion support and readable small-screen forms. Do not use inaccessible color-only map states or make all 61 cells separate Tab stops.

The pinned Better Interface and documentation-method attributions and license copies are in `frontend/ATTRIBUTION.md` and the adjacent license files.
