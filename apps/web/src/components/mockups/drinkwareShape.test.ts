import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PLACEMENT_PRESETS } from "@/lib/mockups/presets";
import { TAZA_SHAPE, TERMO_SHAPE, surfacePoint, wrapDecalArrays, type DrinkwareShape } from "./drinkwareShape";

const SHAPES: Record<"termo" | "taza", DrinkwareShape> = { termo: TERMO_SHAPE, taza: TAZA_SHAPE };

describe.each(["termo", "taza"] as const)("presets de %s sobre el cuerpo", (garment) => {
  const shape = SHAPES[garment];
  it.each(PLACEMENT_PRESETS[garment].map((p) => [p.id, p] as const))("%s cae sobre la superficie", (_id, preset) => {
    const [x, y, z] = preset.placement.position;
    expect(Math.hypot(x, z)).toBeCloseTo(shape.radiusAt(y), 3);
    expect(y).toBeGreaterThan(shape.printMinY);
    expect(y).toBeLessThan(shape.printMaxY);
    const expected = surfacePoint(shape, Math.atan2(x, z), y).normal;
    const n = new THREE.Vector3(...preset.placement.normal).normalize();
    expect(n.dot(new THREE.Vector3(...expected))).toBeGreaterThan(0.999);
  });
});

describe("wrapDecalArrays", () => {
  it("el ancho se mide sobre el arco: el diseño queda pegado a la superficie", () => {
    const out = wrapDecalArrays(TAZA_SHAPE, { x: 0, y: 0, z: 0.0416 }, 0, 0.06, 0.04)!;
    expect(out.positions.length % 9).toBe(0);
    for (let i = 0; i < out.positions.length; i += 3) {
      const [x, y, z] = out.positions.slice(i, i + 3);
      expect(Math.hypot(x, z) - TAZA_SHAPE.radiusAt(y)).toBeCloseTo(0.0004, 5);
    }
    expect(out.uvs.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it("'Alrededor' da casi la vuelta completa sin pasar por el asa (+X)", () => {
    const wrap = PLACEMENT_PRESETS.taza.find((p) => p.id === "alrededor")!;
    const [x, y, z] = wrap.placement.position;
    const out = wrapDecalArrays(TAZA_SHAPE, { x, y, z }, 0, wrap.placement.scale, 0.06)!;
    let maxX = -Infinity;
    for (let i = 0; i < out.positions.length; i += 3) maxX = Math.max(maxX, out.positions[i]);
    // El asa sale por +X: el arte se detiene antes (~40° de margen).
    expect(maxX).toBeLessThan(TAZA_SHAPE.radiusAt(y) * Math.sin((50 * Math.PI) / 180) * -1 + 0.08);
    const angles = [];
    for (let i = 0; i < out.positions.length; i += 3) angles.push(Math.atan2(out.positions[i], out.positions[i + 2]));
    const near = angles.filter((a) => Math.abs(a - Math.PI / 2) < 0.5);
    expect(near).toHaveLength(0);
  });

  it("recorta lo que cae fuera de la zona imprimible", () => {
    expect(wrapDecalArrays(TERMO_SHAPE, { x: 0, y: 0.5, z: 0.04 }, 0, 0.05, 0.05)).toBeNull();
  });
});
