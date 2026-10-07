import * as THREE from "three";
import type { GarmentColors } from "@/lib/mockups/types";
import type { GarmentModel } from "./garmentModel";
import { Disposer, createMaterials, roundedBox } from "./vehicleKit";
import { finishVehicle, type VehicleBuild } from "./vehicleModel";

/**
 * Bicicleta urbana de reparto: cuadro diamante con tubo diagonal ancho
 * (la zona de rotulado principal), horquilla, manubrio con canastilla al
 * frente, asiento, guardafangos, cadena y ruedas con rayos. Medidas en
 * metros (≈ 1.75 × 0.6 × 1.1) y se muestra a 2.5 veces su tamaño real para
 * que no se vea diminuta junto a los demás vehículos.
 */

export const BICYCLE = {
  wheelbaseFront: 0.56,
  wheelbaseRear: -0.56,
  wheelRadius: 0.34,
  /** Escala metros → escena. */
  scale: 0.25,
};

const WHEEL_SPOKES = 32;

/** Tubo plano (más alto que ancho) entre dos puntos del plano YZ. */
function flatTube(d: Disposer, mat: THREE.Material, a: [number, number], b: [number, number], thickX: number, thickPlane: number, name?: string) {
  const [z0, y0] = a;
  const [z1, y1] = b;
  const len = Math.hypot(z1 - z0, y1 - y0);
  const geo = d.track(new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(thickX, len, thickPlane);
  mesh.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2);
  // El eje Y del cilindro apunta del punto a al b: giro alrededor de X.
  mesh.rotation.x = Math.atan2(z1 - z0, y1 - y0);
  mesh.castShadow = true;
  if (name) mesh.name = name;
  return mesh;
}

function wheelRing(d: Disposer, mats: ReturnType<typeof createMaterials>, group: THREE.Group, z: number) {
  const R = BICYCLE.wheelRadius;
  const tireGeo = d.track(new THREE.TorusGeometry(R - 0.03, 0.03, 12, 48));
  tireGeo.rotateY(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, mats.rubber);
  tire.position.set(0, R, z);
  tire.castShadow = true;
  group.add(tire);
  const rimGeo = d.track(new THREE.TorusGeometry(R - 0.065, 0.012, 8, 48));
  rimGeo.rotateY(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, mats.alloy);
  rim.position.set(0, R, z);
  group.add(rim);
  const hub = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 14)), mats.chrome);
  hub.rotation.z = Math.PI / 2;
  hub.position.set(0, R, z);
  group.add(hub);
  const spokeLen = R - 0.065 - 0.02;
  const spokeGeo = d.track(new THREE.CylinderGeometry(0.0022, 0.0022, spokeLen, 4));
  const spokes = new THREE.InstancedMesh(spokeGeo, mats.chrome, WHEEL_SPOKES);
  d.track(spokes);
  const m = new THREE.Matrix4();
  const mid = 0.02 + spokeLen / 2;
  for (let i = 0; i < WHEEL_SPOKES; i++) {
    const a = (i / WHEEL_SPOKES) * Math.PI * 2;
    const lateral = i % 2 === 0 ? 0.012 : -0.012;
    // El cilindro apunta en Y: girado alrededor de X apunta (y: cos a, z: sin a) y se coloca a media altura del radio.
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
    m.compose(new THREE.Vector3(lateral, Math.cos(a) * mid, Math.sin(a) * mid), q, new THREE.Vector3(1, 1, 1));
    spokes.setMatrixAt(i, m);
  }
  spokes.instanceMatrix.needsUpdate = true;
  spokes.position.set(0, R, z);
  group.add(spokes);
}

export function buildBicycle(): VehicleBuild {
  const d = new Disposer();
  const mats = createMaterials(d, { metalness: 0.15, roughness: 0.3 });
  const group = new THREE.Group();
  group.name = "bicycle";
  const targets: THREE.Mesh[] = [];
  const R = BICYCLE.wheelRadius;
  const zf = BICYCLE.wheelbaseFront;
  const zr = BICYCLE.wheelbaseRear;
  const leather = d.track(new THREE.MeshStandardMaterial({ color: "#2c2018", roughness: 0.6 }));

  wheelRing(d, mats, group, zf);
  wheelRing(d, mats, group, zr);

  // Cuadro (puntos en (z, y)).
  const bb: [number, number] = [-0.03, 0.29];
  const seatTop: [number, number] = [-0.22, 0.88];
  const headBottom: [number, number] = [0.43, 0.74];
  const headTop: [number, number] = [0.45, 0.88];
  const frame = (a: [number, number], b: [number, number], tx: number, tp: number, name: string, target = false) => {
    const t = flatTube(d, mats.paint, a, b, tx, tp, name);
    group.add(t);
    if (target) targets.push(t);
    return t;
  };
  frame(bb, headBottom, 0.045, 0.09, "bicycle-down-tube", true);
  frame(seatTop, [0.435, 0.85], 0.03, 0.045, "bicycle-top-tube", true);
  frame(bb, seatTop, 0.034, 0.04, "bicycle-seat-tube");
  frame(headBottom, headTop, 0.05, 0.06, "bicycle-head-tube");
  // Vainas.
  for (const s of [1, -1]) {
    const lateral = 0.055 * s;
    const stayA = flatTube(d, mats.paint, bb, [zr, R], 0.022, 0.026);
    stayA.position.x = lateral * 0.7;
    group.add(stayA);
    const stayB = flatTube(d, mats.paint, seatTop, [zr, R], 0.02, 0.022);
    stayB.position.x = lateral * 0.7;
    group.add(stayB);
    // Horquilla.
    const fork = flatTube(d, mats.paint, [0.455, 0.76], [zf, R], 0.024, 0.032);
    fork.position.x = 0.052 * s;
    group.add(fork);
  }
  // Poste, asiento y manubrio.
  group.add(flatTube(d, mats.chrome, seatTop, [-0.25, 0.99], 0.03, 0.03));
  const saddle = new THREE.Mesh(d.track(new THREE.SphereGeometry(0.5, 20, 12)), leather);
  saddle.scale.set(0.15, 0.05, 0.27);
  saddle.position.set(0, 1.0, -0.25);
  saddle.castShadow = true;
  group.add(saddle);
  group.add(flatTube(d, mats.chrome, [0.45, 0.86], [0.4, 1.1], 0.026, 0.026));
  const bar = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.0125, 0.0125, 0.62, 12)), mats.chrome);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.1, 0.4);
  group.add(bar);
  for (const s of [1, -1]) {
    const grip = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.017, 0.017, 0.11, 12)), mats.rubber);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(0.3 * s, 1.1, 0.4);
    group.add(grip);
  }
  group.add(roundedBox(d, mats.chrome, [0.07, 0.035, 0.05], 0.01, [0, 1.1, 0.4], 2));

  // Guardafangos (franjas curvas sobre las ruedas).
  const fenderGeo = d.track(new THREE.CylinderGeometry(R + 0.028, R + 0.028, 0.08, 40, 1, true, Math.PI / 2 - 1.25, 2.5));
  fenderGeo.rotateZ(Math.PI / 2);
  for (const [z, name] of [
    [zf, "bicycle-fender-front"],
    [zr, "bicycle-fender-rear"],
  ] as const) {
    const f = new THREE.Mesh(fenderGeo, mats.paint);
    f.material = mats.paint;
    f.name = name;
    f.position.set(0, R, z);
    f.castShadow = true;
    group.add(f);
    if (name === "bicycle-fender-rear") targets.push(f);
  }
  mats.paint.side = THREE.DoubleSide;

  // Pedalier, bielas, pedales y cadena.
  const ring = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.095, 0.095, 0.012, 32)), mats.chrome);
  ring.rotation.z = Math.PI / 2;
  ring.position.set(0.075, bb[1], bb[0]);
  group.add(ring);
  for (const [s, a] of [
    [1, 0.5],
    [-1, 0.5 + Math.PI],
  ] as const) {
    const crank = new THREE.Mesh(d.track(new THREE.BoxGeometry(0.018, 0.17, 0.026)), mats.chrome);
    crank.position.set(0.09 * s, bb[1] - Math.cos(a) * 0.085, bb[0] + Math.sin(a) * 0.085);
    crank.rotation.x = Math.atan2(Math.sin(a), Math.cos(a));
    group.add(crank);
    const pedal = roundedBox(d, mats.rubber, [0.09, 0.02, 0.1], 0.008, [0.14 * s, bb[1] - Math.cos(a) * 0.17, bb[0] + Math.sin(a) * 0.17], 1);
    group.add(pedal);
  }
  const chainMat = d.track(new THREE.MeshStandardMaterial({ color: "#1a1a1c", roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }));
  const strand = (y0: number, y1: number) => {
    const t = flatTube(d, chainMat, [bb[0], y0], [zr, y1], 0.012, 0.012);
    t.position.x = 0.062;
    group.add(t);
  };
  strand(bb[1] + 0.095, R + 0.04);
  strand(bb[1] - 0.095, R - 0.04);

  // Canastilla al frente: cuerpo hueco con tres paneles planos.
  const bz = 0.64;
  const by = 0.97;
  const bw = 0.34;
  const bh = 0.2;
  const bd = 0.26;
  const wall = 0.012;
  const panel = (size: [number, number, number], at: [number, number, number], name?: string, target = false) => {
    const p = roundedBox(d, mats.paint, size, 0.004, at, 1);
    if (name) p.name = name;
    p.castShadow = true;
    group.add(p);
    if (target) targets.push(p);
    return p;
  };
  panel([bw, bh, wall], [0, by, bz + bd / 2], "bicycle-basket-front", true);
  panel([bw, bh, wall], [0, by, bz - bd / 2], "bicycle-basket-back");
  panel([wall, bh, bd], [bw / 2, by, bz], "bicycle-basket-left", true);
  panel([wall, bh, bd], [-bw / 2, by, bz], "bicycle-basket-right", true);
  panel([bw, wall, bd], [0, by - bh / 2, bz]);
  const rimBasket = roundedBox(d, mats.chrome, [bw + 0.02, 0.012, bd + 0.02], 0.004, [0, by + bh / 2, bz], 1);
  group.add(rimBasket);
  // Soportes de la canastilla a la horquilla.
  group.add(flatTube(d, mats.chrome, [0.46, 0.84], [bz - 0.05, by - bh / 2], 0.014, 0.014));
  // Portaequipaje trasero y reflejante.
  group.add(roundedBox(d, mats.chrome, [0.14, 0.012, 0.28], 0.004, [0, 0.78, zr - 0.02], 1));
  group.add(roundedBox(d, mats.taillamp, [0.05, 0.04, 0.012], 0.006, [0, 0.52, zr - 0.18], 1));
  // Caballete.
  group.add(flatTube(d, mats.trim, [-0.15, 0.3], [-0.28, 0.05], 0.014, 0.014));

  return {
    group,
    disposer: d,
    paints: [{ part: "body", material: mats.paint }],
    targets,
    depth: (scale) => Math.min(0.05, Math.max(0.012, scale * 0.35)),
    scale: BICYCLE.scale,
    elevation: 0.1,
  };
}

export function createBicycleModel(colors: GarmentColors): GarmentModel {
  return finishVehicle(buildBicycle(), { body: "#f4f4f5" }, colors, "bicycle");
}
