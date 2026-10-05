# Plan: Creador de mockups 3D (Recepción)

## Objetivo
Que Recepción arme en segundos un mockup de una playera básica (Gildan 5000) o una gorra
trucker (Richardson 112) con el color de la prenda que quiera y uno o varios diseños del
cliente encima, y que lo pueda **descargar** (PNG) o **adjuntar a un pedido**.

## Decisiones del usuario
- Prendas: playera Gildan 5000 (corte básico) y gorra Richardson 112 trucker.
- Color: selector libre. Gorra con color independiente para frente, malla y visera.
- Varios diseños por mockup; cada uno se arrastra sobre la prenda, se escala y rota,
  y hay botones de posiciones predeterminadas.
- Salida: descargar imagen y adjuntar al pedido.
- Acceso: sección propia "Mockups" en el menú (Recepción y Admin) y botón dentro de "Nuevo pedido".
- Modelos 3D gratuitos primero; la gorra se construye por código.

## Arquitectura

### Frontend (apps/web, Next 15 + React 18)
- Dependencias nuevas: `@react-three/fiber@^8`, `@react-three/drei@^9` (compatibles con React 18;
  `three@0.169` ya está instalado).
- Todo el 3D se carga con `next/dynamic({ ssr: false })` sólo en la pantalla del estudio.
- Iluminación de estudio sin red: `Environment` con `Lightformer`s (no HDR externo) +
  `ContactShadows`. `gl={{ preserveDrawingBuffer: true }}` para exportar.
- `lib/mockups/types.ts` (contrato compartido):
  - `Garment = "tshirt" | "cap"`.
  - `DesignLayer { id; name; dataUrl; aspect; placement: { position:[x,y,z]; normal:[x,y,z]; scale; rotation } }`.
  - `MockupConfig { garment; colors: { body; mesh?; visor? }; layers: DesignLayer[] }`.
  - `PLACEMENT_PRESETS[garment]`: posiciones fijas (playera: pecho izq./der., centro, espalda alta,
    espalda centro, manga izq./der.; gorra: frente, lateral izq./der., atrás).
- `components/mockups/`
  - `MockupCanvas.tsx` (dinámico): escena, cámara con vistas Frente/Espalda/Lado, OrbitControls.
  - `ShirtModel.tsx`: GLB `public/models/tshirt.glb` (pmndrs examples, MIT), color con
    `MeshStandardMaterial`, un `Decal` por capa.
  - `TruckerCapModel.tsx`: geometría procedural (corona de 5 paneles: 2 frontales estructurados +
    3 de malla con textura de malla generada en canvas, botón superior, visera curva, broche).
    Expone mallas con nombre (`front`, `mesh`, `visor`) para colores y decals.
  - Arrastre: `onPointerDown/Move` sobre la malla de la prenda → punto + normal del raycast →
    actualiza `placement` de la capa seleccionada (OrbitControls se desactiva mientras arrastra).
  - `exportMockup.ts`: renderiza Frente, Espalda y Lado y los compone en una lámina PNG
    (1600×800 aprox.) con fondo claro; devuelve `Blob`/dataURL.
  - `MockupStudio.tsx`: panel de controles (prenda, colores, capas con subir/seleccionar/quitar,
    tamaño, rotación, presets, vistas) + acciones (Descargar, Adjuntar). Reutilizable en página y diálogo.
- Página `app/dashboard/mockups/page.tsx` + entrada "Mockups" en el menú (Recepción/Admin).
  "Adjuntar a pedido" abre un buscador de pedido (número o cliente).
- `CreateOrderDialog`: botón "Crear mockup" abre el estudio en un diálogo; los mockups quedan
  pendientes y se suben con `POST /orders/:id/mockups` después de crear el pedido.
- Detalle del pedido: sección "Mockups" con miniaturas, ver grande y descargar.

### Backend (NestJS + Prisma)
- Modelo `OrderMockup { id, orderId, garment, imageData (base64 PNG), imageMime, config Json,
  createdById, createdAt }`, con `onDelete: Cascade` desde `Order`.
- Endpoints (`assertOrderAccess` para leer; crear/borrar sólo Recepción/Admin/Superuser):
  - `GET /orders/:id/mockups` → lista sin la imagen (id, garment, createdAt, createdBy).
  - `GET /orders/:id/mockups/:mockupId` → `{ dataUrl, config }`.
  - `POST /orders/:id/mockups` `{ garment, imageDataUrl, config }` (PNG/JPEG, ≤ 5 MB).
  - `DELETE /orders/:id/mockups/:mockupId`.
- Migración SQL nueva; tests de servicio y de roles.

## Riesgos
- Peso del bundle 3D → carga diferida.
- Exportar en celulares lentos → resolución limitada y una sola lámina.
- El color en pantalla es aproximado al de la tela real.
- Licencia: playera de `pmndrs/examples` (MIT). Gorra propia.

## Orden de trabajo
1. Contrato `lib/mockups/types.ts` (yo).
2. En paralelo: backend (agente A), 3D core playera+gorra+export (agente B), UI/integración (agente C).
3. Integración, `/review` (gstack), `/qa` + `/design-review` (gstack) en navegador, PRs.

---

# /plan-eng-review — target: docs/plans/mockups-3d.md

## Scope record
feature answers: no cuts proposed; structure: A (Original arrangement, answer D3); accepted scope: plan as written, backend in a new `src/order-mockup/` module; pending remedies: R1, R2.
Scope Challenge result: scope accepted as-is.

Scope Challenge findings:
1. [P1] (confidence: 9/10) backend `src/main.ts:41` — `app.use(json({ limit: '10mb' }))`. The plan stores the composite PNG **and** `config.layers[].dataUrl` (each design up to 5 MB, `lib/fileInput.ts` `UPLOAD_FILE_MAX_BYTES = 5 * 1024 * 1024`) in one POST. Two big logos plus the composite exceed 10 MB, the request gets 413 and the mockup is lost. → R1.
2. [P1] (confidence: 8/10) plan "CreateOrderDialog ... se suben con POST /orders/:id/mockups después de crear el pedido". If that second request fails, the order exists without its mockup and the dialog already closed. → R2.
3. [P2] (confidence: 9/10) backend `src/order/order.service.ts:355` — `private async assertOrderAccess(`. The new module needs the same visibility check; it must become a public method of OrderService (exported module) instead of duplicating rules. Factual implementation note, part of approved structure A; no question.
4. [P2] (confidence: 7/10) Search [Layer 1]: drei `Decal` rebuilds its geometry on every position change; dragging must throttle updates to one per animation frame. Implementation note of the approved drag behavior; no question.

## Decision ledger

### R1: Bound what one saved mockup can weigh
Finding: 1, P1, 9/10, backend src/main.ts:41, reviewer: plan-eng-review
Plan baseline: POST body `{ garment, imageDataUrl, config }` with designs embedded as full-size dataUrls; no size bound besides "PNG/JPEG ≤ 5 MB" for the image.
Runtime evidence: express json limit 10mb (src/main.ts:41); upload helper allows 5 MB per file (lib/fileInput.ts).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R1 design storage | full-size dataUrl in config | designs downscaled to ≤1024 px PNG on import; server rejects body > 8 MB with a clear 413 message | config stored without designs (no re-edit) |
| R1 re-edit later | yes (plan) | yes | no |
| R2 | pending | pending | pending |
Question D4: see AskUserQuestion D4 (R1).
Header: Peso
Options:
A) Reducir y limitar (recommended)
Designs are downscaled to ≤1024 px when imported, composite PNG is ~1600×800, server validates ≤ 8 MB with a clear error; re-edit kept.
B) Sin re-edición
Only the composite image is stored; config keeps positions/colors but not the designs, so a saved mockup can be viewed but not edited.

State: approved
Actual answer: A) Reducir y limitar (D4)
Accepted scope: designs downscaled to ≤1024 px PNG on import (SVG rasterized there too); composite PNG ~1600×800; backend validates body/image ≤ 8 MB with a clear error; config keeps designs for re-edit.
History: none

### R2: What happens if attaching a mockup fails after the order is created
Finding: 2, P1, 8/10, plan CreateOrderDialog step, reviewer: plan-eng-review
Plan baseline: order created, then mockups POSTed; no failure handling specified.
Runtime evidence: unknown (proposed code).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R2 failure handling | unspecified | order is created; each failed mockup shows an error toast with "Reintentar" that resends from memory, and the order detail lets you add it again | order and mockups go in one request inside one DB transaction |
| R1 | pending | pending | pending |
Question D5: see AskUserQuestion D5 (R2).
Header: Falla
Options:
A) Avisar y reintentar (recommended)
Order is never blocked by a mockup; a failed attach is visible and retryable.
B) Todo en una petición
Atomic: either both save or neither; larger create-order payload and changes the create-order contract.

State: approved
Actual answer: A) Avisar y reintentar (D5)
Accepted scope: order creation never blocked by mockups; each failed attach shows an error toast with "Reintentar" that resends from memory; the order detail can attach a new mockup.
History: none

## Section 1: Architecture review
1. [P2] (confidence: 7/10) plan "Todo el 3D se carga con next/dynamic ... sólo en la pantalla del estudio" — no path for devices without WebGL (old PCs, disabled GPU). Canvas creation throws and the studio is blank. → R3.
2. [P3] (confidence: 8/10) plan "Licencia: playera de pmndrs/examples (MIT)" — attribution is not written anywhere in the repo. Implementation note: add `public/models/README.md` with source and license. Part of approved scope; no question.
Flow:
```
Recepción ── MockupStudio ──(dynamic)── MockupCanvas ── Shirt/Cap + Decals
     │              │ import design → downscale ≤1024px (R1)
     │              └─ export → composite PNG (front/back/side)
     ├─ Descargar ─────────────────────────────▶ PNG file
     └─ Adjuntar ─ POST /orders/:id/mockups ──▶ OrderMockupService ─ assertOrderAccess ─ Prisma OrderMockup
                    (fails → toast "Reintentar", R2)
```
Dispositions: 1 → pending R3; 2 → accepted as implementation note.

## Section 2: Code quality review
1. [P3] (confidence: 8/10) frontend `lib/fileInput.ts` `readFileAsUploadInput` and `lib/download.ts` `downloadFromUrl` already cover reading files and downloading; reuse them instead of new helpers (only the downscale step is new). Implementation note; no question.
Dispositions: 1 → accepted as implementation note.

## Section 3: Test review
Framework: frontend vitest + Playwright (`apps/web/playwright.config.ts`, `e2e/pedidos.e2e.ts` with `e2e/mock-api.mjs`); backend jest.
```
CODE PATHS                                         USER FLOWS
[+] backend OrderMockupService                     [+] Mockup studio
  ├── [GAP] create: order access / role / garment    ├── [GAP] upload design → appears on garment [→E2E]
  ├── [GAP] create: >8MB or bad mime → 400/413       ├── [GAP] drag/scale/preset moves design [→E2E]
  ├── [GAP] list: no imageData in response           ├── [GAP] change color (shirt; cap front/mesh/visor)
  └── [GAP] delete: role + order access              └── [GAP] download PNG
[+] frontend                                       [+] Attach
  ├── [GAP] downscale helper (≤1024px, aspect)        ├── [GAP] from studio page → pick order → attached
  ├── [GAP] presets per garment                       ├── [GAP] from Nuevo pedido → created → uploaded
  └── [GAP] nav shows Mockups only Recepción/Admin    └── [GAP] attach fails → toast Reintentar (R2)
COVERAGE: 0/14 (new code)  GAPS: 14 (2 E2E)
```
Required proof of approved behavior (no question): backend service + roles specs; frontend unit tests for downscale, presets, nav visibility, studio controls with mocked canvas, CreateOrderDialog attach success/failure+retry, order detail mockups list.
Optional depth → R4 (E2E in real browser).

## Section 4: Performance review
1. [P2] (confidence: 8/10) plan `GET /orders/:id/mockups → lista sin la imagen` — must use explicit Prisma `select` without `imageData`/`config` and `@@index([orderId])`; each row can be ~8 MB. Implementation of approved contract; no question.
2. [P3] (confidence: 7/10) GLB size: `shirt_baked_collapsed.glb` 1.0 MB vs `shirt_baked_lower2.glb` 0.66 MB; use the lighter one if it looks the same. Implementation note.
Dispositions: 1, 2 → accepted as implementation notes.

### R3: Devices without WebGL
Finding: Section 1 #1, P2, 7/10, plan line "Todo el 3D se carga con next/dynamic"
Plan baseline: not specified.
Runtime evidence: unknown (proposed code).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R3 no-WebGL | blank studio | detect WebGL before mounting; show a clear message "Tu navegador no puede mostrar 3D" with the rest of the app intact | do nothing |
Question D6. Header: WebGL
Options:
A) Mensaje claro (recommended)
B) No hacer nada
State: approved
Actual answer: A) Mensaje claro (D6)
Accepted scope: detect WebGL before mounting the canvas; show "Tu navegador no puede mostrar 3D" fallback with guidance; unit test for the fallback.
History: none

### R4: Optional E2E depth for the 3D flow
Finding: Section 3 user flows [→E2E], P2, 8/10
Plan baseline: unit tests only (implied).
Runtime evidence: Playwright already configured (apps/web/playwright.config.ts, e2e/pedidos.e2e.ts).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R4 E2E | none | add e2e/mockups.e2e.ts: open studio, upload design, apply preset, download PNG, attach to order (mock API) | rely on unit tests + gstack /qa run |
Question D7. Header: E2E
Options:
A) Agregar E2E (recommended)
B) Solo unit + /qa
State: approved
Actual answer: A) Agregar E2E (D7)
Accepted scope: add apps/web/e2e/mockups.e2e.ts (mock API): open studio, upload design, preset, download PNG, attach to order.
History: none

### R5: TODO — realistic cap model later
Finding: plan Riesgos / approved procedural cap
What: replace procedural Richardson 112 with a licensed GLB when available. Why: more realism. Pros: better client-facing mockups. Cons: needs model with separate front/mesh/visor parts. Context: TruckerCapModel exposes named meshes; swap inside it. Depends on: obtaining a model.
Question D8. Header: TODO
Options:
A) Add to TODOS.md (recommended)
B) Skip
C) Build it now
State: approved
Actual answer: A) Anotar en TODOS.md (D8)
Accepted scope: add TODOS.md entry for a realistic Richardson 112 GLB replacing TruckerCapModel internals.
History: none

Approval readiness: PASS — R1 (D4 A), R2 (D5 A), R3 (D6 A), R4 (D7 A), R5 (D8 A); structure D3 A.

## Outside voice
Codex not installed; outside coverage unavailable. Native bounded fallback needs TaskOutput, not available in this host. Outside voice unavailable; recorded as `unavailable`.

## NOT in scope
- Exact Gildan/Richardson fabric colors: user chose a free color picker.
- Realistic cap GLB: deferred to TODOS.md (R5).
- Text tool (typing text on the garment): not requested.
- Other garments (hoodies, polos): user asked for basic tee and cap only.

## What already exists
- `three@0.169` installed (`components/three/ParticleField.tsx`); add only `@react-three/fiber@8` + `@react-three/drei@9`.
- `lib/fileInput.ts` (read files), `lib/download.ts` (`downloadFromUrl`) reused.
- Backend `OrderService.assertOrderAccess` reused (made public) for visibility.
- Shirt GLB from `pmndrs/examples` (MIT).
- Playwright e2e harness with mock API (`apps/web/e2e/`).

## Failure modes
| Path | Realistic failure | Handling | User sees |
|---|---|---|---|
| Studio load | no WebGL | R3 fallback | clear message |
| Import design | huge or unsupported file | downscale ≤1024 px, reject non-image | toast error |
| Attach | network/413 | R1 cap + R2 toast "Reintentar" | clear error + retry |
| List mockups | big rows | select without imageData | fast list |
| Export | canvas tainted / not ready | export waits for render; errors toast | clear error |
No critical gaps.

## Worktree parallelization strategy
| Step | Modules touched | Depends on |
|---|---|---|
| Contract types | apps/web/src/lib/mockups | — |
| Backend module | backend src/order-mockup, prisma | — |
| 3D core | apps/web/src/components/mockups (canvas, models, export) | Contract types |
| UI integration | apps/web/src/app/dashboard/mockups, orders, navMenu, hooks | Contract types |
| E2E + QA | apps/web/e2e | 3D core, UI integration, backend contract |
Lane A: backend module. Lane B: 3D core. Lane C: UI integration. Launch A + B + C after contract types. Merge all. Then E2E + /review + /qa.
Conflict flags: B and C share `components/mockups/MockupStudio.tsx` props; C owns the studio panel, B owns canvas/models/export.

## Implementation Tasks
- [ ] **T1 (P1, human: ~1d / CC: ~25min)** — backend — OrderMockup model, migration, module (list/get/create/delete), 8 MB cap, roles, specs
  - Surfaced by: Scope Challenge #1, #3; Section 4 #1
  - Files: prisma/schema.prisma, prisma/migrations/*, src/order-mockup/*, src/order/order.service.ts
  - Verify: npx jest src/order-mockup
- [ ] **T2 (P1, human: ~2d / CC: ~40min)** — frontend 3D — canvas, shirt GLB, procedural Richardson 112, decals with throttled drag, presets, export composite PNG, WebGL fallback
  - Surfaced by: Scope Challenge #4; Section 1 #1 (R3); R1
  - Files: apps/web/src/components/mockups/*, apps/web/public/models/*
  - Verify: vitest + browser QA
- [ ] **T3 (P1, human: ~1.5d / CC: ~35min)** — frontend UI — studio panel, Mockups page + nav, attach-to-order picker, CreateOrderDialog integration with retry toast, order detail mockups section, hooks
  - Surfaced by: R2; Section 3 user flows
  - Files: apps/web/src/app/dashboard/mockups/*, components/orders/*, lib/navMenu.ts, hooks/useOrderMockups.ts
  - Verify: vitest
- [ ] **T4 (P2, human: ~4h / CC: ~15min)** — e2e — mockups.e2e.ts with mock API (R4)
  - Files: apps/web/e2e/mockups.e2e.ts, apps/web/e2e/mock-api.mjs
  - Verify: pnpm test:e2e
- [ ] **T5 (P3, human: ~10min / CC: ~2min)** — docs — TODOS.md entry (R5) and public/models/README.md attribution

## Unresolved decisions
None.

## Completion summary
- Step 0: Scope Challenge — scope accepted as-is
- Architecture Review: 2 issues found
- Code Quality Review: 1 issues found
- Test Review: diagram produced, 14 gaps identified
- Performance Review: 2 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 items proposed to user
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex, unavailable (not installed; native fallback unavailable in host)
- Parallelization: 3 lanes, 3 parallel / 1 sequential
- Lake Score: 4/4 = answers picking a 10/10 option / answers scored for Completeness

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | codex via `/plan-eng-review` | Independent 2nd opinion | 1 | unavailable | not installed |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN | 19 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review, unavailable (CLI not installed), no findings.
- **VERDICT:** no review CLEAR yet; all findings mapped to approved tasks T1–T5; eng review required (issues_open means mapped work).
NO UNRESOLVED DECISIONS
