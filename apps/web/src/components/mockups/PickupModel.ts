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
 * Pickup de doble cabina con caja descubierta: cofre y salpicaderas, cabina
 * con cuatro puertas, caja con costados, cabecera, piso con cubierta y
 * compuerta. Medidas en metros (≈ 5.4 × 1.9 × 1.8).
 */

export const PICKUP = {
  wheelbaseFront: 1.75,
  wheelbaseRear: -1.45,
  wheelRadius: 0.38,
  track: 0.8,
  bedFront: -1.0,
  bedRear: -2.62,
  bedTop: 1.22,
};

/** Polígono (z, y) del costado de la caja, con el hueco de la rueda trasera. */
export function pickupBedWallProfile(): Pt[] {
  const { bedFront, bedRear, bedTop, wheelbaseRear, wheelRadius } = PICKUP;
  const r = wheelRadius + 0.075;
  const cy = wheelRadius;
  const yBottom = 0.44;
  const dz = Math.sqrt(r * r - (yBottom - cy) ** 2);
  const a0 = Math.atan2(yBottom - cy, -dz);
  const pts: Pt[] = [
    [bedRear, yBottom],
    [wheelbaseRear - dz, yBottom],
  ];
  const n = 28;
  // Del lado trasero (ángulo ≈ π) pasando por arriba hasta el lado delantero.
  for (let i = 1; i < n; i++) {
    const a = a0 - ((a0 - (Math.PI - a0)) * i) / n;
    pts.push([wheelbaseRear + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  pts.push([wheelbaseRear + dz, yBottom], [bedFront, yBottom], [bedFront, bedTop], [bedRear, bedTop]);
  return pts;
}

export function buildPickup(): VehicleBuild {
  const d = new Disposer();
  const mats = createMaterials(d);
  const group = new THREE.Group();
  group.name = "pickup";
  const targets: THREE.Mesh[] = [];
  const archR = PICKUP.wheelRadius + 0.075;
  const frontArch: WheelArch = { z: PICKUP.wheelbaseFront, y: PICKUP.wheelRadius, r: archR, floor: 0.68 };
  const rearArch: WheelArch = { z: PICKUP.wheelbaseRear, y: PICKUP.wheelRadius, r: archR, floor: 0.68 };
  cutWheelArches(mats.paint, [frontArch]);

  // Cofre y salpicaderas.
  const tub = loftBody({
    keys: [
      { z: 1.0, w: 0.95, y0: 0.36, y1: 1.12, rb: 0.15, rt: 0.2 },
      { z: 1.6, w: 0.95, y0: 0.36, y1: 1.12, rb: 0.15, rt: 0.2 },
      { z: 2.2, w: 0.94, y0: 0.38, y1: 1.08, rb: 0.14, rt: 0.2 },
      { z: 2.65, w: 0.9, y0: 0.42, y1: 1.0, rb: 0.12, rt: 0.2 },
    ],
    front: { len: 0.42, p: 3.6, q: 6 },
    step: 0.1,
    segs: { bottom: 3, corner: 7, side: 26, top: 8 },
  });
  d.track(tub.geometry);
  const tubMesh = new THREE.Mesh(tub.geometry, mats.paint);
  tubMesh.name = "pickup-hood";
  tubMesh.castShadow = true;
  group.add(tubMesh);
  targets.push(tubMesh);
  addWheelWells(group, d, mats, [frontArch], 0.96);

  // Cabina doble: puertas (cuerpo recto) y techo con los pilares inclinados.
  const yBase = 1.0;
  const yTop = 1.8;
  const bodyProfile: Pt[] = [
    [1.0, 0.36],
    [1.0, 1.14],
    [-0.92, 1.14],
    [-0.92, 0.36],
  ];
  const doorBody = new THREE.Mesh(
    d.track(extrudeSide(bodyProfile, { halfWidth: 0.94, bevel: 0.035, yBase: 0.36, yTop: 1.14 })),
    mats.paint,
  );
  doorBody.name = "pickup-cab-doors";
  doorBody.castShadow = true;
  group.add(doorBody);
  targets.push(doorBody);
  const cabProfile: Pt[] = [
    [1.0, yBase],
    [1.0, 1.1],
    [0.4, 1.76],
    [0.34, 1.8],
    [-0.8, 1.8],
    [-0.86, 1.76],
    [-0.9, 1.3],
    [-0.92, 1.1],
    [-0.92, yBase],
  ];
  const cabOpts = { halfWidth: 0.94, taper: 0.1, bevel: 0.04, yBase, yTop };
  const cab = new THREE.Mesh(d.track(extrudeSide(cabProfile, cabOpts)), mats.paint);
  cab.name = "pickup-cab";
  cab.castShadow = true;
  group.add(cab);
  targets.push(cab);

  const hw = (y: number) => sideHalfWidth(cabOpts, y);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    const m = new THREE.Mesh(d.track(geo), mat);
    m.name = name;
    group.add(m);
    return m;
  };
  const windows: Pt[][] = [
    [
      [0.9, 1.22],
      [0.5, 1.7],
      [0.2, 1.7],
      [0.2, 1.22],
    ],
    [
      [0.06, 1.22],
      [0.06, 1.7],
      [-0.7, 1.7],
      [-0.7, 1.22],
    ],
  ];
  for (const poly of windows) {
    const g = sideWindow(poly, hw, 0.004, [0.05, 0.02, 0.02, 0.02]);
    add(g, mats.glass, "pickup-window");
    add(mirrorX(g), mats.glass, "pickup-window");
  }
  add(slopedGlass([1.0, 1.12], [0.4, 1.76], hw, { inset: 0.08, startInset: 0.1, endInset: 0.08 }), mats.glass, "pickup-windshield");
  add(slopedGlass([-0.85, 1.74], [-0.9, 1.32], hw, { inset: 0.3, startInset: 0.04, endInset: 0.04 }), mats.glass, "pickup-back-window");

  // Caja: costados con el hueco de la rueda, piso, cabecera y compuerta.
  const wallThickness = 0.08;
  const wallGeo = d.track(
    extrudeSide(pickupBedWallProfile(), { halfWidth: wallThickness / 2, bevel: 0.012, yBase: 0.4, yTop: PICKUP.bedTop, bevelSegments: 2 }),
  );
  wallGeo.translate(0.95 - wallThickness / 2, 0, 0);
  const wallL = new THREE.Mesh(wallGeo, mats.paint);
  wallL.name = "pickup-bed-left";
  wallL.castShadow = true;
  const wallR = new THREE.Mesh(d.track(mirrorX(wallGeo)), mats.paint);
  wallR.name = "pickup-bed-right";
  wallR.castShadow = true;
  group.add(wallL, wallR);
  targets.push(wallL, wallR);
  addWheelWells(group, d, mats, [rearArch], 0.95);

  const bedLen = PICKUP.bedFront - PICKUP.bedRear;
  const bedMid = (PICKUP.bedFront + PICKUP.bedRear) / 2;
  group.add(roundedBox(d, mats.liner, [1.78, 0.06, bedLen], 0.01, [0, 0.8, bedMid], 2));
  // Cabecera (frente de la caja).
  group.add(roundedBox(d, mats.paint, [1.78, 0.4, 0.07], 0.02, [0, 1.0, PICKUP.bedFront + 0.03], 2));
  // Pasos de rueda dentro de la caja.
  for (const s of [1, -1]) {
    group.add(roundedBox(d, mats.liner, [0.2, 0.3, 0.95], 0.06, [0.78 * s, 0.92, PICKUP.wheelbaseRear], 3));
  }
  // Compuerta.
  const tailgate = roundedBox(d, mats.paint, [1.84, 0.74, 0.07], 0.025, [0, 0.82, PICKUP.bedRear - 0.0], 3);
  tailgate.name = "pickup-tailgate";
  tailgate.castShadow = true;
  group.add(tailgate);
  targets.push(tailgate);
  group.add(roundedBox(d, mats.trim, [0.5, 0.05, 0.03], 0.012, [0, 1.12, PICKUP.bedRear - 0.045], 2));
  // Defensa trasera y calaveras.
  group.add(roundedBox(d, mats.trim, [1.94, 0.18, 0.16], 0.04, [0, 0.5, PICKUP.bedRear - 0.08], 3));
  group.add(roundedBox(d, mats.plate, [0.32, 0.15, 0.02], 0.01, [0, 0.82, PICKUP.bedRear - 0.045]));
  for (const s of [1, -1]) {
    group.add(roundedBox(d, mats.taillamp, [0.08, 0.34, 0.1], 0.03, [0.905 * s, 0.94, PICKUP.bedRear - 0.02], 3));
  }
  // Bastidor oscuro bajo la carrocería.
  group.add(roundedBox(d, mats.liner, [1.3, 0.3, 5.0], 0.05, [0, 0.45, 0.0], 2));

  // Frente: faros, parrilla y defensa.
  const lampGeo = d.track(new THREE.SphereGeometry(0.5, 20, 12));
  for (const s of [1, -1] as const) {
    const lamp = new THREE.Mesh(lampGeo, mats.headlamp);
    lamp.scale.set(0.36, 0.15, 0.12);
    placeOnEdge(lamp, tub, 0.68, 0.8, "front", s, 0.12, 0.5);
    group.add(lamp);
  }
  const front0 = tub.edgeAt(0.001, 0.7, "front").z;
  group.add(roundedBox(d, mats.trim, [0.98, 0.28, 0.05], 0.04, [0, 0.82, front0 - 0.02]));
  group.add(roundedBox(d, mats.chrome, [0.98, 0.04, 0.06], 0.015, [0, 0.9, front0 - 0.025]));
  group.add(roundedBox(d, mats.trim, [1.5, 0.2, 0.1], 0.05, [0, 0.5, front0 - 0.02]));
  group.add(roundedBox(d, mats.plate, [0.34, 0.15, 0.02], 0.01, [0, 0.52, front0 + 0.03]));

  // Espejos de remolque.
  for (const s of [1, -1]) {
    group.add(roundedBox(d, mats.trim, [0.08, 0.26, 0.17], 0.03, [1.03 * s, 1.42, 0.78], 3));
    group.add(roundedBox(d, mats.trim, [0.12, 0.03, 0.04], 0.012, [0.97 * s, 1.34, 0.86]));
  }

  // Manijas y líneas de puertas.
  const handleGeo = d.track(new THREE.CapsuleGeometry(0.012, 0.14, 4, 8));
  for (const s of [1, -1]) {
    for (const zc of [0.3, -0.3]) {
      const handle = new THREE.Mesh(handleGeo, mats.chrome);
      handle.rotation.x = Math.PI / 2;
      handle.scale.set(1, 1, 0.5);
      handle.position.set((hw(1.15) + 0.004) * s, 1.15, zc);
      group.add(handle);
    }
  }
  const cabLine = (pts: [number, number][], w = 0.008) => {
    addSideLine(group, d, mats.line, { halfWidthAt: (_z: number, y?: number) => hw(y ?? 1) } as never, pts, w);
  };
  const vert = (z: number, y0 = 0.4, y1 = 1.14): [number, number][] => Array.from({ length: 9 }, (_, i) => [z, y0 + ((y1 - y0) * i) / 8]);
  cabLine(vert(0.12));
  cabLine(vert(-0.86));
  cabLine([
    [1.0, 0.42],
    [-0.86, 0.42],
  ], 0.01);

  addWheels(group, d, mats, { radius: PICKUP.wheelRadius, width: 0.245, rimRadius: 0.25, spokes: 6 }, [
    { x: PICKUP.track, z: PICKUP.wheelbaseFront },
    { x: -PICKUP.track, z: PICKUP.wheelbaseFront },
    { x: PICKUP.track, z: PICKUP.wheelbaseRear },
    { x: -PICKUP.track, z: PICKUP.wheelbaseRear },
  ]);

  return {
    group,
    disposer: d,
    paints: [{ part: "body", material: mats.paint }],
    targets,
    depth: (scale) => Math.min(0.1, Math.max(0.02, scale * 0.45)),
  };
}

export function createPickupModel(colors: GarmentColors): GarmentModel {
  return finishVehicle(buildPickup(), { body: "#f4f4f5" }, colors, "pickup");
}
