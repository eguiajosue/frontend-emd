import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PLACEMENT_PRESETS } from "@/lib/mockups/presets";
import { crownNormal, crownPoint, CAP_SHAPE, openingArch, wrapAngle } from "./capShape";

/**
 * Los presets son coordenadas sueltas: si alguien cambia el modelo (GLB o la
 * forma de la gorra) estos tests avisan cuando dejen de caer sobre la tela.
 */

/** Malla de la playera leída directo del GLB (sin GLTFLoader ni DOM). */
function loadShirtMesh(): THREE.Mesh {
  const buf = fs.readFileSync(path.resolve(__dirname, "../../../public/models/tshirt.glb"));
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength + 8;
  const accessor = (i: number) => {
    const a = json.accessors[i];
    const view = json.bufferViews[a.bufferView];
    const offset = binStart + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const size = ({ SCALAR: 1, VEC2: 2, VEC3: 3 } as Record<string, number>)[a.type];
    const Ctor = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : Uint16Array;
    const bytes = buf.subarray(offset, offset + a.count * size * Ctor.BYTES_PER_ELEMENT);
    return new Ctor(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  };
  const node = json.nodes.find((n: { name: string }) => n.name === "T_Shirt_male");
  const prim = json.meshes[node.mesh].primitives[0];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(accessor(prim.attributes.POSITION), 3));
  geo.setIndex(new THREE.BufferAttribute(accessor(prim.indices), 1));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}

describe("presets de playera sobre el modelo", () => {
  const mesh = loadShirtMesh();
  const raycaster = new THREE.Raycaster();

  it.each(PLACEMENT_PRESETS.tshirt.map((p) => [p.id, p] as const))("%s cae sobre la tela", (_id, preset) => {
    const p = new THREE.Vector3(...preset.placement.position);
    const n = new THREE.Vector3(...preset.placement.normal).normalize();
    // Desde 5 cm afuera, en contra de la normal: lo primero que pega es la tela.
    raycaster.set(p.clone().addScaledVector(n, 0.05), n.clone().negate());
    const hit = raycaster.intersectObject(mesh)[0];
    expect(hit).toBeDefined();
    expect(hit.distance).toBeGreaterThan(0.045);
    expect(hit.distance).toBeLessThan(0.055);
  });
});

describe("presets de gorra sobre la corona", () => {
  /** Busca el (theta, s) de la corona más cercano a un punto. */
  function closestOnCrown(p: THREE.Vector3) {
    const theta = Math.atan2(p.x, p.z); // azimut aproximado
    let best = { d: Infinity, theta: 0, s: 0 };
    for (let dt = -0.2; dt <= 0.2; dt += 0.002) {
      for (let s = 0; s <= 1; s += 0.002) {
        const q = crownPoint(theta + dt, s);
        const d = p.distanceTo(new THREE.Vector3(...q));
        if (d < best.d) best = { d, theta: theta + dt, s };
      }
    }
    return best;
  }

  it.each(PLACEMENT_PRESETS.cap.map((p) => [p.id, p] as const))("%s cae sobre la corona con su normal", (_id, preset) => {
    const p = new THREE.Vector3(...preset.placement.position);
    const best = closestOnCrown(p);
    expect(best.d).toBeLessThan(0.001);
    const normal = new THREE.Vector3(...crownNormal(best.theta, best.s));
    expect(normal.dot(new THREE.Vector3(...preset.placement.normal).normalize())).toBeGreaterThan(0.995);
  });

  it("el diseño de atrás queda arriba de la abertura del broche", () => {
    const back = PLACEMENT_PRESETS.cap.find((p) => p.id === "atras")!;
    const archTop = crownPoint(Math.PI, openingArch(Math.PI))[1];
    // Mitad del alto del diseño más ancho razonable (aspecto 1:1).
    expect(back.placement.position[1] - back.placement.scale / 2).toBeGreaterThan(archTop);
  });
});

describe("capShape", () => {
  it("todos los meridianos llegan al botón", () => {
    const top = crownPoint(0, 1);
    for (const t of [0.5, 1.5, 3, -2]) {
      const q = crownPoint(t, 1);
      expect(Math.hypot(q[0] - top[0], q[1] - top[1], q[2] - top[2])).toBeLessThan(1e-6);
    }
  });

  it("las normales son unitarias y apuntan hacia afuera", () => {
    for (const t of [0, 1, 2, Math.PI, -1]) {
      for (const s of [0.1, 0.5, 0.9]) {
        const n = crownNormal(t, s);
        expect(Math.hypot(...n)).toBeCloseTo(1, 6);
        const p = crownPoint(t, s);
        // Afuera = lejos del eje vertical que pasa por el botón.
        const radial = new THREE.Vector3(p[0], 0, p[2] - CAP_SHAPE.topZ);
        expect(new THREE.Vector3(...n).dot(radial)).toBeGreaterThan(0);
      }
    }
  });

  it("la abertura del broche sólo existe atrás", () => {
    expect(openingArch(0)).toBe(0);
    expect(openingArch(Math.PI / 2)).toBe(0);
    expect(openingArch(Math.PI)).toBeCloseTo(CAP_SHAPE.openingHeight, 6);
    expect(openingArch(-Math.PI)).toBeCloseTo(CAP_SHAPE.openingHeight, 6);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
  });
});
