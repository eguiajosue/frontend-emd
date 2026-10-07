import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PLACEMENT_PRESETS, presetsFor } from "@/lib/mockups/presets";
import { VEHICLE_GARMENTS, type VehicleGarment } from "@/lib/mockups/vehicles";
import { createVehicleModel } from "./vehicleModels";

const cache = new Map<string, ReturnType<typeof createVehicleModel>>();
function model(v: VehicleGarment, part?: "full" | "cab" | "box") {
  const key = `${v}:${part ?? ""}`;
  if (!cache.has(key)) cache.set(key, createVehicleModel(v, { body: "#ffffff" }, part));
  return cache.get(key)!;
}

function triangles(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const per = m.geometry.index ? m.geometry.index.count / 3 : m.geometry.getAttribute("position").count / 3;
    n += per * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1);
  });
  return n;
}

describe("modelos de vehículo", () => {
  it.each([
    ["car", 3.5, 5.6],
    ["minivan", 4, 6],
    ["pickup", 4.5, 6],
    ["bicycle", 1.3, 2.2],
  ] as const)("%s mide lo esperado (m) y apoya las ruedas en el piso", (v, minLen, maxLen) => {
    const m = model(v);
    const box = new THREE.Box3().setFromObject(m.root);
    const size = box.getSize(new THREE.Vector3());
    const k = v === "bicycle" ? 0.25 : 0.1;
    expect(size.z / k).toBeGreaterThan(minLen);
    expect(size.z / k).toBeLessThan(maxLen);
    expect(size.y / k).toBeGreaterThan(1);
    expect(size.y / k).toBeLessThan(2.2);
    expect(Math.abs(box.min.y)).toBeLessThan(0.0025);
    expect(size.x).toBeLessThan(size.z);
  });

  it("el tráiler completo mide ~20 m; la cabina y la caja, menos", () => {
    const len = (part: "full" | "cab" | "box") => new THREE.Box3().setFromObject(model("trailer", part).root).getSize(new THREE.Vector3()).z / 0.1;
    expect(len("full")).toBeGreaterThan(19);
    expect(len("full")).toBeLessThan(23);
    expect(len("cab")).toBeGreaterThan(6);
    expect(len("cab")).toBeLessThan(10);
    expect(len("box")).toBeGreaterThan(12);
    expect(len("box")).toBeLessThan(15);
    expect(len("full")).toBeGreaterThan(len("box"));
  });

  it.each(VEHICLE_GARMENTS)("%s es liviano (< 60 mil triángulos)", (v) => {
    expect(triangles(model(v).root)).toBeLessThan(60000);
  });

  it("el tráiler completo y por partes también", () => {
    for (const part of ["full", "cab", "box"] as const) expect(triangles(model("trailer", part).root)).toBeLessThan(60000);
  });

  it("dispose libera geometrías y materiales", () => {
    const m = createVehicleModel("car", { body: "#ffffff" });
    const geos = new Set<THREE.BufferGeometry>();
    m.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) geos.add(mesh.geometry);
    });
    let disposed = 0;
    geos.forEach((g) => g.addEventListener("dispose", () => disposed++));
    m.dispose();
    expect(disposed).toBe(geos.size);
  });

  it("setColors pinta la carrocería y, en el tráiler, cabina y caja por separado", () => {
    const c = createVehicleModel("car", { body: "#ff0000" });
    const paint = c.decalTargets[0].material as THREE.MeshPhysicalMaterial;
    expect(paint.color.getHexString()).toBe("ff0000");
    c.setColors({ body: "#0000ff" }, true);
    expect(paint.color.getHexString()).toBe("0000ff");
    const t = createVehicleModel("trailer", { body: "#ff0000", mesh: "#00ff00" }, "full");
    const hex = new Set(t.decalTargets.map((m) => (m.material as THREE.MeshPhysicalMaterial).color.getHexString()));
    expect(hex).toEqual(new Set(["ff0000", "00ff00"]));
  });
});

describe("presets de vehículos sobre la superficie", () => {
  const cases = VEHICLE_GARMENTS.flatMap((v) =>
    (v === "trailer" ? (["full", "cab", "box"] as const) : [undefined]).flatMap((part) =>
      presetsFor(v, part).map((p) => [v, part, p] as const),
    ),
  );
  it.each(cases.map(([v, part, p]) => [`${v}${part ? `:${part}` : ""} ${p.id}`, v, part, p] as const))("%s cae sobre la pintura", (_n, v, part, preset) => {
    const m = model(v, part);
    const k = v === "bicycle" ? 0.25 : 0.1;
    const p = new THREE.Vector3(...preset.placement.position);
    const n = new THREE.Vector3(...preset.placement.normal).normalize();
    const rc = new THREE.Raycaster(p.clone().addScaledVector(n, 0.05 * k * 10), n.clone().negate());
    const hit = rc.intersectObjects(m.decalTargets, false)[0];
    expect(hit).toBeDefined();
    expect(hit.distance).toBeGreaterThan(0.05 * k * 10 - 0.004);
    expect(hit.distance).toBeLessThan(0.05 * k * 10 + 0.004);
  });

  it("todos los presets de un vehículo existen en su registro", () => {
    for (const v of VEHICLE_GARMENTS) expect(PLACEMENT_PRESETS[v].length).toBeGreaterThan(0);
  });
});
