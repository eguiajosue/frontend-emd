# EMD HUB — Design System ("Navy brand")

Source of truth for every screen. Tokens live in `apps/web/src/app/globals.css`,
mapped to Tailwind in `apps/web/tailwind.config.js`. Primitives are shadcn/ui in
`apps/web/src/components/ui`, shell in `components/app-sidebar.tsx`,
`AppTopBar.tsx`, `MobileTabBar.tsx`, page patterns in `components/layout`, motion in
`components/motion` + `src/lib/motion.ts`.

**Idea:** the EMD logo palette, with a clear job for each color.
Navy is the structure (sidebar, default buttons, titles, active states). Magenta
is the single brand accent (one star action, unread counts, "where am I" marker).
Cyan and lime are secondary: info, success, charts, small details. Never paint
whole cards in saturated color.

## 1. Palette

HSL triplets (use as `hsl(var(--x))` or the Tailwind class). Light / dark.

| role | token → Tailwind | light | dark | use |
|---|---|---|---|---|
| Canvas | `--background` → `bg-background` | `240 25% 97%` | `240 33% 7%` | page background |
| Surface | `--card` → `bg-card` | `0 0% 100%` | `240 27% 11%` | cards, panels, inputs |
| Sunken | `--surface-sunken` → `bg-sunken` | `240 22% 95%` | `240 30% 9%` | table header, wells |
| Text | `--foreground` → `text-foreground` | `240 31% 13%` | `240 14% 93%` | titles, body |
| Muted text | `--muted-foreground` | `240 8% 40%` (7.6:1 on canvas) | `240 12% 69%` | meta, labels |
| **Primary (navy)** | `--primary` → `bg-primary text-primary-foreground` | `240 31% 16%` (#1B1B3A family) | cyan `189 62% 70%` | default Button, links, active tab, selected |
| Accent hover | `--accent` | `240 25% 94%` | `240 22% 17%` | ghost/outline hover, row hover |
| Border | `--border` / `--input` | `240 16% 90%` / `240 12% 78%` | `240 20% 19%` / `240 18% 28%` | hairlines / control borders |
| Focus ring | `--ring` → `ring-ring` | magenta `330 76% 46%` | cyan `189 62% 70%` | `focus-visible` only |
| Destructive | `--destructive` | `0 72% 47%` | `0 68% 52%` | delete, errors |
| Sidebar | `--sidebar-*` → `bg-sidebar` | navy `240 31% 15%` | `240 36% 9.5%` | always navy, both themes |

Brand colors (each has `DEFAULT` raw logo color, `-strong`, `-ink`, `-soft`, `-foreground`):

| color | DEFAULT (raw logo) | `-strong` fill (white text) | `-ink` text on surface | `-soft` tint bg | job |
|---|---|---|---|---|---|
| **navy** `navy-50…950` | `navy` = #1B1B3A | – | – | `navy-50/100` | structure |
| **magenta** | `bg-magenta` `330 74% 57%` | `bg-magenta-strong` (5.4:1 w/ white) | `text-magenta-ink` (7:1) | `bg-magenta-soft` | brand accent, unread, star CTA |
| **cyan** | `bg-cyan` `189 62% 70%` | `cyan-strong` | `text-cyan-ink` | `bg-cyan-soft` | info, charts, details |
| **lime** | `bg-lime` `66 68% 58%` | `lime-strong` | `text-lime-ink` | `bg-lime-soft` | success, highlights, chart |

**Contrast rules (>= 4.5:1 text, >= 3:1 icons/borders):**
- Raw `magenta`, `cyan`, `lime` are for FILLS and decoration only. Text in those
  colors on a surface must use `*-ink`. Text on a raw cyan/lime fill is navy
  (`text-cyan-foreground`, `text-lime-foreground`), never white.
- White text on magenta is only allowed on `magenta-strong` or `bg-accent-gradient`.
- Semantic pills: `bg-success-soft text-success`, `bg-warning-soft text-warning`,
  `bg-info-soft text-info` (Badge variants `success|warning|info`). Dark values flip
  automatically.
- Status colors for orders stay in `packages/business/src/statusColors.ts` and
  `StatusBadge` (single source). Do not invent new status colors.

**Charts:** `--chart-1..5` = magenta, cyan, lime, navy, violet (brighter in dark).
Use `hsl(var(--chart-n))`. Never rely on color alone: add labels, patterns or icons.

**Gradients (CSS vars + utilities):** `bg-brand-gradient` (navy), `bg-accent-gradient`
(magenta), `bg-spectrum-gradient` (cyan→lime→magenta), `.brand-bar` (3px spectrum
line), `.surface-brand` (navy hero panel with cyan/magenta glows),
`.text-gradient-accent`. Use sparingly: one hero or one accent per screen.

**Accent picker (`data-accent`)**: only remaps `--primary`, `--primary-foreground`,
`--ring` (+ `--sidebar-ring`). Default id `pink` is now "Marino" (navy), plus a
`magenta` preset. Anything that must stay navy/brand regardless of the picker uses
`bg-navy`, `bg-sidebar`, or the brand colors, not `bg-primary`.

## 2. Typography

| role | font | why |
|---|---|---|
| Display / titles / KPI numbers | **Bricolage Grotesque** 600/700 (`font-heading`, `--font-heading`) | Grotesque with character; gives the brand a voice without being decorative; optical sizing stays crisp from 28px titles to 14px numbers. Replaced Space Grotesk (read generic next to the body). |
| Body / UI | **DM Sans** variable (`font-sans`, `--font-body`) | Compact, very legible at 14px in dense tables, clean tabular figures. Pairing = expressive display + neutral body. |

Numbers are tabular app-wide (`font-variant-numeric: tabular-nums` on `body`).
Body minimum 14px (inputs 16px on mobile to avoid iOS zoom), line-height >= 1.5 for
paragraphs. No uppercase micro-labels above headings.

| role | class | spec |
|---|---|---|
| Hero | `text-display` | heading 36→48px / 600 / 1.05 (login, portal hero only) |
| Page title | `text-page-title` | heading 24→28px / 600 (exactly one `<h1>` per page, via `PageHeader`) |
| Section title | `text-section-title` (= `CardTitle`) | heading 15px / 600 |
| KPI figure | `text-stat` | heading 30px / 600 / tabular |
| Large body | `text-body-lg` | 16px / relaxed |
| Body | default | DM Sans 14px |
| Label | `text-label` | 12px / 500 / muted |
| Meta | `text-meta` | 12px / muted |

## 3. Spacing, shape, elevation

- 4px base (Tailwind scale). Inside a group `gap-1…3`; between blocks `space-y-6`
  (24px, `PageContainer` does this); between page sections `space-y-8`. More space
  above a section title than below it. Separate with space + hairline, never nest cards.
- Page gutters: `px-4` (mobile) / `sm:px-6` / `md:px-8`, max width 110rem, set by
  `dashboard/layout.tsx`. Do not re-add page padding.
- Radius (`--radius: 0.875rem`): `rounded-sm 6` · `md 8` · `lg 10` · `xl 14`
  (buttons, inputs, menus) · `2xl 18` (cards, dialogs) · `rounded-full` only for
  badges/pills/avatars/dots. Buttons are NOT pills any more.
- Touch targets: >= 44px on coarse pointers (Button/Input already add
  `min-h-11` under `@media (pointer:coarse)`); keep >= 8px between targets. Use
  `.hit-44` on tiny icon buttons.
- Elevation (soft, layered, navy-tinted `--shadow-color`): `shadow-soft-xs` (cards at
  rest), `shadow-soft` (raised/hover), `shadow-soft-md` (menus, floating bars),
  `shadow-soft-lg` (dialogs, sheets), `shadow-glow-magenta` (brand CTA hover). In dark
  mode shadows barely show: depth = lighter surface (`elevation-1/2` classes,
  `Card elevation={2}`).

## 4. Motion

Expressive but fast. Everything <= 250ms except number counters (600ms).
Tokens in `src/lib/motion.ts` (JS) mirrored in `globals.css` (`--dur-*`, `--ease-out`)
and Tailwind (`duration-fast|base|slow`, `ease-out-expo`).

| token | value | use |
|---|---|---|
| `DUR.fast` / `duration-fast` | 150ms | hover, press, toggles, tab color, exit |
| `DUR.base` / `duration-base` | 200ms | menus, tooltips, panel open, sidebar width |
| `DUR.slow` / `duration-slow` | 250ms | page/card entrance, dialog, sheet |
| `EASE_OUT` / `ease-out-expo` | cubic-bezier(.16,1,.3,1) | all enters/moves |
| `SPRING_LAYOUT` | spring 420/36 | shared `layoutId` selection (sidebar, tab bar, section tabs) |
| `STAGGER_STEP` | 45ms | list/grid entrance (cap total ~400ms) |

Rules: enter = fade + 10px rise; exit faster than enter; press = `scale(.97)`;
animate only `transform`/`opacity` (never width/height of big layouts); one shared
`layoutId` per selection group (ids in use: `rail-active-indicator`,
`mobile-tabbar-highlight`, `section-nav-active`; pick a new unique id for your own).
**Reduced motion:** every primitive below checks `useReducedMotion()` and degrades to
a 150ms linear fade; `globals.css` also has a `prefers-reduced-motion` safety net that
zeroes CSS transitions/animations. Never write raw `animate-*` without
`motion-reduce:animate-none`.

Motion primitives (`@/components/motion`):

| component | use |
|---|---|
| `<PageTransition>` | route fade/slide; already wraps every dashboard page. Do not re-wrap. |
| `<FadeIn from="up\|down\|left\|right\|none" delay inView>` | single block entrance |
| `<Stagger step delay inView as>` + `<StaggerItem as>` | grids of KPI/cards/rows |
| `<HoverLift lift>` | clickable non-button cards (CSS alternative: class `interactive-lift`) |
| `<AnimatedNumber value format decimals prefix suffix>` | KPI counters (counts up on first view, then between values) |
| `<MovingItem id>` | list item that slides between columns (existing) |

## 5. Shell

- **Sidebar** (`AppSidebar`, desktop `md+`): full-height navy panel docked left,
  `4.5rem` collapsed (icons + tooltips) / `16rem` expanded (Ctrl+B). Header = logo
  (white) or the three logo squares; theme switch; nav groups (collapsible, favorites);
  footer (collapse, settings, logout). Active item = lighter navy pill that slides
  (`rail-active-indicator`) + magenta edge marker + cyan icon. Unread/overdue badges
  are magenta/rose. Exports `RAIL_OFFSET_COLLAPSED|EXPANDED`; content uses
  `md:pl-[var(--rail-offset)]` (set on `<main>` in `dashboard/layout.tsx`).
- **Top bar** (`AppTopBar`): sticky, translucent background, hairline when scrolled.
  Left: section tabs of the active nav group (sliding `section-nav-active` pill);
  right: search (⌘K), bell (magenta count), account menu. On mobile: logo, collapsing
  large title, search, bell.
- **Mobile tab bar** (`MobileTabBar`): floating navy bar, 4 role tabs + "Más" sheet,
  active tab expands with its short label (`mobile-tabbar-highlight`). Dashboard
  content keeps `pb-[calc(6.5rem+env(safe-area-inset-bottom))]` on mobile. The primary
  mobile action goes in `MobileFab` (magenta).
- Page frame is `PageTransition` > `max-w-[110rem]` container. Pages render only
  their own content.

## 6. Component recipes

**Button** (`ui/button.tsx`; `rounded-xl`, 150ms, press scale .97, ring on focus-visible,
sizes `sm 36 · default 40 · lg 48 · icon 40`):

| variant | when |
|---|---|
| `default` | primary action (navy; cyan in dark). Normally one per view region |
| `brand` | THE star action of a screen (magenta gradient, glow on hover): "Nuevo pedido", "Aprobar". At most one per screen |
| `soft` | secondary action tinted with primary |
| `outline` | neutral secondary, toolbars, cancel |
| `secondary` | quiet filled |
| `ghost` | icon buttons, menu-like actions |
| `destructive` | irreversible actions (inside a confirm) |
| `link` | inline text action; `bare` = clickable surface without button look |

Icon-only buttons need `aria-label` (or `SimpleTooltip`).

**Card** (`Card/CardHeader/CardTitle/CardContent`): white surface, 1px border, `shadow-soft-xs`,
`rounded-2xl`, `p-5`. `elevation={2}` only for floating things. Utility alternative for custom
markup: `surface-card`. For clickable cards add `interactive-lift` (or `<HoverLift>`) and a
focus ring (`focus-ring`).

**Badge** variants: `default` (navy) · `secondary` · `outline` · `muted` · `brand` (magenta
solid, counters) · `magenta|cyan|lime|success|warning|info` (tinted, safe contrast) ·
`destructive`. Order status always via `StatusBadge`.

**Input / Textarea / Select:** `h-10`, `rounded-xl`, border `--input`, hover border
`primary/40`, focus = border + 2px ring `ring/25`; set `aria-invalid` to get the red state.
Wrap with `FormField` (label + inline error). Visible labels, never placeholder-only.

**Tabs:** muted track, active trigger = white card + navy bold text + `shadow-soft`
(150ms), panel fades in. For page-level section switching prefer the top-bar section tabs.

**Table:** sunken header (`text-xs font-semibold`), 1px row dividers, row hover
`bg-accent/60`, selected `bg-primary/5`. Tabular numbers. Use `data-table` for feature
parity (sorting, virtualization, bulk actions).

**Dialog / Sheet / AlertDialog:** navy-tinted scrim (`navy-950/60`, no blur), `rounded-2xl`,
`shadow-soft-lg`, 200–250ms; mobile dialogs are full-screen sheets (existing). Titles use
`font-heading`. Footer: cancel = `outline`, confirm = `default` (or `destructive`).

**Skeleton:** shimmer with a cyan tint; match the final layout's size to avoid CLS.
**EmptyState** (`ui/empty-state.tsx`): dashed card, primary-tinted icon tile, spectrum tick,
title (heading) + one-line help + up to two actions. Always give the next action.

**Page pattern** (`components/layout`):
`PageContainer` (`space-y-6`; `width="narrow|prose"` for forms) → `PageHeader`
(title, description, optional icon, `actions`, children = tabs/filters) → `PageSection`
(`text-section-title` + actions) → `StatCard` (label, animated value, icon `tone`
navy|magenta|cyan|lime, delta, hint).

## 7. How to build a page (rules for page agents)

1. Start with `PageContainer` + `PageHeader`. One `<h1>`. Put the main action in
   `actions` (`variant="brand"` only if it is the screen's star action, else `default`).
   Don't add your own page padding, max-width, or route animation.
2. Layout in this order: KPI row (`Stagger` > `StatCard`) → filters/toolbar → main content
   (cards / `data-table`) → secondary panels. Group with `PageSection`; do not nest cards.
3. Use only tokens: `bg-background|card|sunken|primary|accent`, `text-foreground|muted-foreground`,
   `border-border`. Brand colors via `magenta|cyan|lime|navy` classes and their `-ink/-soft`
   variants. **Never** hardcode hex, `bg-white`, `text-gray-*`, `slate-*`, `black/NN`,
   or Tailwind default `pink-*|rose-*|emerald-*` for brand meaning. Verify the page in
   dark mode (`.dark` on `<html>`).
4. Text sizes only from the roles in section 2. Status via `StatusBadge`; areas via
   `AreaChip`/`area-*` classes.
5. Motion: wrap grids/lists in `Stagger`/`StaggerItem`, single blocks in `FadeIn`, KPI numbers
   in `AnimatedNumber`, clickable cards in `HoverLift`/`interactive-lift`. Durations from
   the table in section 4 only. Always keep it reduced-motion safe (use the primitives; for
   custom framer code use `useReducedMotion`).
6. Loading = `Skeleton` with the real layout; empty = `EmptyState`; errors = inline message +
   retry. Disable and spinner a submitting button (`Loader2 animate-spin`).
7. Responsive: mobile first, no horizontal page scroll, side gutter comes from layout,
   touch targets >= 44px, keep the bottom ~6.5rem free for the tab bar.
8. Accessibility: contrast rules in section 1, visible `focus-visible` rings (don't remove),
   `aria-label` on icon buttons, icons come with text or labels, never color-only meaning.
9. Keep existing behavior, props and `data-testid`/`data-tour` attributes; update tests only
   if markup you changed was asserted.

## 8. Known follow-ups

- Page-level reskins (dashboard, orders board, chat, calendar, admin charts, settings,
  TV mode, mockup studio) still contain pre-redesign classes such as `rounded-full` buttons
  and ad-hoc `emerald|amber|rose` pills; page agents should convert them as they go.
- Tabs have no shared-layout sliding indicator (CSS color/shadow transition only) because
  Radix does not expose the active trigger geometry; add one per page if needed with a
  unique `layoutId`.
- Mobile app (`apps/mobile`) was not touched in phase 1.
