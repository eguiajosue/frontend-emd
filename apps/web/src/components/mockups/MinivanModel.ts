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
  roundedBox,
  sideHalfWidth,
  sideWindow,
  slopedGlass,
  type Pt,
  type WheelArch,
} from "./vehicleKit";
import { finishVehicle, type VehicleBuild } from "./vehicleModel";

/**
 * Minivan: silueta alta de una sola caja, parabrisas muy inclinado, puerta
 * corrediza con su riel y medallón casi vertical. Medidas en metros
 * (≈ 5.1 × 1.98 × 1.75).
 */

export const MINIVAN = {
  wheelbaseFront: 1.6,
  wheelbaseRear: -1.4,
  wheelRadius: 0.36,
  track: 0.84,
};

export function buildMinivan(): VehicleBuild {
  const d = new Disposer();
  const mats = createMaterials(d);
  const group = new THREE.Group();
  group.name = "minivan";
  const targets: THREE.Mesh[] = [];
  const archR = MINIVAN.wheelRadius + 0.07;
  const arches: WheelArch[] = [
    { z: MINIVAN.wheelbaseFront, y: MINIVAN.wheelRadius, r: archR, floor: 0.66 },
    { z: MINIVAN.wheelbaseRear, y: MINIVAN.wheelRadius, r: archR, floor: 0.66 },
  ];
  cutWheelArches(mats.paint, arches);

  const tub = loftBody({
    keys: [
      { z: -2.55, w: 0.88, y0: 0.4, y1: 1.1, rb: 0.12, rt: 0.2 },
      { z: -2.1, w: 0.96, y0: 0.3, y1: 1.12, rb: 0.14, rt: 0.2 },
      { z: -1.5, w: 0.99, y0: 0.24, y1: 1.1, rb: 0.16, rt: 0.18 },
      { z: 0.0, w: 0.99, y0: 0.22, y1: 1.06, rb: 0.16, rt: 0.17 },
      { z: 1.05, w: 0.99, y0: 0.22, y1: 1.02, rb: 0.16, rt: 0.17 },
      { z: 1.6, w: 0.97, y0: 0.24, y1: 0.92, rb: 0.16, rt: 0.2 },
      { z: 2.1, w: 0.94, y0: 0.28, y1: 0.84, rb: 0.14, rt: 0.22 },
      { z: 2.55, w: 0.88, y0: 0.32, y1: 0.78, rb: 0.12, rt: 0.22 },
    ],
    rear: { len: 0.4, p: 3.4, q: 6 },
    front: { len: 0.5, p: 3.4, q: 6 },
    step: 0.1,
    segs: { bottom: 4, corner: 7, side: 26, top: 8 },
  });
  d.track(tub.geometry);
  const tubMesh = new THREE.Mesh(tub.geometry, mats.paint);
  tubMesh.name = "minivan-body";
  tubMesh.castShadow = true;
  group.add(tubMesh);
  targets.push(tubMesh);
  addWheelWells(group, d, mats, arches, 1.0);

  const yBase = 1.0;
  const yTop = 1.76;
  const profile: Pt[] = [
    [1.12, 0.95],
    [1.12, yBase],
    [0.5, 1.7],
    [0.42, 1.76],
    [-2.12, 1.76],
    [-2.2, 1.72],
    [-2.36, 1.22],
    [-2.37, 1.1],
    [-2.37, 0.95],
  ];
  const cabinOpts = { halfWidth: 0.92, taper: 0.11, bevel: 0.04, yBase, yTop };
  const cabin = new THREE.Mesh(d.track(extrudeSide(profile, cabinOpts)), mats.paint);
  cabin.name = "minivan-roof";
  cabin.castShadow = true;
  group.add(cabin);
  targets.push(cabin);

  const hw = (y: number) => sideHalfWidth(cabinOpts, y);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    const m = new THREE.Mesh(d.track(geo), mat);
    m.name = name;
    group.add(m);
  };
  const windows: Pt[][] = [
    [
      [0.98, 1.2],
      [0.56, 1.64],
      [0.2, 1.64],
      [0.2, 1.2],
    ],
    [
      [0.04, 1.2],
      [0.04, 1.64],
      [-1.2, 1.64],
      [-1.2, 1.2],
    ],
    [
      [-1.4, 1.2],
      [-1.4, 1.64],
      [-1.98, 1.64],
      [-2.2, 1.3],
    ],
  ];
  for (const poly of windows) {
    const g = sideWindow(poly, hw, 0.004, [0.05, 0.02, 0.02, 0.02]);
    add(g, mats.glass, "minivan-window");
    add(mirrorX(g), mats.glass, "minivan-window");
  }
  add(slopedGlass([1.12, 1.02], [0.5, 1.7], hw, { inset: 0.08, startInset: 0.1, endInset: 0.08 }), mats.glass, "minivan-windshield");
  add(slopedGlass([-2.2, 1.7], [-2.36, 1.22], hw, { inset: 0.08, startInset: 0.06, endInset: 0.06 }), mats.glass, "minivan-rear-window");

  const lampGeo = d.track(new THREE.SphereGeometry(0.5, 20, 12));
  for (const s of [1, -1] as const) {
    const lamp = new THREE.Mesh(lampGeo, mats.headlamp);
    lamp.scale.set(0.36, 0.11, 0.1);
    placeOnEdge(lamp, tub, 0.66, 0.62, "front", s, 0.1, 0.5);
    group.add(lamp);
    const tail = roundedBox(d, mats.taillamp, [0.1, 0.5, 0.07], 0.03, [0, 0, 0], 4);
    placeOnEdge(tail, tub, 0.86, 1.05, "rear", s, 0.07);
    group.add(tail);
  }
  const front0 = tub.edgeAt(0.001, 0.5, "front").z;
  const rear0 = tub.edgeAt(0.001, 0.6, "rear").z;
  group.add(roundedBox(d, mats.trim, [1.05, 0.14, 0.05], 0.03, [0, 0.55, front0 - 0.02]));
  group.add(roundedBox(d, mats.trim, [0.8, 0.07, 0.05], 0.025, [0, 0.4, front0 - 0.03]));
  group.add(roundedBox(d, mats.plate, [0.3, 0.14, 0.02], 0.01, [0, 0.48, front0 - 0.005]));
  group.add(roundedBox(d, mats.plate, [0.3, 0.14, 0.02], 0.01, [0, 0.72, rear0]));
  group.add(roundedBox(d, mats.trim, [1.1, 0.12, 0.04], 0.02, [0, 0.44, rear0]));

  const mirrorGeo = d.track(new THREE.SphereGeometry(0.5, 16, 12));
  for (const s of [1, -1]) {
    const mirror = new THREE.Mesh(mirrorGeo, mats.trim);
    mirror.scale.set(0.1, 0.15, 0.2);
    mirror.position.set(1.0 * s, 1.2, 0.95);
    mirror.castShadow = true;
    group.add(mirror);
    group.add(roundedBox(d, mats.trim, [0.12, 0.04, 0.07], 0.012, [0.94 * s, 1.16, 0.98]));
  }

  const handleGeo = d.track(new THREE.CapsuleGeometry(0.012, 0.16, 4, 8));
  for (const s of [1, -1]) {
    for (const zc of [0.6, -0.2]) {
      const handle = new THREE.Mesh(handleGeo, mats.chrome);
      handle.rotation.x = Math.PI / 2;
      handle.scale.set(1, 1, 0.5);
      handle.position.set((tub.halfWidthAt(zc, 1.0) + 0.004) * s, 1.0, zc);
      group.add(handle);
    }
  }
  const L = (pts: [number, number][], w = 0.008) => addSideLine(group, d, mats.line, tub, pts, w);
  const vert = (z: number, y0 = 0.36, y1 = 1.12): [number, number][] => Array.from({ length: 9 }, (_, i) => [z, y0 + ((y1 - y0) * i) / 8]);
  L(vert(1.08));
  L(vert(0.12));
  // Puerta corrediza: borde delantero, riel superior e inferior y borde trasero.
  L(vert(-1.32));
  L([
    [0.12, 1.1],
    [-1.32, 1.1],
    [-1.55, 1.06],
    [-2.2, 1.06],
  ], 0.012);
  L([
    [0.12, 0.4],
    [-1.32, 0.4],
    [-1.55, 0.4],
    [-2.2, 0.4],
  ], 0.012);
  L([
    [1.08, 0.38],
    [0.12, 0.38],
  ], 0.01);

  addWheels(group, d, mats, { radius: MINIVAN.wheelRadius, width: 0.215, rimRadius: 0.24, spokes: 6 }, [
    { x: MINIVAN.track, z: MINIVAN.wheelbaseFront },
    { x: -MINIVAN.track, z: MINIVAN.wheelbaseFront },
    { x: MINIVAN.track, z: MINIVAN.wheelbaseRear },
    { x: -MINIVAN.track, z: MINIVAN.wheelbaseRear },
  ]);

  return {
    group,
    disposer: d,
    paints: [{ part: "body", material: mats.paint }],
    targets,
    depth: (scale) => Math.min(0.1, Math.max(0.02, scale * 0.45)),
  };
}

export function createMinivanModel(colors: GarmentColors): GarmentModel {
  return finishVehicle(buildMinivan(), { body: "#f4f4f5" }, colors, "minivan");
}
