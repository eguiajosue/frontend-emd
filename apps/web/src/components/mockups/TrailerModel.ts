import * as THREE from "three";
import type { GarmentColors, VehiclePart } from "@/lib/mockups/types";
import type { GarmentModel } from "./garmentModel";
import {
  Disposer,
  addSideLine,
  addWheels,
  createMaterials,
  extrudeSide,
  loftBody,
  mirrorX,
  placeOnEdge,
  roundedBox,
  sideHalfWidth,
  sideWindow,
  slopedGlass,
  type Pt,
  type VehicleMaterials,
} from "./vehicleKit";
import { finishVehicle, type VehicleBuild } from "./vehicleModel";

/**
 * Tráiler: tractocamión con cabina dormitorio (cofre, parabrisas, defensa
 * cromada, tanques, escapes, quinta rueda, llantas dobles) y caja seca
 * blanca de 13.4 m (costados lisos para rotular, puertas traseras, patas de
 * apoyo, llantas dobles). Se puede armar completo, sólo la cabina o sólo la
 * caja. Medidas en metros; el perno de la quinta rueda es el origen en z.
 */

export const TRAILER = {
  /** Eje direccional y ejes de tracción (tándem). */
  steerZ: 5.6,
  driveZ: [0.55, -0.8],
  /** Caja. */
  boxFront: 0.85,
  boxRear: -12.55,
  boxBottom: 1.2,
  boxTop: 4.05,
  boxHalfWidth: 1.3,
  boxAxlesZ: [-10.6, -11.9],
  wheelRadius: 0.52,
  /** Límite en z entre cabina (adelante) y caja (atrás), en metros. */
  cabEndZ: 1.9,
};

function wheelSpec(radius = TRAILER.wheelRadius) {
  return { radius, width: 0.295, rimRadius: 0.29, disc: true as const };
}

function buildCab(group: THREE.Group, d: Disposer, mats: VehicleMaterials, targets: THREE.Mesh[]) {
  const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string, target = false) => {
    const m = new THREE.Mesh(d.track(geo), mat);
    m.name = name;
    m.castShadow = true;
    group.add(m);
    if (target) targets.push(m);
    return m;
  };

  // Cofre largo.
  const hood = loftBody({
    keys: [
      { z: 4.95, w: 0.8, y0: 1.0, y1: 2.38, rb: 0.08, rt: 0.2 },
      { z: 6.1, w: 0.8, y0: 1.0, y1: 2.28, rb: 0.08, rt: 0.2 },
      { z: 7.0, w: 0.78, y0: 1.0, y1: 2.12, rb: 0.08, rt: 0.18 },
    ],
    front: { len: 0.18, p: 5, q: 8 },
    step: 0.4,
    segs: { bottom: 2, corner: 6, side: 12, top: 6 },
  });
  addMesh(hood.geometry, mats.paint, "trailer-hood", true);

  // Cabina con dormitorio.
  const yBase = 0.95;
  const yTop = 3.52;
  const profile: Pt[] = [
    [5.0, yBase],
    [5.0, 2.36],
    [4.7, 3.14],
    [4.62, 3.22],
    [3.62, 3.22],
    [3.56, 3.34],
    [2.1, 3.52],
    [1.98, 3.48],
    [1.94, 3.3],
    [1.94, yBase],
  ];
  const lower: Pt[] = [
    [5.0, yBase],
    [5.0, 2.42],
    [1.94, 2.42],
    [1.94, yBase],
  ];
  addMesh(extrudeSide(lower, { halfWidth: 1.2, bevel: 0.05, yBase, yTop: 2.42 }), mats.paint, "trailer-cab-body", true);
  const upperProfile: Pt[] = profile.map(([z, y]) => [z, Math.max(y, 2.3)] as Pt);
  const upperOpts = { halfWidth: 1.2, taper: 0.07, bevel: 0.06, yBase: 2.3, yTop };
  addMesh(extrudeSide(upperProfile, upperOpts), mats.paint, "trailer-cab-roof", true);

  // Vidrios.
  const hw = (y: number) => sideHalfWidth(upperOpts, Math.max(y, 2.3));
  const windows: Pt[][] = [
    [
      [4.9, 2.52],
      [4.6, 3.08],
      [3.95, 3.08],
      [3.95, 2.52],
    ],
    [
      [3.55, 2.9],
      [3.55, 3.18],
      [3.0, 3.22],
      [3.0, 2.9],
    ],
  ];
  for (const poly of windows) {
    const g = sideWindow(poly, hw, 0.004, [0.05, 0.03, 0.03, 0.03]);
    addMesh(g, mats.glass, "trailer-window");
    addMesh(mirrorX(g), mats.glass, "trailer-window");
  }
  addMesh(slopedGlass([5.0, 2.4], [4.7, 3.14], hw, { inset: 0.1, startInset: 0.1, endInset: 0.1 }), mats.glass, "trailer-windshield");

  // Frente: parrilla, faros y defensa cromada.
  group.add(roundedBox(d, mats.chrome, [1.3, 1.25, 0.1], 0.06, [0, 1.55, 7.0], 3));
  group.add(roundedBox(d, mats.trim, [1.1, 1.05, 0.06], 0.04, [0, 1.55, 7.055], 3));
  for (let i = 0; i < 5; i++) group.add(roundedBox(d, mats.chrome, [1.1, 0.025, 0.04], 0.01, [0, 1.15 + i * 0.2, 7.09], 2));
  for (const s of [1, -1]) {
    group.add(roundedBox(d, mats.headlamp, [0.42, 0.34, 0.12], 0.06, [0.78 * s, 1.95, 6.92], 4));
    group.add(roundedBox(d, mats.amber, [0.14, 0.12, 0.1], 0.04, [0.9 * s, 1.58, 6.9], 3));
  }
  group.add(roundedBox(d, mats.chrome, [2.3, 0.34, 0.26], 0.12, [0, 0.62, 7.2], 4));
  group.add(roundedBox(d, mats.trim, [1.6, 0.14, 0.2], 0.05, [0, 0.45, 7.12], 2));
  group.add(roundedBox(d, mats.plate, [0.5, 0.25, 0.02], 0.01, [0, 0.68, 7.34]));

  // Salpicaderas sobre las llantas direccionales y estribos.
  const fenderGeo = d.track(new THREE.CylinderGeometry(0.64, 0.64, 0.48, 28, 1, true, 0, Math.PI));
  fenderGeo.rotateZ(Math.PI / 2);
  for (const s of [1, -1]) {
    const fender = new THREE.Mesh(fenderGeo, mats.paint);
    fender.position.set(0.92 * s, TRAILER.wheelRadius, TRAILER.steerZ);
    fender.castShadow = true;
    group.add(fender);
    group.add(roundedBox(d, mats.trim, [0.3, 0.05, 0.7], 0.02, [1.28 * s, 0.82, 4.55]));
  }

  // Espejos largos, luces de techo y barandal de cabina.
  for (const s of [1, -1]) {
    group.add(roundedBox(d, mats.trim, [0.1, 0.62, 0.26], 0.04, [1.5 * s, 2.85, 4.98], 3));
    group.add(roundedBox(d, mats.chrome, [0.34, 0.03, 0.03], 0.012, [1.32 * s, 3.0, 4.9]));
    group.add(roundedBox(d, mats.chrome, [0.34, 0.03, 0.03], 0.012, [1.32 * s, 2.55, 4.9]));
  }
  for (let i = -2; i <= 2; i++) group.add(roundedBox(d, mats.amber, [0.16, 0.07, 0.07], 0.02, [i * 0.32, 3.26, 4.52]));

  // Tanques de combustible, escapes y quinta rueda.
  const tankGeo = d.track(new THREE.CylinderGeometry(0.34, 0.34, 1.35, 24));
  tankGeo.rotateX(Math.PI / 2);
  for (const s of [1, -1]) {
    const tank = new THREE.Mesh(tankGeo, mats.chrome);
    tank.position.set(1.12 * s, 0.82, 3.0);
    group.add(tank);
    const stack = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.075, 0.075, 2.6, 14)), mats.chrome);
    stack.position.set(1.12 * s, 2.7, 1.55);
    group.add(stack);
    const cap = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.065, 0.075, 0.2, 14)), mats.trim);
    cap.position.set(1.12 * s, 4.05, 1.55);
    group.add(cap);
  }
  // Largueros del chasis y quinta rueda.
  group.add(roundedBox(d, mats.liner, [0.95, 0.28, 8.1], 0.04, [0, 0.95, 3.0], 2));
  const fifth = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 32)), mats.trim);
  fifth.position.set(0, 1.16, 0.0);
  group.add(fifth);
  // Ejes de tracción (carcasas).
  const axleGeo = d.track(new THREE.CylinderGeometry(0.11, 0.11, 2.2, 14));
  axleGeo.rotateZ(Math.PI / 2);
  for (const z of [TRAILER.steerZ, ...TRAILER.driveZ]) {
    const axle = new THREE.Mesh(axleGeo, mats.liner);
    axle.position.set(0, TRAILER.wheelRadius, z);
    group.add(axle);
  }
  // Manijas y líneas de puerta.
  const hwDoor = (y: number) => sideHalfWidth({ halfWidth: 1.2, taper: 0.07, yBase: 2.3, yTop: 3.52 }, Math.max(y, 2.3));
  const doorLoft = { halfWidthAt: (_z: number, y?: number) => (y !== undefined && y < 2.4 ? 1.2 : hwDoor(y ?? 1)) } as never;
  const L = (pts: [number, number][], w = 0.01) => addSideLine(group, d, mats.line, doorLoft, pts, w);
  const vert = (z: number, y0 = 1.05, y1 = 3.14): [number, number][] => Array.from({ length: 12 }, (_, i) => [z, y0 + ((y1 - y0) * i) / 11]);
  L(vert(4.72, 1.05, 2.4));
  L(vert(3.85, 1.05, 3.2));
  L([
    [4.72, 1.05],
    [3.85, 1.05],
  ]);
  const handleGeo = d.track(new THREE.CapsuleGeometry(0.015, 0.2, 4, 8));
  for (const s of [1, -1]) {
    const handle = new THREE.Mesh(handleGeo, mats.chrome);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(1.215 * s, 2.35, 4.05);
    group.add(handle);
  }
}

function buildBox(group: THREE.Group, d: Disposer, mats: VehicleMaterials, boxMat: THREE.Material, targets: THREE.Mesh[], standalone: boolean) {
  const { boxFront, boxRear, boxBottom, boxTop, boxHalfWidth: w } = TRAILER;
  const loft = loftBody({
    keys: [
      { z: boxRear, w, y0: boxBottom, y1: boxTop, rb: 0.05, rt: 0.12 },
      { z: boxFront, w, y0: boxBottom, y1: boxTop, rb: 0.05, rt: 0.12 },
    ],
    step: 3.2,
    segs: { bottom: 2, corner: 4, side: 6, top: 5 },
  });
  const box = new THREE.Mesh(d.track(loft.geometry), boxMat);
  box.name = "trailer-box";
  box.castShadow = true;
  group.add(box);
  targets.push(box);

  // Rieles y costuras (aluminio).
  const rail = (y: number, width: number, mat: THREE.Material = mats.seam) =>
    addSideLine(group, d, mat, loft, [[boxRear + 0.04, y], [boxFront - 0.04, y]], width, 0.003);
  rail(boxBottom + 0.12, 0.16);
  rail(boxTop - 0.1, 0.1);
  const posts = Math.round((boxFront - boxRear) / 1.6);
  for (let i = 1; i < posts; i++) {
    const z = boxRear + ((boxFront - boxRear) * i) / posts;
    addSideLine(group, d, mats.seam, loft, [[z, boxBottom + 0.2], [z, boxTop - 0.12]], 0.025, 0.002);
  }

  // Puertas traseras: costura central, herrajes y barras de cierre.
  const zr = boxRear - 0.004;
  group.add(roundedBox(d, mats.seam, [0.025, boxTop - boxBottom - 0.3, 0.012], 0.005, [0, (boxTop + boxBottom) / 2, zr], 1));
  for (const s of [1, -1]) {
    for (const x of [0.38, 0.98]) {
      const bar = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.02, 0.02, boxTop - boxBottom - 0.25, 10)), mats.chrome);
      bar.position.set(x * s, (boxTop + boxBottom) / 2, zr - 0.035);
      group.add(bar);
      for (const y of [boxBottom + 0.3, boxTop - 0.3]) {
        group.add(roundedBox(d, mats.chrome, [0.07, 0.06, 0.05], 0.015, [x * s, y, zr - 0.035], 1));
      }
    }
    for (const y of [1.7, 2.6, 3.5]) group.add(roundedBox(d, mats.trim, [0.1, 0.1, 0.03], 0.012, [1.22 * s, y, zr - 0.01], 1));
    // Calaveras y luces laterales.
    for (const y of [1.55, 1.78]) group.add(roundedBox(d, mats.taillamp, [0.24, 0.17, 0.05], 0.05, [1.12 * s, y, zr - 0.02], 3));
    group.add(roundedBox(d, mats.amber, [0.24, 0.12, 0.05], 0.04, [1.12 * s, 1.37, zr - 0.02], 3));
  }
  // Defensa trasera antiempotramiento y loderas.
  group.add(roundedBox(d, mats.trim, [2.4, 0.22, 0.14], 0.03, [0, 0.7, boxRear - 0.1], 2));
  group.add(roundedBox(d, mats.plate, [0.5, 0.26, 0.02], 0.01, [0, 1.15, zr - 0.012]));
  for (const s of [1, -1]) {
    for (const z of [boxRear + 0.4]) group.add(roundedBox(d, mats.trim, [0.02, 0.55, 0.62], 0.005, [1.06 * s, 0.55, z], 1));
  }
  // Faldones laterales aerodinámicos.
  for (const s of [1, -1]) {
    group.add(roundedBox(d, boxMat, [0.025, 0.42, 7.2], 0.012, [1.27 * s, 0.97, -4.2], 1));
  }
  // Patas de apoyo.
  const legLen = standalone ? boxBottom : boxBottom - 0.55;
  for (const s of [1, -1]) {
    const leg = roundedBox(d, mats.liner, [0.16, legLen, 0.16], 0.02, [1.0 * s, boxBottom - legLen / 2, -2.2], 1);
    group.add(leg);
    group.add(roundedBox(d, mats.trim, [0.4, 0.05, 0.4], 0.015, [1.0 * s, boxBottom - legLen + 0.025, -2.2], 1));
  }
  group.add(roundedBox(d, mats.liner, [2.0, 0.1, 0.1], 0.02, [0, boxBottom - 0.25, -2.2], 1));
  // Ejes del tándem.
  const axleGeo = d.track(new THREE.CylinderGeometry(0.11, 0.11, 2.2, 14));
  axleGeo.rotateZ(Math.PI / 2);
  for (const z of TRAILER.boxAxlesZ) {
    const axle = new THREE.Mesh(axleGeo, mats.liner);
    axle.position.set(0, TRAILER.wheelRadius, z);
    group.add(axle);
  }
  group.add(roundedBox(d, mats.liner, [1.9, 0.22, 2.7], 0.03, [0, 1.0, -11.25], 1));
  void placeOnEdge;
}

export function buildTrailer(part: VehiclePart = "full"): VehicleBuild {
  const d = new Disposer();
  const mats = createMaterials(d);
  const boxPaint = d.track(mats.paint.clone());
  boxPaint.color.set("#ffffff");
  mats.paint.side = THREE.FrontSide;
  const group = new THREE.Group();
  group.name = `trailer-${part}`;
  const targets: THREE.Mesh[] = [];
  const paints: VehicleBuild["paints"] = [];

  const wheels: { x: number; z: number }[] = [];
  const innerWheels: { x: number; z: number }[] = [];
  if (part !== "box") {
    buildCab(group, d, mats, targets);
    paints.push({ part: "body", material: mats.paint });
    for (const s of [1, -1]) wheels.push({ x: 0.92 * s, z: TRAILER.steerZ });
    for (const z of TRAILER.driveZ) {
      for (const s of [1, -1]) {
        wheels.push({ x: 0.98 * s, z });
        innerWheels.push({ x: 0.64 * s, z });
      }
    }
  }
  if (part !== "cab") {
    buildBox(group, d, mats, boxPaint, targets, part === "box");
    paints.push({ part: "mesh", material: boxPaint });
    for (const z of TRAILER.boxAxlesZ) {
      for (const s of [1, -1]) {
        wheels.push({ x: 0.98 * s, z });
        innerWheels.push({ x: 0.64 * s, z });
      }
    }
  }
  addWheels(group, d, mats, wheelSpec(), wheels);
  addWheels(group, d, mats, wheelSpec(), innerWheels, { tiresOnly: true });

  return {
    group,
    disposer: d,
    paints,
    targets,
    depth: (scale) => Math.min(0.14, Math.max(0.03, scale * 0.4)),
    elevation: 0.12,
  };
}

export function createTrailerModel(colors: GarmentColors, part: VehiclePart = "full"): GarmentModel {
  return finishVehicle(buildTrailer(part), { body: "#1f2a44", mesh: "#ffffff" }, colors, "trailer");
}
