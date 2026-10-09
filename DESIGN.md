# CPAMC redesign — design direction

Subject: a control room for AI subscription capacity. The person using it runs several
Claude and Codex accounts through one proxy and needs to know, in under two seconds,
which accounts still have budget, when each one resets, and whether traffic is healthy.
Everything else (credentials, config, logs) is maintenance that should feel fast and
unambiguous.

Primary job: make remaining capacity and time-to-reset legible at a glance.
Audience: one or a few power users, on desktop most of the time, phone sometimes.

## What we are replacing

The stock UI is warm paper, a serif "Quiet for now" hero, identical rounded cards with
one grey shadow, system fonts, and scattered reveal animations. It reads as generated.
None of those choices come from the subject. We drop all of them.

## Tokens

### Color

Dark is the default (a control room is dark). Light is a first-class alternate.

| Role | Dark | Light |
| --- | --- | --- |
| Canvas | `#121A24` deep slate | `#F3F5F8` |
| Panel | `#18222E` | `#FFFFFF` |
| Panel raised / popover | `#1F2B39` | `#FFFFFF` + shadow |
| Hairline | `#2A3747` | `#DDE3EA` |
| Text | `#E8EEF4` | `#16202B` |
| Text muted | `#93A1B3` | `#5B6B7C` |
| Interactive (focus, links, primary action) | `#6FA2FF` | `#2F6FE4` |

Capacity scale: this is the one place color carries meaning, and it is a continuous
scale, not three badges.

- Plenty: `#5BD6A5` mint
- Watch: `#F0B94A` amber
- Depleted: `#F26B5E` coral

Rule: capacity colors appear only on meters, ribbons, and status dots. Chrome never
borrows them. Interactive blue never appears on a meter.

### Type

One family: IBM Plex Sans, loaded from Google Fonts with `font-display: swap` and a
system fallback so the single-file build still works offline. Weights 400, 500, 600.
Tabular numerals (`font-variant-numeric: tabular-nums`) on every number.

IBM Plex Mono only for strings that are literally code: auth filenames, keys, YAML,
log lines. Never for labels.

Scale (px / line-height): 12/16 caption, 13/18 dense table, 14/20 body, 16/24 lead,
20/28 section title, 28/32 page title, 44/48 hero number. Letter-spacing −0.01em
at 20 and above. Sentence case everywhere, no tracked caps labels.

### Shape and depth

Radii: 6 controls, 10 panels, 999 pills. Nothing larger.
Depth comes from surface steps, not shadows. Shadows only on popovers and sheets.
8 px baseline grid. Spacing scale 4 / 8 / 12 / 16 / 24 / 32 / 48.

### Motion

- Press: scale 0.98 over 120 ms, spring back.
- Expand/collapse: height animated with `motion` layout, 220 ms, `cubic-bezier(.2,.8,.2,1)`.
- Toasts: slide 12 px from bottom-right, 180 ms, with a thin progress line.
- Page change: content cross-fades 120 ms. No per-section reveals, no count-ups.
- Meters animate to their value once, on data arrival, 400 ms. Not on scroll.
- `prefers-reduced-motion`: all of the above become instant.

Focus: 2 px interactive-blue ring, 2 px offset, on every focusable element.

## Layout

```
┌───────────┬──────────────────────────────────────────────────────┐
│ CPAMC     │ ● Connected · v8.0.13 · 100.79.254.38     [⟳][☾][⇥] │  status strip 40px
│           ├──────────────────────────────────────────────────────┤
│ Overview  │ Capacity                                              │
│ Capacity  │ ┌─────────────────────────────────────────────────┐   │
│ Accounts  │ │ claude · tripp@…   Max   ▮▮▮▮▮▮▮▮▮▯▯  92%  2d 3h│   │  account ribbon
│ Sign in   │ │   5h ▮▮▮▮▮▮▮▯ 83% · 4h     7d ▮▮▯▯ 28% · 2d     │   │
│ Traffic   │ └─────────────────────────────────────────────────┘   │
│ Logs      │ ┌─────────────────────────────────────────────────┐   │
│ Settings  │ │ codex · …                                        │   │
│ Plugins   │ └─────────────────────────────────────────────────┘   │
│           │                                                      │
│ ▸ collapse│ Reset calendar  ───┬───┬───┬───┬───┬───┬───┬───      │  timeline
└───────────┴──────────────────────────────────────────────────────┘
```

- Left rail 232 px, collapses to a 64 px icon rail. Groups are separated by space,
  not headings. On mobile it becomes a bottom sheet.
- The status strip replaces the tall header: connection dot, version, host, and three
  icon actions. 40 px.
- Content is left-aligned, full width, max 1440 px, 24 px gutters. Numbers right-align.
- Tables are real tables with sticky headers and 13 px rows.

## The one memorable element

The account ribbon on the Capacity page. Each account is a single horizontal band:
identity on the left, the headline meter in the middle (the one limit that matters most
for that provider: Fable 7-day for Claude, weekly for Codex), time-to-reset on the
right. Secondary limits sit underneath as thin bars. Color on the meter follows the
capacity scale continuously. The reset calendar below shares the same horizontal time
axis so bars and reset ticks line up.

Everything around it stays quiet.

## Copy

Plain verbs, sentence case. "Refresh quotas", "Sign in to Claude", "Remove credential".
Empty states say what to do: "No accounts yet. Sign in to Claude or Codex to start."
Errors say what failed and the fix: "Couldn't reach the proxy at :8317. Check it is
running and the management key is correct."

## Self-check against generic defaults

- Not cream + serif + terracotta: slate dark default, Plex Sans, blue interactive.
- Not black + acid green: canvas is a visible slate blue, accent is indigo (#818cf8 dark, #5b5fe8 light), and
  green only exists as capacity meaning.
- Not the card kit: panels use surface steps, two radii total, shadows only on floating
  layers. Account rows are ribbons, not cards.
- No eyebrow labels, no middle-dot meta strings in UI chrome, no arrows in buttons,
  no mono for labels.

## Build order

1. Foundation: tokens in `src/styles/themes.scss` and `variables.scss`, font loading in
   `index.html`, reset. Keep existing CSS variable names where the rest of the app reads
   them, add new ones alongside, then migrate.
2. Shell: `MainLayout.tsx` + `layout.scss` → rail, status strip, mobile sheet.
3. Primitives in `components/ui`: Button, Input, Select, Card→Panel, Modal, Sheet,
   Table, Skeleton, EmptyState, Toast (NotificationContainer).
4. Capacity page (features/quota): ribbon, meters, calendar. Preserve the
   `QuotaClassMap` contract and Codex premium/elite plan classes.
5. Overview (dashboard), Accounts (auth files), Login.
6. Providers, Settings (config), Logs, Sign in (OAuth), System, Plugins.
7. Update tests that assert on markup/classes, `bun run verify`, screenshots at
   1440 and 390 wide in both themes.
