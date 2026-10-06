# Plan: barra lateral personalizable + mockups v2

## Decisiones del usuario
- Barra: **favoritos arriba** (fijados y ordenados por el usuario) + resto en sus grupos plegables; cada usuario puede **ocultar** opciones, **reordenar**, y **expandir** la barra para ver títulos. Se edita desde **Configuración**. Preferencia por usuario.
- Mockups — colores: **favoritos y colores propios por usuario** (lo que agrega el usuario 1 no cambia al usuario 2).
- Mockups — **plantillas** y **carpeta de logos**: **compartidas** por la empresa (Recepción/Admin).
- **Banderas** de todos los países, con México, EUA y Canadá fijas arriba.
- Prendas nuevas: **hoodie** (con/sin bolsa canguro) y **camisa de vestir** manga larga y corta, lisa / rayas / cuadros; ajustables: colores del patrón, grosor y separación, dirección de rayas, color de botones. **Modelos 3D: los descarga el usuario** (CC0/CC-BY); hasta tenerlos se deja lista la infraestructura (registro de prendas, generador de patrones) sin exponer las prendas en la UI.

## Backend (NestJS + Prisma)
- `User.navPreferences Json?` → `{ favorites: string[]; order: Record<string, string[]>; hidden: string[]; expanded: boolean }` (ids = url del ítem). Vía `PATCH /users/me/preferences` (mismo patrón que `frequentProductIds`; `null` → orden por defecto).
- `User.mockupColors Json?` → `{ favorites: string[]; custom: string[] }` (hex `#rrggbb`, máx. 48 c/u). Mismo endpoint.
- Modelo `MockupTemplate { id, name, garment, config Json, thumbnailData (PNG base64 ≤ 300 KB), createdById?, createdAt, updatedAt }` y módulo `src/mockup-template`: `GET /mockup-templates` (sin config pesada ni miniatura grande? → lista con miniatura), `GET /:id`, `POST`, `PATCH /:id` (renombrar), `DELETE /:id`. Roles recepcion/admin/superuser.
- Modelo `MockupLogo { id, name, imageData (PNG base64 ≤1024 px, ≤ 2 MB), imageMime, createdById?, createdAt, useCount Int @default(0), lastUsedAt? }` y módulo `src/mockup-logo`: `GET /mockup-logos` (lista ligera, sin imagen), `GET /:id/image`, `POST`, `PATCH /:id` (renombrar), `POST /:id/use` (contador para "más usados"), `DELETE /:id`. Roles recepcion/admin/superuser.
- Migración, validación (PNG por firma, base64 estricto, tamaños), specs de servicio y de roles.

## Frontend (apps/web)
### Barra lateral (lane B)
- `lib/navPreferences.ts`: aplicar preferencias a los grupos visibles por rol (favoritos, orden por grupo, ocultos; ids desconocidos se ignoran; ítems nuevos aparecen al final de su grupo).
- `app-sidebar.tsx`: sección "Favoritos" arriba, grupos plegables, botón para expandir/contraer (títulos visibles) persistido en la preferencia; estrella para fijar/desfijar desde el menú contextual del ítem.
- `configuracion/page.tsx`: sección "Barra lateral" con lista arrastrable (dnd-kit ya instalado): fijar favorito, reordenar, ocultar, restablecer.
- Móvil (MobileTabBar/MobileMoreSheet): favoritos primero en la barra de pestañas.
### Mockups (lane C)
- Colores: en cada campo de color, "Mis colores" (favoritos con estrella + agregar color propio con nombre opcional) guardados en `mockupColors`.
- Plantillas: "Guardar como plantilla" (nombre) y panel "Plantillas" (miniaturas, aplicar, renombrar, borrar).
- Biblioteca de logos: panel con pestañas **Logos** (de la empresa, más usados primero, buscar, subir, renombrar, borrar) y **Banderas** (MX, US, CA fijas arriba, buscador por nombre en español, todos los países) — banderas de `flag-icons` (MIT, SVG locales, sin red). Al elegir uno se agrega como diseño.
### Prendas nuevas (lane D, en espera de modelos)
- Registro de prendas `lib/mockups/garments.ts` (id, label, modelo, opciones, presets, partes coloreables).
- Generador de textura de patrón (liso/rayas/cuadros, colores, grosor, separación, dirección) en canvas, unit-tested.
- UI de hoodie/camisa oculta tras bandera hasta que lleguen los GLB.

## Pruebas
Backend: specs de servicio/roles de templates y logos, preferencias nuevas. Frontend: navPreferences puro, sidebar con favoritos/ocultos/expandido, configuración (reordenar/restablecer), mis colores, plantillas, biblioteca (banderas fijas arriba, búsqueda), e2e de mockups extendido.

---

# Eng review (/plan-eng-review, 2026-10-05)

Target: this file, `docs/plans/sidebar-y-mockups-v2.md` (frontend `f89ef1d`, backend `d916d1a`, branch `claude/bold-rubin-gpwk07`). The plan text above is the original, unchanged. Everything below is review output.

Run mode: non-interactive (lead instruction). No human answered any question. Every decision below took the recommended option and is marked **auto-decided, pending user confirmation**. Product decisions in "Decisiones del usuario" were already approved by the user and are not re-opened.

Evidence note: implementation lanes were already writing code during the review (`apps/web/src/lib/navPreferences.ts`, `apps/web/src/lib/mockups/types.ts`, backend `src/mockup-template/*`, migration `20261005180000_mockup_library_nav_preferences`). Where a finding is visible in that in-progress code it is cited, labeled "(lane WIP)".

## Scope Challenge

What already exists and should be reused (no new code needed):
- `PATCH/GET /users/me/preferences` + `USER_PREFERENCES_SELECT` (backend `src/user/user.service.ts:27-41,203-232`) and `useUserPreferences` (frontend `hooks/useUserPreferences.ts`). New prefs ride this endpoint, as planned.
- Order mockup validation (base64 strict, magic bytes, 413 sizes, NUL rejection, summary select without heavy columns): `src/order-mockup/order-mockup.service.ts:160-450`. Lane already extracting it into `src/common/mockup-validation.ts` (lane WIP). Good.
- `importDesignFile` (`lib/mockups/importDesign.ts:97`) already rasterizes SVG/JPEG/WebP to PNG <= 1024 px. Flags and logo uploads must go through it.
- dnd-kit sortable with Pointer + Keyboard sensors: `components/orders/CustomizeFrequentsDialog.tsx:81-128`. Copy that pattern for Configuración.
- `useInView` (IntersectionObserver, local to `components/orders/detail/OrderMockupsSection.tsx:27-52`) for lazy image fetches.
- `Intl.DisplayNames(['es'], {type:'region'})`: standard library Spanish country names. Probed: covers 249/249 ISO codes in flag-icons 7.5.0 ("México", "Estados Unidos", "Canadá"). No name table needed. [Layer 1]
- `pickPrimaryTabUrls` already in lane WIP `lib/navPreferences.ts:224-238`.

Complexity: ~25 files touched across 2 repos, 2 new backend services (MockupTemplate, MockupLogo). Gate trips (8+ files, 2+ services).
- Feature cuts: none proposed. All features are user-approved product decisions; lane D is already scoped down to infrastructure only.
- Structure (D2): Original arrangement (separate `mockup-template` and `mockup-logo` modules sharing `src/common/mockup-validation.ts`) vs Smaller arrangement (one `mockup-library` module with two controllers). Auto-decided **Original arrangement**: mirrors `order-mockup`, lanes already built it that way, same file count either way. Pending remedies not decided here: R1-R16.
- Scope record: feature answers: none (no cuts proposed); structure: A Original arrangement (auto-decided D2); accepted scope: plan as written plus approved remedies; pending remedies: R1-R16 (auto-decided, pending user confirmation).

Scope Challenge result: **scope accepted as-is**.

Search: Aside not used; web search not needed. Facts were probed locally instead: flag-icons tarball (npm registry), Serwist schema in `node_modules`, Node ICU.

TODOS.md cross-reference: only open TODO is the Richardson 112 cap GLB. Not blocked by this plan. Lane D GLB downloads share its constraint (license + small, lazily loaded GLB).

## 1. Architecture review

- `[P2] (confidence: 9/10) plan:11 + lane WIP lib/navPreferences.ts:17,86` — `order: Record<string, string[]>` is keyed by `groupLabel`, a display string. `OPERATIONAL_MENU` uses "Producción/Comunicación/Soporte" and `buildMenuItems()` uses "Operación/Compras y clientes/Equipo/Administración" (`lib/navMenu.ts:77-117,126-255`); "Chat interno" lives in a different group in each. Renaming a group or a role change between operational and full menu silently drops the user's custom order. → R1.
- `[P2] (confidence: 8/10) components/app-sidebar.tsx:132-135, lib/navMenu.ts:313-322` — `findActiveNavUrl` picks the longest url prefix among the urls it is given. If it is fed the post-preference list, hiding "Rendimiento" (`/dashboard/admin/rendimiento`) makes that page highlight "Panel General" (`/dashboard/admin`). Same in `MobileTabBar.tsx:54-57`. → R2.
- `[P2] (confidence: 9/10) plan:12 vs plan:24` — contract `mockupColors.custom: string[]` cannot store the approved "color propio con nombre opcional". Lane WIP `lib/mockups/types.ts:109-112` already ships `custom: string[]`. → R3.
- `[P2] (confidence: 8/10) backend src/user/user.service.ts:217-223, src/user/dto/update-user-preferences.dto.ts:74-80, src/main.ts:114-121` — only `frequentProductIds` maps `null` to `Prisma.DbNull` (the code comment says Prisma rejects literal null in a Json column), so "Restablecer" (`navPreferences: null`) would 500 unless the new fields are mapped too. Nested Json with dynamic keys cannot be validated by class-validator decorators, and `@ValidateNested` + `forbidNonWhitelisted` would break on any future field (same reason `create-order-mockup.dto.ts:24-29` avoids it). Without a service-side validator a user can store up to the 10 MB body limit in their own row, returned on every preferences GET. → R4.
- `[P2] (confidence: 8/10) hooks/useUserPreferences.ts:71-81` — PATCH has no optimistic update and mutations run in parallel. Each PATCH sends the whole `navPreferences` object, so fast star toggles or drags can land out of order and `setQueryData` writes an older state last. The rail also waits a round trip per click. → R5.
- `[P2] (confidence: 8/10) plan:13, lane WIP src/mockup-template/mockup-template.service.ts:42-56,79-86` — template list embeds the thumbnail inline with a 300 KB cap: 40 templates can be about 16 MB of JSON per panel open. Lane already renders about 400 px JPEG (`lib/mockups/types.ts:95-99`, lane WIP), which is typically well under 100 KB. → R6.
- `[P1] (confidence: 8/10) plan:14 "lista ligera, sin imagen" + GET /:id/image (<= 2 MB)` — the Logos grid must show previews. The only preview source is the full image: 30 visible cards can be up to 60 MB. `<img src>` cannot send the Bearer token (`packages/api-client/src/api.ts:124-158` uses an Authorization header and parses JSON only), so native `loading="lazy"` is not available; previews must be fetched as JSON. → R7.
- `[P2] (confidence: 8/10) app/sw.ts (first runtimeCaching rule)` — every cross-origin GET (`!sameOrigin`) goes to NetworkFirst cache `emd-live-data` with no expiration. Template detail (<= 8 MB config) and logo image (<= 2 MB) responses would pile up in Cache Storage per device, forever. Already true for `/orders/:id/mockups/:id`. → R8.
- `[P2] (confidence: 9/10) apps/web/next.config.ts:98-102` — Serwist precaches all of `public/` by default (`globPublicPatterns` default `["**/*"]`, `@serwist/next/dist/chunks/schema-BHBmKqX3.js:12`). Putting 249 flag SVGs (1,637,495 bytes measured) in `public/flags` makes every device, including production roles on phones that never open Mockups, download them on SW install. Lane D GLBs would do the same; `models/tshirt.glb` (1.1 MB) already does. → R9.
- `[P2] (confidence: 9/10) plan:26 "flag-icons (MIT, SVG locales)"` — measured flag-icons 7.5.0: 271 4x3 SVGs (249 ISO + 22 non-ISO such as eu, un, gb-eng, es-ct, xx), 2.0 MB raw / 0.63 MB gzip. Largest: rs 182 KB, mx 85 KB, us 0.6 KB, ca 0.6 KB. Package `country.json` names are English only. Importing `flag-icons/css/flag-icons.min.css` would make the bundler emit all 542 SVGs. MIT requires keeping the copyright notice ("Copyright (c) 2013 Panayiotis Lipiridis"). Lane WIP added `flag-icons` to `dependencies` in `apps/web/package.json`. → R10.
- `[P2] (confidence: 9/10) backend src/order-mockup/dto/create-order-mockup.dto.ts:4 vs lane WIP src/mockup-template/dto/mockup-template.dto.ts:17` — two garment allow-lists. Frontend lane WIP widened `Garment` to include hoodie and dress-shirt (`lib/mockups/types.ts:15`). Once lane D enables a hoodie, "Adjuntar al pedido" returns 400 until the order-mockup list is widened too. → R11.
- `[P3] (confidence: 7/10) plan:6,13-14` — shared library: any recepcion/admin/superuser can rename or delete anyone's template or logo, with no undo. Approved product rule; the failure mode is an accidental delete of a client logo. → R12.
- `[P2] (confidence: 8/10) app/dashboard/layout.tsx:47, hooks/useUserPreferences.ts:64-69` — `expanded` lives server-side but the preferences query only starts after session + token and is not persisted, so every full page load paints the collapsed rail first and then expands (layout shift). The main padding is a fixed `md:pl-[5.75rem]`; an expanded rail would cover content unless the padding follows the state. → R13.

Failure scenarios checked per new path: see "Failure modes" below.

Dispositions: R1-R13 auto-decided (recommended option), pending user confirmation. See Decision ledger.

## 2. Code quality review

- `[P2] (confidence: 9/10) components/app-sidebar.tsx:125-131 and hooks/useVisibleNavItems.ts:418-438` — role filtering of the menu is done twice, and the plan adds preferences on top in 3 surfaces (rail, mobile bar, More sheet) plus the Ctrl+K palette, which must NOT apply `hidden`. `MobileMoreSheet.tsx:44-46` already recomputes tab selection itself even though `navMenu.ts:258-264` says both must share one source. → R14 (shared code, 2 verified existing callers: `AppSidebar`, `useVisibleNavItems`; proposed callers `MobileTabBar`, `MobileMoreSheet`).
- `[P3] (confidence: 8/10) components/orders/detail/OrderMockupsSection.tsx:27-52` — local `useInView`. The logo grid (R7) is the second caller. Extract to `hooks/useInView.ts`: about 25 lines moved, about 0 net, removes a future copy. → R15 (depends on R7).
- Lane D feature flag: no flag system exists in the app (searched `NEXT_PUBLIC_*FLAG/ENABLE/FEATURE`). Lane WIP uses an `ENABLED_GARMENTS` constant in `lib/mockups/garments.ts`: explicit and testable. Factual confirmation, no decision needed.
- Error handling gaps to cover in implementation (part of approved behavior, no separate decision): `POST /mockup-logos/:id/use` must be fire-and-forget with atomic `{ increment: 1 }`; a failed counter never blocks adding the design. Logo upload must check PNG IHDR width/height <= 1024 (bytes 16-23) since the plan promises "≤1024 px". Names: trim, 1-80 chars, reject NUL.

Dispositions: R14, R15 auto-decided, pending confirmation.

## 3. Test review

Framework: backend Jest (`*.spec.ts`), frontend Vitest (`*.test.ts(x)`) + Playwright (`e2e/`).

```
CODE PATHS                                                   USER FLOWS
[+] backend users/me/preferences                             [+] Sidebar personalization
  ├── [★★ TESTED] frequentProductIds null→DbNull              ├── [GAP] Pin from rail → Favoritos → reload persists [→E2E]
  │      user.preferences.spec.ts:92-98                       ├── [GAP] Hide item that is a url-prefix child (active highlight)
  ├── [GAP] navPreferences valid / null→DbNull / >8KB / bad    ├── [GAP] Expanded rail first paint, no flash, no overlap
  │         url / __proto__ / 51 ids                          ├── [GAP] Configuración keyboard reorder + Restablecer
  └── [GAP] mockupColors hex normalize / dedupe / cap 48 /    └── [GAP] Rapid star toggles settle to last click
            name <= 40 / null                                 [+] Mobile
[+] backend mockup-template (new)                               ├── [GAP] Favorites first in tab bar, More sheet agrees
  ├── [GAP] list excludes config; thumb cap 413; magic 400    └── [GAP] null prefs = current tabs (REGRESSION)
  ├── [GAP] config NUL 400; garment allow-list 400            [+] Mockups
  ├── [GAP] rename 404; delete 404                              ├── [GAP] Mis colores: add named, star, per-user isolation
  └── [GAP] roles: diseno/taller 403 (roles.spec)              ├── [GAP] Template save → apply → rename → delete [→E2E]
[+] backend mockup-logo (new)                                   ├── [GAP] Logo upload (SVG→PNG), search, pick, most-used
  ├── [GAP] list excludes imageData; thumbnail endpoint         ├── [GAP] Flags: MX/US/CA pinned, "mexico"/"cote" search
  ├── [GAP] IHDR > 1024 → 400; JPEG-as-PNG → 400              └── [GAP] Flag pick → PNG layer → attach to order [→E2E]
  ├── [GAP] use: atomic increment, 404 on missing
  └── [GAP] roles 403
[+] frontend lib/navPreferences.ts (lane WIP has tests)
  ├── [GAP] flat order across groups, role switch, new item at end
  ├── [GAP] unknown/forbidden ids ignored but preserved
  ├── [GAP] favorite/hidden conflict both directions
  └── [GAP] null prefs == default layout (REGRESSION)
[+] frontend useUserPreferences
  └── [GAP] optimistic update + rollback on error + serialized scope
[+] frontend lib/mockups (flags, colors, fabric pattern)
  ├── [GAP] flag list: 249 ISO only, es names, accent-insensitive search
  └── [GAP] fabric pattern generator (stripes/plaid widths, direction)

COVERAGE: 1/30 paths tested  |  QUALITY: ★★:1  |  GAPS: 29 (3 E2E)
Legend: ★★★ behavior + edge + error | ★★ happy path | ★ smoke  [→E2E] needs integration test
```

REGRESSION (iron rule, CRITICAL): every current user has `navPreferences = null`. With null prefs the rail, mobile tabs, More sheet, breadcrumbs and Ctrl+K must be identical to today. Existing tests that protect it and must stay green unchanged: `components/app-sidebar.test.tsx`, `components/MobileTabBar.test.tsx`, `components/MobileMoreSheet.test.tsx`, `lib/navMenu.test.ts`. Add one table row in `lib/navPreferences.test.ts` asserting `applyNavPreferences(groups, DEFAULT)` returns the input groups unchanged. → R16.

Tests to add (each passes the value bar; full value cards in the test plan artifact):
- backend `src/user/user.preferences.spec.ts` (extend): navPreferences and mockupColors rows listed above.
- backend `src/mockup-template/mockup-template.service.spec.ts`, `mockup-template.roles.spec.ts`; `src/mockup-logo/mockup-logo.service.spec.ts`, `mockup-logo.roles.spec.ts` (mirror `order-mockup.*.spec.ts`).
- backend `src/common/mockup-validation.spec.ts`: shared helpers moved out of order-mockup keep their existing order-mockup spec green (regression on moved code).
- frontend `lib/navPreferences.test.ts` (extend lane WIP), `components/app-sidebar.test.tsx` (favorites, hidden-prefix highlight, expanded), `MobileTabBar.test.tsx` + `MobileMoreSheet.test.tsx` (shared tab pick), `hooks/useUserPreferences.test.ts` (optimistic + rollback + scope), `lib/mockups/flags.test.ts`, `lib/mockups/myColors.test.ts`, `lib/mockups/fabricPattern.test.ts`, `components/mockups/MockupStudio.test.tsx` (templates/library panels), Playwright mockups e2e extended (flag pick → attach; template round trip).

Tests made obsolete: none.

Test plan artifact: `/root/.gstack/projects/eguiajosue-frontend-emd/root-claude-bold-rubin-gpwk07-eng-review-test-plan-20261005-223752.md`.

Dispositions: R16 auto-decided (regression contract), pending confirmation. Other tests are required proof for approved behavior.

## 4. Performance review

- Template list payload (R6): scale = templates × thumbnail bytes × 4/3. 300 KB cap → ~16 MB at 40 templates; 96 KB cap → <= 5 MB worst case, ~1.5 MB typical (400 px JPEG ~30 KB).
- Logo previews (R7): scale = visible cards × image bytes. Full image: up to 2 MB each. Thumbnail (<= 24 KB, 160 px PNG) fetched only for cards in view, cached by id with `staleTime: Infinity` (images are immutable; rename does not touch them).
- SW Cache Storage growth (R8): unbounded today, MB per opened template/logo.
- SW precache (R9): +1.64 MB / 249 requests per device for flags if not excluded.
- Flag grid: 249 `<img loading="lazy" src="/flags/4x3/xx.svg">` same-origin, no auth needed, no virtualization needed at this size. JS cost: a 249-entry code list (~1.5 KB) + `Intl.DisplayNames` at runtime. Load the library panel with `next/dynamic` so the studio's first load does not pay for it.
- DB: logos and templates are base64 TEXT rows (existing pattern). `findMany` lists must keep heavy columns out of `select` (lane WIP template service does). "Más usados" sorts by `useCount desc, lastUsedAt desc nulls last, id desc`; table sizes (hundreds) do not need an index.
- No N+1: `createdBy` comes via nested select in one query.

## Decision ledger

All rows: State = auto-decided (recommended option) in a non-interactive run; no human answer. User confirmation pending via the lead. Accepted scope applies only once confirmed.

### D1: Prerequisite /office-hours
Setup selector (not a remedy). Options: A) Run /office-hours, B) Skip. Auto-chose B: product decisions are already approved by the user and lanes are building.

### D2: Complexity structure
Options: A) Original arrangement (recommended): separate `src/mockup-template` and `src/mockup-logo` modules + shared `src/common/mockup-validation.ts`. B) Smaller arrangement: single `src/mockup-library` module with two controllers. Same features, contracts and pending remedies (R1-R16) in both. Auto-chose A.

### R1: Nav custom order model
Finding: P2, 9/10, plan:11 + lane WIP lib/navPreferences.ts:17,86, reviewer: eng-review.
Plan baseline: `order: Record<groupLabel, url[]>`.
Runtime evidence: group labels differ by menu (`lib/navMenu.ts:77-117` vs `126-255`).
| Choice | Current | A | B |
|---|---|---|---|
| R1 order storage | per-group, keyed by label | one flat `order: string[]` of urls; each group sorts its items by index in it; urls not in the list keep default order at the end of their group | keep per-group keyed by label |
Question D3: How should the custom order be stored? Recommendation: A because it survives group renames, role switches and items moving between groups at no extra cost. Completeness: A=10/10, B=6/10.
Options:
A) Flat url order (recommended): `order: string[]` (<= 50). Human ~1h / CC ~10 min. Low risk; simpler validator.
B) Keep groupLabel keys: no change. Silent order loss on renames/role change.
State: auto-decided A, pending user confirmation
Actual answer: none (non-interactive); auto-decision A
Accepted scope (on confirmation): change `NavPreferences.order` to `string[]` in frontend + backend validator; `reorderGroup` writes the group's urls into the flat list preserving other groups' relative order; tests for role switch and rename.
History: none.

### R2: Active highlight with hidden items
Finding: P2, 8/10, app-sidebar.tsx:132-135, navMenu.ts:313-322, MobileTabBar.tsx:54-57.
Plan baseline: not specified.
| Choice | Current | A | B |
|---|---|---|---|
| R2 active url source | visible list | compute from role-visible urls (before prefs); highlight only if that item is shown | compute from displayed list |
Question D4: Which list decides the active page? Recommendation: A because B highlights the wrong item when a url-prefix child is hidden. Completeness: A=10/10, B=5/10.
Options:
A) Role-visible list (recommended). Human ~20 min / CC ~5 min.
B) Displayed list. Wrong highlight on /dashboard/admin/rendimiento.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: rail + mobile bar compute `activeUrl` from role-visible urls; test hiding Rendimiento.
History: none.

### R3: Custom color names
Finding: P2, 9/10, plan:12 vs plan:24; lane WIP lib/mockups/types.ts:109-112.
Plan baseline: `{ favorites: string[]; custom: string[] }`.
| Choice | Current | A | B |
|---|---|---|---|
| R3 custom color shape | hex strings | `custom: { hex: string; name?: string }[]` (name <= 40, trimmed); `favorites: string[]` hex | drop the optional name |
Question D5: How to store the approved optional color name? Recommendation: A because the name is an approved product feature and B silently cuts it. Completeness: A=10/10, B=4/10.
Options:
A) Object entries (recommended). Human ~30 min / CC ~5 min.
B) Hex only, no names. Contradicts approved plan:24.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: update frontend type + backend validator (hex `^#[0-9a-f]{6}$` lowercased, dedupe by hex, <= 48 per list).
History: none.

### R4: Backend validation of Json prefs
Finding: P2, 8/10, user.service.ts:217-223, update-user-preferences.dto.ts:74-80, main.ts:114-121.
Plan baseline: "Mismo endpoint", validation unspecified.
| Choice | Current | A | B |
|---|---|---|---|
| R4 validation | unspecified | DTO `@IsOptional() @IsObject()` + service validator: favorites/hidden <= 50, order <= 50, url `^/dashboard(/[a-z0-9-]+)*$` <= 100 chars, expanded boolean, serialized <= 8 KB, own-keys only (no `__proto__`), no NUL; mockupColors per R3; `null` → `Prisma.DbNull` for every Json pref (loop, not per-field special case); add both to `USER_PREFERENCES_SELECT` | DTO `@IsObject()` only |
Question D6: How strictly to validate the new Json preferences? Recommendation: A because reset must not 500 and a row must not grow unbounded. Completeness: A=10/10, B=4/10.
Options:
A) Service validator + DbNull mapping (recommended). Human ~2h / CC ~15 min.
B) Shape-only. Reset 500s, junk stored.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: as in grid column A, with spec rows.
History: none.

### R5: Preference write races
Finding: P2, 8/10, hooks/useUserPreferences.ts:71-81.
| Choice | Current | A | B |
|---|---|---|---|
| R5 write strategy | parallel PATCH, no optimistic | optimistic `setQueryData` in `onMutate`, rollback in `onError`, `scope: { id: "userPreferences" }` to serialize | debounce 300 ms only |
Question D7: How should preference writes behave under fast clicks? Recommendation: A because it fixes ordering and makes the rail instant; B still lets responses arrive out of order. Completeness: A=10/10, B=6/10.
Options:
A) Optimistic + serialized (recommended). Human ~1h / CC ~10 min. Applies to all prefs (also fixes theme/frequents).
B) Debounce only.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: change `useUserPreferences`; test optimistic, rollback, ordering. Cross-tab last-writer-wins stays (documented).
History: none.

### R6: Template thumbnail size
Finding: P2, 8/10, plan:13, lane WIP mockup-template.service.ts:42-56.
| Choice | Current | A | B |
|---|---|---|---|
| R6 thumbnail cap / delivery | 300 KB, inline in list | 96 KB cap, inline in list (one request) | 300 KB inline |
Question D8: How big can a template thumbnail be? Recommendation: A because the client already renders ~400 px JPEG well under 96 KB and the list stays small with no extra requests. Completeness: A=9/10, B=6/10.
Options:
A) 96 KB inline (recommended). Human ~10 min / CC ~2 min (constant in backend dto + frontend types).
B) Keep 300 KB.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: `MAX_MOCKUP_TEMPLATE_THUMBNAIL_BYTES` and `MAX_TEMPLATE_THUMBNAIL_BYTES` = 96 KB; 413 test.
History: none.

### R7: Logo previews
Finding: P1, 8/10, plan:14; api-client/src/api.ts:124-158.
| Choice | Current | A | B | C |
|---|---|---|---|---|
| R7 preview source | full image per card | `thumbnailData` column (client makes <= 160 px PNG, <= 24 KB at upload) + `GET /mockup-logos/:id/thumbnail` (JSON `{dataUrl}`) fetched when the card is in view; full image only on pick | thumbnails inline in the list | full image per card |
Question D9: How does the Logos grid show previews? Recommendation: A because the logo library grows without bound (one per client) and A costs O(visible cards). Completeness: A=10/10, B=7/10, C=3/10.
Options:
A) Thumbnail column + lazy endpoint (recommended). Human ~3h / CC ~20 min. Migration adds one column (lane migration not yet merged, so amend it).
B) Inline thumbnails in list. Linear payload growth (~5 MB at 200 logos).
C) Full image per card. Up to 2 MB per card.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: column + endpoint + validation (PNG magic, <= 24 KB, <= 160 px IHDR) + react-query `staleTime: Infinity` per id + tests.
History: none.

### R8: Service-worker runtime cache growth
Finding: P2, 8/10, app/sw.ts first runtimeCaching rule.
| Choice | Current | A | B |
|---|---|---|---|
| R8 caching of heavy library GETs | NetworkFirst, no expiry | `NetworkOnly` for `/mockup-templates/:id`, `/mockup-logos/:id/(image|thumbnail)`, `/orders/:id/mockups/:id`; add `ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 7d })` to `emd-live-data` | leave as is |
Question D10: Should the SW keep caching multi-MB mockup payloads? Recommendation: A because those payloads are useless offline and grow Cache Storage without limit. Completeness: A=9/10, B=3/10.
Options:
A) NetworkOnly + expiration (recommended). Human ~30 min / CC ~5 min.
B) No change.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: `app/sw.ts` change; manual check in DevTools Application > Cache Storage.
History: none.

### R9: SW precache of public assets
Finding: P2, 9/10, next.config.ts:98-102; serwist schema default `["**/*"]`.
| Choice | Current | A | B |
|---|---|---|---|
| R9 precache scope | all of public/ | `globPublicPatterns` excludes `flags/**` and `models/**`; add CacheFirst runtime route for `/flags/` and `/models/` (ExpirationPlugin) | precache everything |
Question D11: Should every device precache flags and 3D models? Recommendation: A because only Recepción/admin use Mockups and lane D will add more GLBs. Completeness: A=9/10, B=4/10.
Options:
A) Exclude + runtime cache (recommended). Human ~30 min / CC ~5 min.
B) Precache all.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: next.config.ts + sw.ts; verify `public/sw.js` manifest has no `/flags/` entries after build.
History: none.

### R10: How flag assets enter the app
Finding: P2, 9/10, plan:26; measured flag-icons 7.5.0.
| Choice | Current | A | B |
|---|---|---|---|
| R10 asset delivery | `flag-icons` in dependencies, delivery unspecified | `scripts/sync-flags.mjs` copies the 249 ISO 4x3 SVGs + LICENSE into `public/flags/`, committed; generates `lib/mockups/flagCodes.ts`; `flag-icons` moves to devDependencies; never import its CSS | copy at build time (prebuild) |
Question D12: How do flag SVGs get into the app? Recommendation: A because committed files are explicit, auditable for license, and need no build hook in Vercel or turbopack dev. Completeness: A=9/10, B=8/10.
Options:
A) Vendored + sync script (recommended). Human ~1h / CC ~10 min. +1.6 MB in git.
B) Build-time copy. Smaller repo; another build step that can fail silently.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: script, `public/flags/4x3/*.svg`, `public/flags/LICENSE`, attribution note (like `public/models/README.md`), names via `Intl.DisplayNames('es')`, accent-insensitive search (NFD strip), MX/US/CA pinned, pick → fetch same-origin SVG → `importDesignFile` → PNG layer.
History: none.

### R11: Garment allow-list
Finding: P2, 9/10, create-order-mockup.dto.ts:4 vs lane WIP mockup-template.dto.ts:17.
| Choice | Current | A | B |
|---|---|---|---|
| R11 allow-list | two lists | one exported list in `src/common/mockup-validation.ts` with `ORDER_MOCKUP_GARMENTS` (enabled) and `ALL_GARMENTS`; lane D "enable" checklist widens the enabled list in backend and `ENABLED_GARMENTS` in frontend in the same release | keep two lists |
Question D13: How to keep backend garment lists in sync with lane D? Recommendation: A because otherwise enabling a hoodie breaks "Adjuntar al pedido" with a 400. Completeness: A=9/10, B=5/10.
Options:
A) One source + enable checklist (recommended). Human ~20 min / CC ~5 min.
B) Two lists.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: as grid column A.
History: none.

### R12: Deleting shared items
Finding: P3, 7/10, plan:6,13-14.
| Choice | Current | A | B |
|---|---|---|---|
| R12 delete safety | unspecified | confirm dialog naming the item and its author; hard delete | soft delete + restore |
Question D14: How safe is deleting a shared logo/template? Recommendation: A because it matches the approved shared model with the least machinery. Completeness: A=8/10, B=10/10.
Options:
A) Confirm dialog (recommended). Human ~20 min / CC ~5 min.
B) Soft delete. Extra column, filters, restore UI.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: confirm dialog in both panels; test cancel keeps item.
History: none.

### R13: Expanded rail first paint
Finding: P2, 8/10, layout.tsx:47, useUserPreferences.ts:64-69.
| Choice | Current | A | B |
|---|---|---|---|
| R13 first paint | server pref only | mirror `expanded` to localStorage (try/catch), read on mount, server value wins when it arrives; main padding follows a `data-rail` attribute | server only, accept flash |
Question D15: How to avoid the collapsed-then-expanded flash? Recommendation: A because the user sees a jump on every page load otherwise. Completeness: A=9/10, B=5/10.
Options:
A) localStorage mirror (recommended). Human ~45 min / CC ~10 min.
B) Server only.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: as grid; test reload keeps expanded and content offset.
History: none.

### R14: Single nav layout source (shared code)
Finding: P2, 9/10, app-sidebar.tsx:125-131, useVisibleNavItems.ts:418-438, MobileMoreSheet.tsx:44-46.
| Choice | Current | A | B |
|---|---|---|---|
| R14 structure | role filter in 2 places, tab pick in 2 places | one hook `useNavLayout()` → `{ roleVisibleGroups, favorites, groups, activeUrl, primaryTabUrls }`, used by rail, mobile bar, More sheet; Ctrl+K keeps role-visible list (ignores `hidden`) | apply prefs separately in each surface |
Rubric: callers verified (`AppSidebar` render, `useVisibleNavItems`); proposed callers `MobileTabBar`, `MobileMoreSheet`. Est. implementation lines removed ~25, added ~40, net +15; prevents 3-way drift of new merge rules. Blast radius: all nav surfaces; covered by existing 4 nav test files.
Question D16: Where are preferences applied? Recommendation: A because the plan adds merge rules to 3 surfaces that must agree. Completeness: A=9/10, B=6/10.
Options:
A) One hook (recommended). Human ~1.5h / CC ~15 min.
B) Per surface.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: as grid column A.
History: none.

### R15: Extract useInView
Finding: P3, 8/10, OrderMockupsSection.tsx:27-52. Depends on R7.
Question D17: Extract useInView? Options: A) Extract to `hooks/useInView.ts` when the logo grid lands (recommended; ~25 lines moved, 0 net). B) Copy it. Completeness: A=9/10, B=6/10.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: move hook, both callers import it; existing OrderMockupsSection tests stay green.
History: none.

### R16: Regression contract for null preferences
Finding: CRITICAL regression requirement (iron rule), 9/10.
Contract: with `navPreferences = null` the rail groups/order, mobile primary tabs, More sheet, breadcrumbs and Ctrl+K are identical to `f89ef1d`. Existing `app-sidebar.test.tsx`, `MobileTabBar.test.tsx`, `MobileMoreSheet.test.tsx`, `navMenu.test.ts` stay unchanged and green; add identity row in `navPreferences.test.ts`.
Question D18: Adopt the regression contract? Options: A) Adopt this contract (recommended). B) Allow default layout changes.
State: auto-decided A, pending user confirmation
Actual answer: auto-decision A
Accepted scope: as contract.
History: none.

Approval readiness: NOT PASSED. R1-R16 carry authorized auto-decisions from a non-interactive run but no user answer. They are listed as unresolved until the user confirms via the lead.

## NOT in scope
- Cross-tab live sync of preferences (two open tabs: last writer wins). Rare, harmless.
- Object storage (S3/R2) for logos/templates instead of base64 rows. Existing pattern; revisit if DB size grows (see TODO proposal).
- Per-user private logos/templates. User chose company-shared.
- Template references to library logos by id. Templates embed PNGs, so deleting a logo never breaks a template.
- Nav item ids independent of urls. Renamed routes already redirect; a renamed route just drops from favorites.

## What already exists
See Scope Challenge list. Reused, not rebuilt: preferences endpoint and hook, order-mockup validation (being extracted to `src/common/mockup-validation.ts`), `importDesignFile`, dnd-kit sortable pattern, `useInView` (R15), `Intl.DisplayNames`.

## Diagrams

Nav preference merge (R1, R2, R14):
```
session roles ──► menu (OPERATIONAL_MENU | buildMenuItems)
                     │ isNavItemVisible (role filter)
                     ▼
              roleVisibleGroups ─────────────► activeUrl = findActiveNavUrl(all role-visible urls)
                     │                        └► Ctrl+K palette (ignores hidden)
   navPreferences ──►│ normalize (unknown/forbidden ids dropped, kept in storage)
   (null → default)  ▼
   favorites (order of prefs.favorites, minus hidden) ──► "Favoritos" section / first mobile tabs
   groups: sort by flat prefs.order index, unknown items keep default order at end,
           remove favorites + hidden, drop empty groups ──► rail groups / More sheet
```

Preference write (R5):
```
click ──► onMutate: snapshot, setQueryData(optimistic) ──► rail re-renders now
            │ scope "userPreferences" (serial)
            ▼
         PATCH /users/me/preferences ──ok──► setQueryData(server)
                                     └err─► rollback snapshot + global toast
```

Logo library (R7, R8):
```
open panel ─► GET /mockup-logos (id,name,useCount,lastUsedAt,createdBy) ─► sort, search (client)
card in view ─► GET /mockup-logos/:id/thumbnail (JSON dataUrl, ≤24KB, staleTime ∞, SW NetworkOnly)
pick ─► GET /mockup-logos/:id/image (≤2MB PNG) ─► add PNG layer
     └► POST /mockup-logos/:id/use (fire-and-forget, atomic increment)
upload ─► importDesignFile (→PNG ≤1024) + 160px thumb ─► POST (magic bytes, IHDR, sizes)
```

Flags (R9, R10):
```
public/flags/4x3/<iso>.svg (vendored, not precached) ─► <img loading=lazy> grid
names: Intl.DisplayNames('es'); search: NFD strip accents; pinned: mx, us, ca
pick ─► fetch same-origin svg ─► File ─► importDesignFile ─► PNG layer (backend accepts PNG only)
```

## Failure modes
| Path | Realistic failure | Handling / test | User sees |
|---|---|---|---|
| Reset sidebar | `null` hits Prisma Json column | R4 DbNull mapping + spec | clear: menu resets (without R4: 500 toast) |
| Fast pin/unpin | out-of-order PATCH responses | R5 scope + test | correct final state |
| Role change | favorites point to forbidden pages | normalize filter + test | item silently absent (intended) |
| Hide everything | empty rail | Configuración link + Ctrl+K remain; test | recoverable |
| Template list | 300 KB × N thumbnails | R6 cap + 413 test | fast panel |
| Logo grid | 2 MB per card | R7 thumbnails | fast grid |
| Logo use counter | request fails offline | fire-and-forget + test | nothing, design still added |
| Flag pick | SVG layer rejected on attach | R10 rasterize + e2e | works |
| Enable hoodie | order attach 400 | R11 checklist | clear 400 message (without R11) |
| SW | Cache Storage fills device | R8 | none |
| Delete shared logo | accidental | R12 confirm + test | confirm dialog |

Critical gaps (no test AND no handling AND silent): 0 once R4-R11 are applied. Without R5, out-of-order writes are silent; it is covered by R5.

## Worktree parallelization strategy
| Step | Modules touched | Depends on |
|---|---|---|
| Backend prefs validator (R4, R1, R3 shapes) | backend `src/user/` | — |
| Backend template + logo modules (R6, R7, R11) | backend `src/mockup-template/`, `src/mockup-logo/`, `src/common/`, `prisma/` | — |
| Lane B sidebar (R1, R2, R5, R13, R14, R16) | frontend `lib/navPreferences`, `hooks/`, `components/` (nav), `app/dashboard/configuracion`, `app/dashboard/layout` | backend prefs contract (shape only) |
| Lane C mockups (R3, R6, R7, R10, R12, R15) | frontend `components/mockups/`, `lib/mockups/`, `hooks/`, `public/flags/`, `scripts/` | backend modules contract |
| SW/precache (R8, R9) | frontend `app/sw.ts`, `next.config.ts` | — |
| Lane D infra | frontend `lib/mockups/garments.ts`, fabric pattern | R11 |

Parallel lanes: B and C in parallel (both touch `hooks/useUserPreferences.ts`: R5 lands in B first, C rebases). Backend steps in parallel. SW step independent.
Conflict flags: `hooks/useUserPreferences.ts` (B, C), `lib/mockups/types.ts` (C, D), `prisma/schema.prisma` + the unmerged migration (template, logo, prefs): amend the single migration once, before merge.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific finding above. Effort assumes features ~30x, tests ~50x ratios.

- [ ] **T1 (P1, human: ~3h / CC: ~20min)** — backend mockup-logo + lane C — Logo thumbnails and lazy preview endpoint
  - Surfaced by: Architecture — R7, plan:14 full-image previews
  - Files: backend `prisma/schema.prisma`, migration `20261005180000_*`, `src/mockup-logo/*`; frontend `components/mockups/*Library*`, `hooks/useMockupLogos.ts`, `hooks/useInView.ts`
  - Verify: `npm test -- mockup-logo` (backend), `pnpm --filter web test`
- [ ] **T2 (P2, human: ~2h / CC: ~15min)** — backend user — Validate navPreferences/mockupColors, map null to DbNull, add to select
  - Surfaced by: R4, user.service.ts:217-223
  - Files: `src/user/dto/update-user-preferences.dto.ts`, `src/user/user.service.ts`, `src/user/user.preferences.spec.ts`
  - Verify: `npm test -- user.preferences`
- [ ] **T3 (P2, human: ~1h / CC: ~10min)** — nav prefs — Flat `order: string[]` model
  - Surfaced by: R1, navPreferences.ts:17,86
  - Files: frontend `lib/navPreferences.ts` + test, backend validator
  - Verify: `pnpm --filter web test navPreferences`
- [ ] **T4 (P2, human: ~1.5h / CC: ~15min)** — nav — `useNavLayout()` single source; active url from role-visible list; mobile bar + More sheet share tab pick; Ctrl+K ignores hidden
  - Surfaced by: R14, R2
  - Files: `hooks/useVisibleNavItems.ts`, `components/app-sidebar.tsx`, `components/MobileTabBar.tsx`, `components/MobileMoreSheet.tsx`
  - Verify: existing 4 nav test files green + new rows
- [ ] **T5 (P2, human: ~1h / CC: ~10min)** — prefs hook — Optimistic, rollback, serialized mutations
  - Surfaced by: R5, useUserPreferences.ts:71-81
  - Files: `hooks/useUserPreferences.ts` + test
  - Verify: `pnpm --filter web test useUserPreferences`
- [ ] **T6 (P2, human: ~45min / CC: ~10min)** — rail — localStorage mirror for `expanded`; main padding follows rail
  - Surfaced by: R13
  - Files: `components/app-sidebar.tsx`, `app/dashboard/layout.tsx`
  - Verify: reload with expanded rail, no flash, no overlap
- [ ] **T7 (P2, human: ~30min / CC: ~5min)** — mockup colors — `custom: {hex, name?}[]`
  - Surfaced by: R3
  - Files: `lib/mockups/types.ts`, color field UI, backend validator
  - Verify: unit tests for normalize/dedupe/cap
- [ ] **T8 (P2, human: ~10min / CC: ~2min)** — templates — thumbnail cap 96 KB both sides
  - Surfaced by: R6
  - Files: backend `src/mockup-template/dto/mockup-template.dto.ts`, frontend `lib/mockups/types.ts`
  - Verify: 413 spec
- [ ] **T9 (P2, human: ~1h / CC: ~10min)** — flags — vendor ISO SVGs + LICENSE via script; devDependency; Spanish names; accent-insensitive search; rasterize on pick
  - Surfaced by: R10
  - Files: `scripts/sync-flags.mjs`, `public/flags/`, `lib/mockups/flags.ts` + test, `apps/web/package.json`
  - Verify: `pnpm --filter web test flags`; e2e flag pick → attach
- [ ] **T10 (P2, human: ~1h / CC: ~10min)** — service worker — exclude flags/models from precache; NetworkOnly for heavy mockup GETs; expiration on emd-live-data
  - Surfaced by: R8, R9
  - Files: `apps/web/next.config.ts`, `apps/web/src/app/sw.ts`
  - Verify: `next build`, inspect `public/sw.js` manifest; DevTools Cache Storage
- [ ] **T11 (P2, human: ~20min / CC: ~5min)** — backend garments — one shared allow-list + enable checklist in lane D
  - Surfaced by: R11
  - Files: `src/common/mockup-validation.ts`, `src/order-mockup/dto/create-order-mockup.dto.ts`, `src/mockup-template/dto/mockup-template.dto.ts`
  - Verify: specs for each list
- [ ] **T12 (P2, human: ~2h / CC: ~20min)** — tests — regression identity row + backend template/logo specs and roles specs + e2e extensions
  - Surfaced by: R16, Test review gaps
  - Files: see Test review
  - Verify: `npm test` (backend), `pnpm --filter web test`, `pnpm --filter web test:e2e`
- [ ] **T13 (P3, human: ~20min / CC: ~5min)** — library panels — confirm dialog for delete
  - Surfaced by: R12
  - Files: templates and logos panels
  - Verify: component test cancel keeps item
- [ ] **T14 (P3, human: ~20min / CC: ~5min)** — shared hook — extract `useInView`
  - Surfaced by: R15
  - Files: `hooks/useInView.ts`, `components/orders/detail/OrderMockupsSection.tsx`
  - Verify: OrderMockupsSection tests green

## TODOS.md proposals (not persisted: this review may only write the plan file)
- **Move mockup library images out of Postgres if DB grows.** What: store logo/template images in object storage when the DB nears its plan limit. Why: base64 TEXT rows inflate storage ~33% and backups. Pros: smaller DB. Cons: new infra, signed URLs. Context: logos/templates/order mockups/order files all use base64 rows today. Depends on: DB size monitoring. Auto-decision: A) Add to TODOS.md (pending confirmation; not written).

## Unresolved decisions that may bite you later
- R1-R16: auto-decided (recommended option), no user answer yet. Lanes building now should confirm R1 (order model), R3 (color shape), R7 (logo thumbnail column, amends the unmerged migration) and R6 (thumbnail cap) first: they change API contracts.

## Completion summary
- Step 0: Scope Challenge — scope accepted as-is
- Architecture Review: 13 issues found
- Code Quality Review: 2 issues found
- Test Review: diagram produced, 29 gaps identified
- Performance Review: 0 new issues (performance items R6-R9 counted in Architecture)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item proposed (not persisted)
- Failure modes: 0 critical gaps flagged (with R4-R11 applied)
- Unresolved decisions: 16 in this review (auto-decided, pending confirmation)
- Outside voice: codex, unavailable (Codex CLI not installed; native subagent fallback not available in this host)
- Parallelization: 6 steps, 4 parallel lanes / sequential on `hooks/useUserPreferences.ts` and the migration
- Lake Score: 6/15 (R1, R2, R3, R4, R5, R7 picked a 10/10 option; 8 others picked the highest-scored 9/10 option; R12 picked 8/10 confirm dialog over 10/10 soft delete; R16 unscored)

## Suppressed findings (appendix, confidence <= 4)
- `[P3] (confidence: 4/10) plan:7` — Mexico regulates use of national symbols (Ley sobre el Escudo, la Bandera y el Himno Nacionales). Printing the Mexican flag/coat of arms on merchandise may have legal limits. Product/legal question, not engineering; not verified.
- `[P3] (confidence: 4/10) public/flags` — some flag SVGs (rs 182 KB, sh-ac 143 KB, bo 103 KB) are heavy; with lazy `<img>` only the viewed ones load. No action unless the grid feels slow.

## User confirmation (lead session, AskUserQuestion)
- R7 (logo thumbnails): **approved A** — 160 px PNG thumbnail (≤24 KB) stored separately; lazy `GET /mockup-logos/:id/thumbnail`.
- R3 (color names): **user chose B — plain hex only**, no names. `mockupColors = { favorites: string[]; custom: string[] }` stays as built.
- R1 (nav order): **approved A** — flat `order: string[]` of item URLs; new items appended at end of their group.
- R2, R4, R5, R6 (96 KB template thumbnail), R8–R16: **approved as recommended** ("Sí, aplicar todos").
Approval readiness: PASS (all R1–R16 answered by the user; R3 answered with option B).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | codex via `/plan-eng-review` | Independent 2nd opinion | 2 | unavailable | Codex CLI not installed; no native fallback in this host |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | ISSUES OPEN (PLAN) | 44 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review phase, unavailable (CLI not installed); no outside findings. Native subagent fallback not dispatched (no Agent/TaskOutput tools in this host). Missing coverage, not clean.
- **VERDICT:** no review CLEAR for this plan; eng review required (16 auto-decided remedies await user confirmation).

All 16 auto-decisions confirmed by the user (see User confirmation; R3 → option B).
NO UNRESOLVED DECISIONS
