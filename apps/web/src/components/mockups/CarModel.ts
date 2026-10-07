import * as THREE from "three";
import type { GarmentColors } from "@/lib/mockups/types";
import type { GarmentModel } from "./garmentModel";
import {
  Disposer,
  addSideLine,
  addWheelWells,
  addWheels,
  createMaterials,
  cutWheelArches,
  extrudeSide,
  loftBody,
  mirrorX,
  placeOnEdge,
  ribbon,
  roundedBox,
  sideHalfWidth,
  sideWindow,
  slopedGlass,
  type Loft,
  type Pt,
  type VehicleMaterials,
  type WheelArch,
} from "./vehicleKit";
import { finishVehicle, type VehicleBuild } from "./vehicleModel";

/**
 * Sedán (carro). Carrocería por secciones con los huecos de las ruedas
 * recortados, cabina extruida con vidrios, faros, calaveras, espejos,
 * manijas y líneas de puertas. Medidas en metros (≈ 4.8 × 1.84 × 1.46).
 */

export const CAR = {
  wheelbaseFront: 1.45,
  wheelbaseRear: -1.4,
  wheelRadius: 0.335,
  track: 0.79,
};

export function buildCar(): VehicleBuild {
  const d = new Disposer();
  const mats = createMaterials(d);
  const group = new THREE.Group();
  group.name = "car";
  const targets: THREE.Mesh[] = [];
  const archR = CAR.wheelRadius + 0.07;
  const arches: WheelArch[] = [
    { z: CAR.wheelbaseFront, y: CAR.wheelRadius, r: archR, floor: 0.62 },
    { z: CAR.wheelbaseRear, y: CAR.wheelRadius, r: archR, floor: 0.62 },
  ];
  cutWheelArches(mats.paint, arches);

  const tub = loftBody({
    keys: [
      { z: -2.38, w: 0.8, y0: 0.36, y1: 0.97, rb: 0.12, rt: 0.2 },
      { z: -2.0, w: 0.89, y0: 0.28, y1: 1.0, rb: 0.14, rt: 0.2 },
      { z: -1.4, w: 0.92, y0: 0.22, y1: 1.0, rb: 0.16, rt: 0.2 },
      { z: 0.0, w: 0.92, y0: 0.2, y1: 0.97, rb: 0.16, rt: 0.17 },
      { z: 0.75, w: 0.92, y0: 0.2, y1: 0.95, rb: 0.16, rt: 0.17 },
      { z: 1.45, w: 0.91, y0: 0.21, y1: 0.85, rb: 0.16, rt: 0.21 },
      { z: 2.0, w: 0.88, y0: 0.26, y1: 0.77, rb: 0.14, rt: 0.22 },
      { z: 2.4, w: 0.82, y0: 0.3, y1: 0.72, rb: 0.12, rt: 0.22 },
    ],
    rear: { len: 0.42, p: 3.4, q: 6 },
    front: { len: 0.5, p: 3.4, q: 6 },
    step: 0.1,
    segs: { bottom: 4, corner: 7, side: 26, top: 8 },
  });
  d.track(tub.geometry);
  const tubMesh = new THREE.Mesh(tub.geometry, mats.paint);
  tubMesh.name = "car-body";
  tubMesh.castShadow = true;
  group.add(tubMesh);
  targets.push(tubMesh);
  addWheelWells(group, d, mats, arches, 0.93);

  // Cabina (techo y pilares).
  const yBase = 0.92;
  const yTop = 1.46;
  const cabinProfile: Pt[] = [
    [0.8, 0.88],
    [0.8, yBase],
    [0.04, 1.43],
    [0.0, 1.46],
    [-1.02, 1.46],
    [-1.06, 1.43],
    [-1.64, 1.0],
    [-1.66, 0.97],
    [-1.66, 0.88],
  ];
  const cabinOpts = { halfWidth: 0.8, taper: 0.17, bevel: 0.035, yBase, yTop };
  const cabinGeo = d.track(extrudeSide(cabinProfile, cabinOpts));
  const cabin = new THREE.Mesh(cabinGeo, mats.paint);
  cabin.name = "car-roof";
  cabin.castShadow = true;
  group.add(cabin);
  targets.push(cabin);

  addGlassAndDetails(group, d, mats, cabinOpts, tub);

  addWheels(group, d, mats, { radius: CAR.wheelRadius, width: 0.225, rimRadius: 0.225, spokes: 5 }, [
    { x: CAR.track, z: CAR.wheelbaseFront },
    { x: -CAR.track, z: CAR.wheelbaseFront },
    { x: CAR.track, z: CAR.wheelbaseRear },
    { x: -CAR.track, z: CAR.wheelbaseRear },
  ]);

  return {
    group,
    disposer: d,
    paints: [{ part: "body", material: mats.paint }],
    targets,
    depth: (scale) => Math.min(0.1, Math.max(0.02, scale * 0.45)),
  };
}

function addGlassAndDetails(
  group: THREE.Group,
  d: Disposer,
  mats: VehicleMaterials,
  cabin: { halfWidth: number; taper: number; yBase: number; yTop: number },
  tub: Loft,
) {
  const hw = (y: number) => sideHalfWidth(cabin, y);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    const m = new THREE.Mesh(d.track(geo), mat);
    m.name = name;
    group.add(m);
    return m;
  };
  // Ventanas laterales (dos por lado).
  const front: Pt[] = [
    [0.62, 1.05],
    [0.1, 1.395],
    [-0.17, 1.395],
    [-0.17, 1.05],
  ];
  const rear: Pt[] = [
    [-0.31, 1.05],
    [-0.31, 1.395],
    [-1.0, 1.395],
    [-1.46, 1.06],
  ];
  for (const poly of [front, rear]) {
    const g = sideWindow(poly, hw, 0.004, [0.05, 0.02, 0.02, 0.02]);
    add(g, mats.glass, "car-window");
    add(mirrorX(g), mats.glass, "car-window");
  }
  // Parabrisas y medallón.
  add(slopedGlass([0.8, 0.93], [0.04, 1.43], hw, { inset: 0.075, startInset: 0.09, endInset: 0.07 }), mats.glass, "car-windshield");
  add(slopedGlass([-1.06, 1.43], [-1.64, 1.0], hw, { inset: 0.075, startInset: 0.07, endInset: 0.09 }), mats.glass, "car-rear-window");

  // Faros y calaveras sobre las esquinas.
  const lampGeo = d.track(new THREE.SphereGeometry(0.5, 20, 12));
  for (const s of [1, -1] as const) {
    const lamp = new THREE.Mesh(lampGeo, mats.headlamp);
    lamp.scale.set(0.34, 0.1, 0.1);
    placeOnEdge(lamp, tub, 0.6, 0.6, "front", s, 0.1, 0.5);
    group.add(lamp);
    const tail = roundedBox(d, mats.taillamp, [0.42, 0.1, 0.07], 0.03, [0, 0, 0], 4);
    placeOnEdge(tail, tub, 0.62, 0.86, "rear", s, 0.07);
    group.add(tail);
  }
  // Parrilla, entradas de aire y defensas.
  const front0 = tub.edgeAt(0.001, 0.5, "front").z;
  const rear0 = tub.edgeAt(0.001, 0.6, "rear").z;
  group.add(roundedBox(d, mats.trim, [0.95, 0.12, 0.05], 0.03, [0, 0.54, front0 - 0.02]));
  group.add(roundedBox(d, mats.trim, [0.7, 0.07, 0.05], 0.025, [0, 0.38, front0 - 0.03]));
  group.add(roundedBox(d, mats.plate, [0.3, 0.14, 0.02], 0.01, [0, 0.46, front0 - 0.005]));
  group.add(roundedBox(d, mats.plate, [0.3, 0.14, 0.02], 0.01, [0, 0.74, rear0 + 0.0]));
  group.add(roundedBox(d, mats.trim, [1.0, 0.06, 0.04], 0.02, [0, 0.4, rear0 + 0.0]));

  // Espejos laterales.
  const mirrorGeo = d.track(new THREE.SphereGeometry(0.5, 16, 12));
  for (const s of [1, -1]) {
    const mirror = new THREE.Mesh(mirrorGeo, mats.paint);
    mirror.scale.set(0.1, 0.13, 0.2);
    mirror.position.set(0.91 * s, 1.1, 0.6);
    mirror.castShadow = true;
    group.add(mirror);
    group.add(roundedBox(d, mats.trim, [0.12, 0.04, 0.07], 0.012, [0.84 * s, 1.07, 0.64]));
  }

  // Manijas y líneas de puertas / costado.
  const handleGeo = d.track(new THREE.CapsuleGeometry(0.012, 0.14, 4, 8));
  for (const s of [1, -1]) {
    for (const zc of [0.28, -0.6]) {
      const handle = new THREE.Mesh(handleGeo, mats.trim);
      handle.rotation.x = Math.PI / 2;
      handle.scale.set(1, 1, 0.5);
      handle.position.set((tub.halfWidthAt(zc, 0.93) + 0.004) * s, 0.93, zc);
      group.add(handle);
    }
  }
  const L = (pts: [number, number][], w = 0.008) => addSideLine(group, d, mats.line, tub, pts, w);
  // Puertas (cada una: borde delantero, trasero y la línea baja).
  const vert = (z: number, y0 = 0.34, y1 = 0.97): [number, number][] => Array.from({ length: 9 }, (_, i) => [z, y0 + ((y1 - y0) * i) / 8]);
  L(vert(0.68));
  L(vert(-0.26));
  L(vert(-1.24));
  L([
    [0.68, 0.34],
    [-1.24, 0.34],
  ], 0.01);
  // Cresta del costado (línea de carácter).
  L([
    [2.0, 0.66],
    [1.0, 0.8],
    [-1.0, 0.8],
    [-2.0, 0.84],
  ], 0.006);
  // Defensas / cofre / cajuela: líneas sobre la cara superior.
  const top = (x: number, z: number, y: number): [number, number, number] => [x, y, z];
  const hoodLine = (s: number) => {
    const pts: [number, number, number][] = [];
    for (let z = 0.8; z <= 2.05; z += 0.125) pts.push(top(0.62 * s, z, tub.topAt(z) + 0.0015));
    return pts;
  };
  void hoodLine;
}

export function createCarModel(colors: GarmentColors): GarmentModel {
  return finishVehicle(buildCar(), { body: "#f4f4f5" }, colors, "car");
}
