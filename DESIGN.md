# EMD Bordados — Design System

Foundation for the "Noteflow"-inspired redesign: light, spacious SaaS dashboard
with EMD Publicidad's brand magenta as the signature accent, soft cards, pill
badges, and a collapsible icon-rail sidebar. Built on shadcn/ui + Tailwind
CSS variables (`src/app/globals.css`), so most primitives (`Card`, `Badge`,
`Button`, `Dialog`, `Table`, the `Sidebar` family) pick these tokens up
automatically.

## Palette

Light-first (default theme = light; dark mirrors the same language).

| token | light | dark | use |
|---|---|---|---|
| `--background` | `330 6% 95.5%` warm light gray canvas | `330 5% 6.5%` | page canvas |
| `--card` | white | `330 4% 10.5%` | every surface (cards, panels, rail, top bar pills) |
| `--ink` | `330 10% 9%` near-black | `330 6% 94%` near-white | **primary action** (`Button` default), active rail item, today markers |
| `--primary` | EMD magenta `330 81% 46%` | `330 72% 62%` | brand accent only: logo monogram, unread dots/badges, focus ring, `Button variant="brand"` (magenta gradient) |
| `--muted` | `330 6% 95.5%` | `330 4% 14.5%` | gray pills (dates, active segmented tab, chips) |
| `--border` | `330 6% 90%` (used at /60) | `330 4% 17%` | hairlines; cards barely bordered |

Semantic color lives ONLY in small tinted pills (`bg-X-500/10 text-X-700`,
dark `bg-X-400/15 text-X-300`): status (`packages/business/src/statusColors.ts`,
`StatusBadge` with icon + optional count), deadline tone (`TONE_META.pill`),
calendar categories, notification types. Never paint whole cards in saturated
color. Accent picker (`data-accent`) still remaps `--primary` only.

Radii: `rounded-2xl` (20px) cards, `rounded-full` buttons/pills/inputs-as-pills,
`rounded-xl` inner blocks. Buttons are pills by default.

## Typography

- **Display / titles**: **Space Grotesk** (`font-heading`, weight 600 for
  titles — 700 read heavy at app sizes). Loaded via `next/font/google` in
  `src/app/layout.tsx`. (Ezra Bold was requested originally but no verifiable
  font binary was obtainable; to swap it in later, switch the import to
  `next/font/local` keeping `variable: "--font-heading"`.)
- **Body/UI**: **DM Sans** (variable, `--font-body`, Tailwind `font-sans`).
  Replaced Poppins: Poppins is very wide and geometric, read poorly at 14px in
  dense screens, and next to Space Grotesk gave two near-identical geometric
  voices with no hierarchy contrast. DM Sans is compact with clean tabular
  figures.
- Numbers are tabular app-wide (`font-variant-numeric: tabular-nums` on
  `body`): dates, quantities and counts align across rows.

### Type roles (`src/app/globals.css`, `@layer components`)

Few, fixed roles — identical on every screen:

| role | class | spec |
|---|---|---|
| Page title | `text-page-title` | Space Grotesk 24→28px / 600 / tight |
| Section title | `text-section-title` (also `CardTitle`) | Space Grotesk 15px / 600 |
| Body | default `text-sm` | DM Sans 14px |
| Reading text | `text-[0.95rem] leading-relaxed max-w-prose` | descriptions, notes |
| Label | `text-label` | 12px / 500 / muted |
| Metadata | `text-meta` | 12px / muted |

No uppercase 10px "eyebrow" labels above headings; the heading carries its
own weight.

## Spacing

4px base scale. Tight inside a group (`gap-1`–`gap-3`), generous between
groups (`space-y-5`–`space-y-8`), more space above a section title than
below it. Separate sections with space and a hairline (`border-t pt-5`),
not with a card per section — never nest cards.

## Shell (desktop)

- `AppTopBar` (`components/AppTopBar.tsx`): brand pill (magenta gradient "E" +
  "EMD HUB"), center pill with the active nav group's pages (labels for what
  the rail only shows as icons), right cluster: search pill (⌘K), bell circle,
  account pill (avatar → menu: Configuración, Instalar app, Reportar un error,
  Cerrar sesión).
- `AppSidebar` (`components/app-sidebar.tsx`): floating icon rail of three
  white pills — theme (sun/moon radio), navigation (groups separated by
  hairlines, active = ink circle, tooltips with labels, unread/overdue
  badges), footer (Configuración, Cerrar sesión). No expanded state.
- Content: `md:pl-[5.75rem]`, max width 110rem.

## Mobile navigation

`src/components/MobileTabBar.tsx` renders a floating pill tab bar
(`md:hidden`, so it only exists below the sidebar's own mobile breakpoint):
`rounded-full bg-card shadow-soft-md`, centered, with side/bottom margin (not
edge-to-edge) and `padding-bottom: env(safe-area-inset-bottom)` on its outer
wrapper, matching this app's other mobile-safe-area handling
(`src/app/dashboard/layout.tsx`).

It shows the first 4 items — role-filtered, same source as the rail — from a
fixed URL priority order (`/dashboard/admin`, `/dashboard/orders`,
`/dashboard/chat`, `/dashboard/notificaciones`, `/dashboard/admin/rendimiento`,
`/dashboard/historial`, `/dashboard/clientes`, `/dashboard/usuarios`,
`/dashboard/ayuda`), skipping any URL the current role can't see. In practice
that resolves to Panel General/Pedidos/Chat/Notificaciones for admin and
superuser, Pedidos/Chat/Notificaciones/Historial for recepción, and Tareas
asignadas/Chat interno/Notificaciones/Ayuda for the operational roles. A 5th
"Más" tab is always appended and calls `setOpenMobile(true)` to open the
existing `AppSidebar` Sheet — it is not a second menu, just the door to the
one that already exists (full list, config, theme, logout, identity).

The active tab gets a soft `bg-primary/10` rounded-square highlight (`layoutId`
spring, `mobile-tabbar-highlight` — distinct from the rail's own
`sidebar-active-indicator` since both can be mounted at once) plus a small
`bg-primary` dot beneath the icon. Active detection is `pathname === item.url`
(exact match, so `/dashboard/admin` and `/dashboard/admin/rendimiento` never
collide).

The role-filtered flat list both surfaces read from is
`useVisibleNavItems()` (`src/hooks/useVisibleNavItems.ts`) — keep any future
nav item change in `src/lib/navMenu.ts` so the rail and the tab bar can't
drift apart.

Because the tab bar permanently occupies bottom screen space, the dashboard
layout's mobile-only bottom padding and the chat page's mobile card height
both carry a matching extra offset (`~5.5rem`, sized to the bar's own
height + margins) up to the same `md` breakpoint where the bar disappears —
see the inline comments in `src/app/dashboard/layout.tsx` and
`src/app/dashboard/chat/page.tsx` before changing either the bar's size or
these paddings.

## Motion

Framer Motion conventions already in `src/lib/motion.ts` /
`useMotionPreset()` continue to apply (route transitions, reduced-motion
awareness). Sidebar active-route indicator uses a spring
(`type: "spring", stiffness: 400, damping: 35`) `layoutId` for a fluid
Apple-style interruptible highlight; keep new interactive elements on the
same spring family rather than introducing new easing curves.

## Components

- **Everything is shadcn/ui** (`src/components/ui/`): Button, Input,
  Textarea, Select (no native `<select>`), Checkbox, Switch, Tabs,
  ToggleGroup (segmented controls and filter chips), DropdownMenu (any "⋯" or
  action menu), Popover (rich pickers only), Dialog/AlertDialog/Sheet,
  Collapsible, Accordion, Card, Badge, Table, Tooltip (`SimpleTooltip` on
  icon-only buttons), ScrollArea, Skeleton. Raw HTML controls only where a
  primitive can't express it (e.g. the full-card invisible hit area).
- Neutral hover for ghost/outline controls (`bg-muted`), not the cyan
  `accent`; tooltips are neutral (`bg-foreground`).
- Status/priority pills: `src/components/StatusBadge.tsx` and
  `src/lib/statusColors.ts` remain the single source of truth for status
  color mapping; only their visual treatment (pill shape, tint) follows the
  tokens above.
- Order cards / detail: `src/components/orders/OrderCard.tsx` and
  `OrderDetailDialog.tsx` keep all existing data/table functionality
  (sorting, filtering, bulk actions, virtualization, pagination) — this is a
  visual reskin onto the new tokens, not a Kanban rewrite.

## Known follow-ups (not completed in this pass)

Given the scope, this pass established the shared design-system foundation
(tokens, typography, sidebar rail) that cascades to every shadcn-based
surface automatically. Page-specific deeper reskins (chat bubbles/attachment
picker, admin/reportes charts, login hero, order-detail rich expansion,
avatar-stack primitive) were **not** hand-tuned individually in this session
and should be revisited page-by-page against this system.
