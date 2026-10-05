# TODOS

## Mockups

### Replace the procedural Richardson 112 cap with a licensed realistic GLB

**What:** Swap the code-built trucker cap (`apps/web/src/components/mockups/TruckerCapModel.ts` + `capShape.ts`) for a licensed, realistic Richardson 112 GLB that has separate `front`, `mesh` and `visor` meshes.

**Why:** The cap is what Recepción shows the client to get a design approved; a procedural crown reads as "3D placeholder" next to the real shirt GLB and undersells the embroidery/print. The real 112 is also 6-panel (two structured front panels + four mesh panels), while the current procedural model is 5-panel (2 front + 3 mesh), which a client who knows the cap can notice.

**Pros:** Client-facing mockups that look like the actual product (correct 6-panel crown, real seams, eyelets, snapback and visor curvature); less custom geometry/texture code to maintain in `TruckerCapModel.ts` and `capShape.ts`.

**Cons:** Needs a model with a license that allows commercial use and redistribution in the web bundle, and it must be split into the three named parts so colors and decals keep working. Adds a download (keep it small, Draco/meshopt-compressed, lazily loaded like `tshirt.glb`). Placement presets in `apps/web/src/lib/mockups/presets.ts` (cap: frente, lateral izq./der., atrás) were raycast against the procedural surface and must be re-measured; `presetsSurface.test.ts` currently checks them against `capShape.ts` and would need to check against the GLB (or a baked surface sample) instead.

**Context:** Deferred in `docs/plans/mockups-3d.md` (decision R5 / D8). `TruckerCapModel` already exposes named meshes `front`, `mesh`, `visor` and declares `decalTargets` (`front`, `mesh`), and it shares the cap's local space with `DesignPlacement` (+Z front, +Y up, +X wearer's left, meters, ~19 x 21 cm base, ~10.5 cm crown). The swap should happen inside `TruckerCapModel` (load the GLB, map its parts to those names, scale/orient it into that local space) so `MockupCanvas`, `exportMockup` and saved `MockupConfig`s (stored per order via `POST /orders/:id/mockups`) keep working. Old saved configs carry placements for the 5-panel surface: they only drive re-editing, since the stored PNG is what the order shows, but check they still land on the crown. Add attribution/license to `apps/web/public/models/README.md` next to the shirt's.

**Effort:** M
**Priority:** P3
**Depends on:** Obtaining a licensed Richardson 112 (6-panel) GLB with separate front / mesh / visor meshes.

## Completed
