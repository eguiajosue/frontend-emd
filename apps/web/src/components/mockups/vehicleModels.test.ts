import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PLACEMENT_PRESETS, presetsFor } from "@/lib/mockups/presets";
import type { Garment, VehiclePart } from "@/lib/mockups/types";
import { VEHICLE_GARMENTS } from "@/lib/mockups/vehicles";
import type { GarmentModel } from "./garmentModel";
import { GLB_SPECS, loadGlbModel, type GlbGarment } from "./GlbModel";
import { loadVehicleModel } from "./vehicleModels";

/**
 * Los modelos son GLB (`public/models`). En node no hay <img> ni WebP: se
 * lee el GLB del disco sin sus texturas (la geometría y los materiales,
 * que es lo que miden estas pruebas, no las necesitan).
 */
vi.mock("./glbLoader", () => ({
  loadGlb: (url: string) => parseGlb(url),
}));

const cache = new Map<string, Promise<GLTF>>();

function stripTextures(buf: Buffer): ArrayBuffer {
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
  delete json.textures;
  delete json.images;
  delete json.samplers;
  json.extensionsUsed = (json.extensionsUsed ?? []).filter((e: string) => e !== "EXT_texture_webp" && e !== "KHR_texture_transform");
  json.extensionsRequired = (json.extensionsRequired ?? []).filter((e: string) => e !== "EXT_texture_webp");
  const drop = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (/Texture$/.test(k)) delete (o as Record<string, unknown>)[k];
      else drop(v);
    }
  };
  drop(json.materials);
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4) text += " ";
  const jsonBuf = Buffer.from(text);
  const binStart = 20 + jsonLength + 8;
  const bin = buf.subarray(binStart);
  const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonBuf.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + jsonBuf.length);
  out.writeUInt32LE(0x004e4942, 24 + jsonBuf.length);
  bin.copy(out, 28 + jsonBuf.length);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

function parseGlb(url: string): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) {
    const file = path.resolve(__dirname, "../../../public", url.replace(/^\//, ""));
    const data = stripTextures(fs.readFileSync(file));
    p = new Promise((resolve, reject) => new GLTFLoader().parse(data, "", resolve, reject));
    cache.set(url, p);
  }
  return p;
}

const models = new Map<string, GarmentModel>();
const keyOf = (g: string, part?: VehiclePart) => `${g}:${part ?? ""}`;

async function model(g: GlbGarment, part?: VehiclePart) {
  const key = keyOf(g, part);
  if (!models.has(key)) models.set(key, await loadGlbModel(g, { body: "#ffffff", mesh: "#ffffff" }, part));
  return models.get(key)!;
}

function triangles(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    n += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3;
  });
  return n;
}

const GLB_VEHICLES = ["car", "minivan", "pickup", "trailer"] as const;

describe("modelos GLB de vehículo", () => {
  beforeAll(async () => {
    for (const v of GLB_VEHICLES) await model(v);
    for (const part of ["cab", "box"] as const) await model("trailer", part);
  }, 60000);

  it.each([
    ["car", 4, 5.2, 1.3, 1.7],
    ["minivan", 6, 7.5, 2.4, 3.2],
    ["pickup", 5.5, 6.8, 1.8, 2.4],
    ["trailer", 12, 18, 3.5, 5.2],
  ] as const)("%s mide lo esperado y apoya las ruedas en el piso", async (v, minLen, maxLen, minH, maxH) => {
    const m = await model(v);
    const box = new THREE.Box3().setFromObject(m.root);
    const size = box.getSize(new THREE.Vector3());
    // En unidades del GLB (≈ metros): la escala de escena es la del spec.
    const len = size.z / GLB_SPECS[v].scale;
    expect(len).toBeGreaterThan(minLen);
    expect(len).toBeLessThan(maxLen);
    const height = size.y / GLB_SPECS[v].scale;
    expect(height).toBeGreaterThan(minH);
    expect(height).toBeLessThan(maxH);
    expect(Math.abs(box.min.y)).toBeLessThan(0.0025);
    expect(size.x).toBeLessThan(size.z);
  });

  it("la cabina y la caja del camión son más cortas que el camión completo", async () => {
    const len = async (part: VehiclePart) =>
      new THREE.Box3().setFromObject((await model("trailer", part)).root).getSize(new THREE.Vector3()).z;
    const full = await len("full");
    const cab = await len("cab");
    const box = await len("box");
    expect(cab).toBeLessThan(full * 0.45);
    expect(box).toBeGreaterThan(full * 0.6);
    expect(box).toBeLessThan(full);
  });

  it.each(GLB_VEHICLES)("%s es razonablemente liviano (< 400 mil triángulos)", async (v) => {
    expect(triangles((await model(v)).root)).toBeLessThan(400000);
  });

  it("dispose libera geometrías", async () => {
    const m = await loadGlbModel("car", { body: "#ffffff" });
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

  it("setColors pinta la carrocería y, en el camión, cabina y caja por separado", async () => {
    const c = await loadGlbModel("car", { body: "#ff0000" });
    const paint = c.decalTargets[0].material as THREE.MeshPhysicalMaterial;
    expect(paint.color.getHexString()).toBe("ff0000");
    c.setColors({ body: "#0000ff" }, true);
    expect(paint.color.getHexString()).toBe("0000ff");
    const t = await loadGlbModel("trailer", { body: "#ff0000", mesh: "#00ff00" }, "full");
    const hex = new Set(t.decalTargets.map((m) => (m.material as THREE.MeshPhysicalMaterial).color.getHexString()));
    expect(hex).toEqual(new Set(["ff0000", "00ff00"]));
  });

  it("recolorear un modelo no toca el GLB en caché (otra instancia sigue con su color)", async () => {
    const a = await loadGlbModel("pickup", { body: "#ff0000" });
    const b = await loadGlbModel("pickup", { body: "#00ff00" });
    expect((a.decalTargets[0].material as THREE.MeshPhysicalMaterial).color.getHexString()).toBe("ff0000");
    expect((b.decalTargets[0].material as THREE.MeshPhysicalMaterial).color.getHexString()).toBe("00ff00");
  });

  it("la animación de color llega al destino", async () => {
    const m = await loadGlbModel("minivan", { body: "#ffffff" });
    m.setColors({ body: "#102030" });
    let steps = 0;
    while (m.update(0.1) && steps < 200) steps++;
    expect((m.decalTargets[0].material as THREE.MeshPhysicalMaterial).color.getHexString()).toBe("102030");
  });

  it("la cabina sola no trae la caja y la caja sola no trae la cabina", async () => {
    const colors = async (part: VehiclePart) =>
      new Set((await model("trailer", part)).decalTargets.map((m) => (m.material as THREE.MeshPhysicalMaterial).userData.paintPart));
    expect(await colors("cab")).toEqual(new Set(["body"]));
    expect(await colors("box")).toEqual(new Set(["mesh"]));
    expect(await colors("full")).toEqual(new Set(["body", "mesh"]));
  });
});

describe("bicicleta", () => {
  it("sigue siendo procedural y apoya las ruedas en el piso", async () => {
    const m = await loadVehicleModel("bicycle", { body: "#ffffff" });
    const box = new THREE.Box3().setFromObject(m.root);
    const size = box.getSize(new THREE.Vector3());
    expect(size.z / 0.25).toBeGreaterThan(1.3);
    expect(size.z / 0.25).toBeLessThan(2.2);
    expect(Math.abs(box.min.y)).toBeLessThan(0.0025);
  });
});

describe("presets sobre la superficie", () => {
  const glbCases = [
    ...(["car", "minivan", "pickup", "taza", "mousepad"] as const).flatMap((g) =>
      presetsFor(g).map((p) => [g, undefined, p] as const),
    ),
    ...(["full", "cab", "box"] as const).flatMap((part) => presetsFor("trailer", part).map((p) => ["trailer", part, p] as const)),
  ];

  it.each(glbCases.map(([g, part, p]) => [`${g}${part ? `:${part}` : ""} ${p.id}`, g, part, p] as const))(
    "%s cae sobre la superficie",
    async (_n, g, part, preset) => {
      const m = await model(g, part);
      const p = new THREE.Vector3(...preset.placement.position);
      const n = new THREE.Vector3(...preset.placement.normal).normalize();
      const out = 0.05;
      const rc = new THREE.Raycaster(p.clone().addScaledVector(n, out), n.clone().negate());
      const hit = rc.intersectObjects(m.decalTargets, false)[0];
      expect(hit).toBeDefined();
      expect(hit.distance).toBeGreaterThan(out - 0.006);
      expect(hit.distance).toBeLessThan(out + 0.006);
    },
  );

  it("la bicicleta también", async () => {
    const m = await loadVehicleModel("bicycle", { body: "#ffffff" });
    for (const preset of PLACEMENT_PRESETS.bicycle) {
      const p = new THREE.Vector3(...preset.placement.position);
      const n = new THREE.Vector3(...preset.placement.normal).normalize();
      const rc = new THREE.Raycaster(p.clone().addScaledVector(n, 0.05), n.clone().negate());
      const hit = rc.intersectObjects(m.decalTargets, false)[0];
      expect(hit, preset.id).toBeDefined();
      expect(Math.abs(hit.distance - 0.05)).toBeLessThan(0.004);
    }
  });

  it("todos los vehículos y productos con GLB tienen presets", () => {
    for (const v of VEHICLE_GARMENTS) expect(PLACEMENT_PRESETS[v].length).toBeGreaterThan(0);
    for (const g of ["taza", "mousepad"] as Garment[]) expect(PLACEMENT_PRESETS[g].length).toBeGreaterThan(0);
  });
});
