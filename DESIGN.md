# EMD Bordados — Design System

Foundation for the "Noteflow"-inspired redesign: light, spacious SaaS dashboard
with EMD Publicidad's brand magenta as the signature accent, soft cards, pill
badges, and a collapsible icon-rail sidebar. Built on shadcn/ui + Tailwind
CSS variables (`src/app/globals.css`), so most primitives (`Card`, `Badge`,
`Button`, `Dialog`, `Table`, the `Sidebar` family) pick these tokens up
automatically.

## Palette

Brand accent is EMD's Instagram magenta (~`#E6007E`), stored as HSL `330 81%
46%` and used as `--primary` (buttons, active nav state, focus ring, links).
Light mode is an off-white surface (`330 20% 98%` background, pure-white
cards) with near-black text; dark mode inverts to a near-black surface with a
softened magenta (`330 70% 62%`) so it doesn't vibrate on dark backgrounds.

| token | light | dark |
|---|---|---|
| `--background` | `330 20% 98%` (off-white) | `330 22% 6%` (near-black) |
| `--card` | `0 0% 100%` | `330 20% 8.5%` |
| `--primary` (brand pink) | `330 81% 46%` ≈ `#E6007E` | `330 70% 62%` |
| `--border` | `330 20% 90%` | `330 15% 18%` |
| `--muted-foreground` | `330 8% 42%` | `330 10% 68%` |

Users may also override `--primary` via Configuración → Apariencia
(`data-accent="blue|green|orange|purple|teal"`) — this only remaps the accent,
never the base surface/text tokens, so brand pink stays the shipped default.

## Typography

- **Display** (H1/H2, dashboard greeting, login hero): `font-heading`, loaded
  via `next/font/google` in `src/app/layout.tsx`.
  - **Ezra Bold was requested but could not be obtained.** The listed
    third-party sources (freefontdl.com, fontspad.com, fontshut.com,
    exfont.com, freefonts.co) only exposed canvas-rendered previews or
    generator flows with no verifiable, downloadable font binary (valid
    sfnt/OTTO/WOFF signature) reachable headlessly. Per the brief's fallback
    instruction, we substituted **Space Grotesk** (weight 700), a bold
    geometric sans with a similar display character, self-hosted with no
    runtime request. **To swap in a licensed Ezra Bold file later:** drop it
    under `src/app/fonts/`, switch the import in `src/app/layout.tsx` from
    `next/font/google` (`Space_Grotesk`) to `next/font/local`, keep the same
    `variable: "--font-heading"` — no other file changes needed.
- **Body/UI**: **Poppins** (400/500/600/700) via `next/font/google`,
  `--font-body`, mapped to Tailwind's default `font-sans`.

## Shape & elevation

- `--radius: 0.875rem` (14px) — cards and dialogs render at `rounded-xl`
  (12–16px per the reference), small controls (badges, chips, avatars) use
  full pill radius via the `Badge`/`StatusBadge` components.
- Elevation is a solid card fill (`bg-card`) plus `shadow-soft` /
  `shadow-soft-md` (offset + blur, never a flat/hard shadow) in light mode;
  dark mode uses layered surface tone (`--elevation-1/2`) instead, since
  shadows barely read on dark backgrounds.
- One declared elevation per surface: border **or** shadow, not both stacked.

## Sidebar

`src/components/app-sidebar.tsx` now renders `<Sidebar collapsible="icon">`
from the shadcn `ui/sidebar` primitive. Default state is the icon-only rail
(`SidebarProvider defaultOpen={false}` in `src/app/dashboard/layout.tsx`);
clicking `SidebarTrigger` (top bar) expands it to the full labeled nav. The
expand/collapse choice persists automatically via the primitive's own cookie
(`sidebar:state`, 7-day max-age) so it's remembered per browser. All existing
nav groups, per-role visibility (`isOperationalOnly`, per-item `roles`
arrays), the chat unread badge, active-route indicator, greeting, avatar,
theme toggle and logout are unchanged in logic — only the collapsed-state
rendering (icon-only header/footer, tooltips via `title=`, hidden labels) is
new.

## Motion

Framer Motion conventions already in `src/lib/motion.ts` /
`useMotionPreset()` continue to apply (route transitions, reduced-motion
awareness). Sidebar active-route indicator uses a spring
(`type: "spring", stiffness: 400, damping: 35`) `layoutId` for a fluid
Apple-style interruptible highlight; keep new interactive elements on the
same spring family rather than introducing new easing curves.

## Components

- Buttons, inputs, dialogs, tables: shadcn/ui primitives in
  `src/components/ui/`, restyled only through the tokens above — no
  component API changes.
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
