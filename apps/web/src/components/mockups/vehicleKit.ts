import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Piezas comunes de los vehículos procedurales (Rotulaciones): carrocería
 * por secciones (`loftBody`), cabinas extruidas, vidrios, ruedas instanciadas,
 * faros, espejos y líneas de panel. Todo se construye en METROS, con +Z hacia
 * el frente, +X hacia la izquierda del vehículo y +Y hacia arriba; cada modelo
 * lo mete en un grupo escalado (`VEHICLE_SCALE`) para que el vehículo mida
 * lo mismo que una prenda en la escena (1 unidad de escena = 10 m).
 */

/** Metros → unidades de la escena. */
export const VEHICLE_SCALE = 0.1;

/** Lleva la cuenta de geometrías y materiales para liberarlos juntos. */
export class Disposer {
  private readonly items: { dispose: () => void }[] = [];
  track<T extends { dispose: () => void }>(item: T): T {
    this.items.push(item);
    return item;
  }
  dispose() {
    this.items.forEach((i) => i.dispose());
    this.items.length = 0;
  }
}

/* -------------------------------- Materiales ------------------------------ */

export interface VehicleMaterials {
  /** Pintura de la carrocería (color elegible). */
  paint: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  /** Interior de los pasos de rueda. */
  liner: THREE.MeshStandardMaterial;
  brake: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  alloy: THREE.MeshStandardMaterial;
  headlamp: THREE.MeshPhysicalMaterial;
  taillamp: THREE.MeshPhysicalMaterial;
  amber: THREE.MeshPhysicalMaterial;
  line: THREE.MeshStandardMaterial;
  /** Costuras y rieles claros (cajas de tráiler). */
  seam: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
}

export function createMaterials(d: Disposer, paintOptions: Partial<THREE.MeshPhysicalMaterialParameters> = {}): VehicleMaterials {
  const t = d.track.bind(d);
  return {
    paint: t(
      new THREE.MeshPhysicalMaterial({
        color: "#f4f4f5",
        metalness: 0.28,
        roughness: 0.34,
        clearcoat: 1,
        clearcoatRoughness: 0.07,
        ...paintOptions,
      }),
    ),
    glass: t(
      new THREE.MeshPhysicalMaterial({
        color: "#0b1118",
        metalness: 0.1,
        roughness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 1.5,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    ),
    trim: t(new THREE.MeshStandardMaterial({ color: "#17191c", roughness: 0.58, metalness: 0.1 })),
    rubber: t(new THREE.MeshStandardMaterial({ color: "#1a1b1e", roughness: 0.82, metalness: 0 })),
    liner: t(new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.95, metalness: 0, side: THREE.DoubleSide })),
    brake: t(new THREE.MeshStandardMaterial({ color: "#4a4d52", roughness: 0.5, metalness: 0.8 })),
    chrome: t(new THREE.MeshStandardMaterial({ color: "#dfe3e8", metalness: 1, roughness: 0.16 })),
    alloy: t(new THREE.MeshStandardMaterial({ color: "#c7ccd2", metalness: 0.92, roughness: 0.26 })),
    headlamp: t(
      new THREE.MeshPhysicalMaterial({
        color: "#eef2f6",
        emissive: "#fff6dc",
        emissiveIntensity: 0.35,
        roughness: 0.08,
        clearcoat: 1,
        metalness: 0.2,
      }),
    ),
    taillamp: t(
      new THREE.MeshPhysicalMaterial({
        color: "#a3101c",
        emissive: "#7a0610",
        emissiveIntensity: 0.55,
        roughness: 0.12,
        clearcoat: 1,
      }),
    ),
    amber: t(
      new THREE.MeshPhysicalMaterial({
        color: "#f1a21f",
        emissive: "#a8620a",
        emissiveIntensity: 0.4,
        roughness: 0.15,
        clearcoat: 1,
      }),
    ),
    line: t(
      new THREE.MeshStandardMaterial({
        color: "#1b1d20",
        roughness: 0.7,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    ),
    seam: t(
      new THREE.MeshStandardMaterial({
        color: "#b4b9c0",
        roughness: 0.5,
        metalness: 0.4,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    ),
    plate: t(new THREE.MeshStandardMaterial({ color: "#f3f0e4", roughness: 0.5 })),
  };
}

/* ------------------------------- Utilidades ------------------------------- */

/** Interpolación cúbica monótona (sin rebotes) de un valor a lo largo de z. */
export function monotoneInterpolator(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  if (n === 1) return () => ys[0];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Voltea una geometría en X (espejo) y arregla el sentido de los triángulos. */
export function mirrorX(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.clone();
  g.scale(-1, 1, 1);
  const index = g.getIndex();
  if (index) {
    const arr = index.array as Uint16Array | Uint32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    index.needsUpdate = true;
  } else {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i + 1);
      const y = pos.getY(i + 1);
      const z = pos.getZ(i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, x, y, z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Une una geometría con su espejo en X. */
export function withMirror(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = mirrorX(geo);
  const merged = mergeGeometries([geo.index ? geo.toNonIndexed() : geo, m.index ? m.toNonIndexed() : m])!;
  m.dispose();
  return merged;
}

/* ---------------------------- Carrocería por secciones --------------------- */

export interface LoftKey {
  /** Posición a lo largo del vehículo (m). */
  z: number;
  /** Medio ancho. */
  w: number;
  /** Altura de la parte baja y de la parte alta de la sección. */
  y0: number;
  y1: number;
  /** Radio de las esquinas de abajo / arriba (por defecto 0.1 / 0.12). */
  rb?: number;
  rt?: number;
  /** Cuánto se cierra la parte alta hacia adentro (0-0.4). */
  tv?: number;
}

export interface LoftCap {
  /** Largo de la punta redondeada (m). 0 = tapa plana. */
  len: number;
  /** Exponentes de la punta en planta (ancho) y en perfil (alto). */
  p?: number;
  q?: number;
}

export interface WheelArch {
  /** Centro de la rueda (z, y), radio del hueco y profundidad del fondo (|x|). */
  z: number;
  y: number;
  r: number;
  floor: number;
}

/**
 * Recorta los huecos de las ruedas en la pintura con el fragment shader (un
 * círculo perfecto en el costado, sin depender de la resolución de la malla)
 * y oscurece el interior de la carrocería, que se ve por el hueco.
 */
export function cutWheelArches(material: THREE.Material, arches: WheelArch[]) {
  const f = (n: number) => n.toFixed(5);
  material.side = THREE.DoubleSide;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vArchPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvArchPos = position;");
    const tests = arches
      .map((a) => `if (abs(vArchPos.x) > ${f(a.floor)} && length(vArchPos.zy - vec2(${f(a.z)}, ${f(a.y)})) < ${f(a.r)}) discard;`)
      .join("\n");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vArchPos;")
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${tests}`)
      .replace("#include <opaque_fragment>", "if (!gl_FrontFacing) outgoingLight *= 0.06;\n#include <opaque_fragment>");
  };
  material.customProgramCacheKey = () => `arches:${arches.map((a) => `${f(a.z)},${f(a.y)},${f(a.r)},${f(a.floor)}`).join("|")}`;
  material.needsUpdate = true;
}

/**
 * Pasos de rueda: placa de fondo y casquillo (semicilindro) de color oscuro
 * detrás de cada rueda, para que el hueco tenga profundidad y borde.
 */
export function addWheelWells(parent: THREE.Object3D, d: Disposer, mats: VehicleMaterials, arches: WheelArch[], outer: number) {
  const plate = d.track(new THREE.CircleGeometry(1, 48));
  for (const a of arches) {
    const span = Math.max(0.05, outer - a.floor);
    const liner = d.track(new THREE.CylinderGeometry(a.r, a.r, span, 40, 1, true, 0, Math.PI));
    // Cylinder: eje Y; girado, el eje es X y el arco (θ ∈ [0, π]) queda hacia arriba.
    liner.rotateZ(Math.PI / 2);
    for (const s of [1, -1]) {
      const l = new THREE.Mesh(liner, mats.liner);
      l.position.set(s * (a.floor + span / 2), a.y, a.z);
      parent.add(l);
      const p = new THREE.Mesh(plate, mats.liner);
      p.scale.setScalar(a.r);
      p.position.set(s * a.floor, a.y, a.z);
      p.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      parent.add(p);
    }
  }
}

export interface LoftSpec {
  keys: LoftKey[];
  rear?: LoftCap;
  front?: LoftCap;
  /** Separación base entre secciones (m). */
  step?: number;
  /** Zonas con secciones más juntas. */
  dense?: { z0: number; z1: number; step: number }[];
  /** Puntos por tramo del contorno. */
  segs?: { bottom: number; corner: number; side: number; top: number };
}

export interface Loft {
  geometry: THREE.BufferGeometry;
  /** Punto del costado (x > 0) a la altura `y` donde el medio ancho vale `x`, buscando desde el extremo. */
  edgeAt: (x: number, y: number, from: "front" | "rear") => { z: number; yaw: number };
  /** Medio ancho de la carrocería a la altura `y` en la sección `z`. */
  halfWidthAt: (z: number, y?: number) => number;
  /** Altura alta / baja en la sección `z`. */
  topAt: (z: number) => number;
  bottomAt: (z: number) => number;
}

function ringHalf(
  w: number,
  y0: number,
  y1: number,
  rb: number,
  rt: number,
  tv: number,
  segs: NonNullable<LoftSpec["segs"]>,
): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  rb = Math.min(rb, w * 0.9, (y1 - y0) * 0.45);
  rt = Math.min(rt, w * 0.95, (y1 - y0) * 0.45);
  for (let i = 0; i <= segs.bottom; i++) pts.push(new THREE.Vector2(((w - rb) * i) / segs.bottom, y0));
  for (let i = 1; i <= segs.corner; i++) {
    const a = -Math.PI / 2 + ((Math.PI / 2) * i) / segs.corner;
    pts.push(new THREE.Vector2(w - rb + rb * Math.cos(a), y0 + rb + rb * Math.sin(a)));
  }
  for (let i = 1; i <= segs.side; i++) pts.push(new THREE.Vector2(w, y0 + rb + ((y1 - rt - y0 - rb) * i) / segs.side));
  for (let i = 1; i <= segs.corner; i++) {
    const a = ((Math.PI / 2) * i) / segs.corner;
    pts.push(new THREE.Vector2(w - rt + rt * Math.cos(a), y1 - rt + rt * Math.sin(a)));
  }
  for (let i = 1; i <= segs.top; i++) pts.push(new THREE.Vector2((w - rt) * (1 - i / segs.top), y1));
  if (tv > 0) {
    const h = y1 - y0;
    for (const p of pts) p.x *= 1 - tv * smoothstep(0.35, 1, (p.y - y0) / h);
  }
  return pts;
}

/**
 * Carrocería hecha de secciones (rectángulos redondeados) a lo largo de z,
 * con las puntas redondeadas y los huecos de las ruedas recortados en la
 * propia malla (los vértices del hueco se hunden y se pintan de negro).
 */
export function loftBody(spec: LoftSpec): Loft {
  const segs = spec.segs ?? { bottom: 4, corner: 6, side: 22, top: 7 };
  const keys = [...spec.keys].sort((a, b) => a.z - b.z);
  const zs = keys.map((k) => k.z);
  const ch = (f: (k: LoftKey) => number) => monotoneInterpolator(zs, keys.map(f));
  const wF = ch((k) => k.w);
  const y0F = ch((k) => k.y0);
  const y1F = ch((k) => k.y1);
  const rbF = ch((k) => k.rb ?? 0.1);
  const rtF = ch((k) => k.rt ?? 0.12);
  const tvF = ch((k) => k.tv ?? 0);
  const zMin = zs[0];
  const zMax = zs[zs.length - 1];

  // Secciones: paso base + zonas densas + las llaves.
  const set = new Set<number>(zs.map((z) => Math.round(z * 1e4) / 1e4));
  const step = spec.step ?? 0.12;
  for (let z = zMin; z < zMax; z += step) set.add(Math.round(z * 1e4) / 1e4);
  for (const d of spec.dense ?? []) for (let z = d.z0; z <= d.z1; z += d.step) set.add(Math.round(z * 1e4) / 1e4);
  // Puntas: secciones cada vez más juntas hacia el extremo para que cierren bien.
  for (const [cap, end, dir] of [
    [spec.rear, zMin, 1],
    [spec.front, zMax, -1],
  ] as const) {
    if (!cap || cap.len <= 0) continue;
    for (let k = 1; k <= 14; k++) {
      const dist = cap.len * (1 - Math.sin(((Math.PI / 2) * k) / 14));
      set.add(Math.round((end + dir * dist) * 1e4) / 1e4);
    }
  }
  const stations = [...set].filter((z) => z >= zMin && z <= zMax).sort((a, b) => a - b);

  const capFactor = (z: number): { fw: number; fh: number } => {
    let fw = 1;
    let fh = 1;
    const apply = (cap: LoftCap | undefined, dist: number) => {
      if (!cap || cap.len <= 0 || dist >= cap.len) return;
      const t = Math.min(1, Math.max(0, 1 - dist / cap.len));
      const p = cap.p ?? 2.4;
      const q = cap.q ?? 5;
      fw = Math.min(fw, Math.pow(Math.max(0, 1 - Math.pow(t, p)), 1 / p));
      fh = Math.min(fh, Math.pow(Math.max(0, 1 - Math.pow(t, q)), 1 / q));
    };
    apply(spec.rear, z - zMin);
    apply(spec.front, zMax - z);
    return { fw, fh };
  };

  const half = ringHalf(1, 0, 1, 0.1, 0.1, 0, segs).length; // sólo para contar
  const L = half + (half - 2);
  const positions: number[] = [];
  const colors: number[] = [];

  stations.forEach((z) => {
    const { fw, fh } = capFactor(z);
    const yc = (y0F(z) + y1F(z)) / 2;
    const hh = ((y1F(z) - y0F(z)) / 2) * fh;
    const w = Math.max(1e-4, wF(z) * fw);
    const pts = ringHalf(w, yc - hh, yc + hh, rbF(z) * fw, rtF(z) * fw, tvF(z), segs);
    // Mitad derecha (+x) de abajo a arriba y luego la izquierda de arriba a abajo.
    const ring: { x: number; y: number }[] = pts.map((p) => ({ x: p.x, y: p.y }));
    for (let i = pts.length - 2; i >= 1; i--) ring.push({ x: -pts[i].x, y: pts[i].y });
    for (const p of ring) {
      positions.push(p.x, p.y, z);
      colors.push(1, 1, 1);
    }
  });

  const indices: number[] = [];
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < L; j++) {
      const a = i * L + j;
      const b = i * L + ((j + 1) % L);
      const c = (i + 1) * L + j;
      const d = (i + 1) * L + ((j + 1) % L);
      indices.push(a, b, c, b, d, c);
    }
  }

  // Tapas planas (sólo donde la punta no se cierra sola).
  const capGeos: THREE.BufferGeometry[] = [];
  const body = new THREE.BufferGeometry();
  body.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  body.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  body.setIndex(indices);
  body.computeVertexNormals();

  const flatCap = (stationIndex: number, outward: 1 | -1) => {
    const g = new THREE.BufferGeometry();
    const pos: number[] = [];
    const col: number[] = [];
    let cy = 0;
    for (let j = 0; j < L; j++) cy += positions[(stationIndex * L + j) * 3 + 1];
    cy /= L;
    const z = stations[stationIndex];
    pos.push(0, cy, z);
    col.push(1, 1, 1);
    for (let j = 0; j < L; j++) {
      const o = (stationIndex * L + j) * 3;
      pos.push(positions[o], positions[o + 1], positions[o + 2]);
      col.push(1, 1, 1);
    }
    const idx: number[] = [];
    for (let j = 0; j < L; j++) {
      const a = 1 + j;
      const b = 1 + ((j + 1) % L);
      if (outward === 1) idx.push(0, a, b);
      else idx.push(0, b, a);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  if (!spec.rear || spec.rear.len <= 0) capGeos.push(flatCap(0, -1));
  if (!spec.front || spec.front.len <= 0) capGeos.push(flatCap(stations.length - 1, 1));

  let geometry = body;
  if (capGeos.length) {
    geometry = mergeGeometries([body.toNonIndexed(), ...capGeos.map((g) => g.toNonIndexed())])!;
    body.dispose();
    capGeos.forEach((g) => g.dispose());
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const wAt = (z: number, y?: number) => {
    const { fw } = capFactor(z);
    const w = wF(z) * fw;
    if (y === undefined) return w;
    const h = y1F(z) - y0F(z);
    return w * (1 - tvF(z) * smoothstep(0.35, 1, (y - y0F(z)) / h));
  };
  return {
    geometry,
    edgeAt: (x, y, from) => {
      // Recorre z desde la punta hasta que la carrocería ya es tan ancha como `x`.
      let z = from === "front" ? zMax : zMin;
      const dz = from === "front" ? -0.004 : 0.004;
      for (let i = 0; i < 2000 && wAt(z, y) < x; i++) z += dz;
      const e = 0.01;
      const A = { x: wAt(z - e, y), z: z - e };
      const B = { x: wAt(z + e, y), z: z + e };
      // Normal exterior en planta (perpendicular a la tangente, hacia afuera y hacia la punta).
      let nx = B.z - A.z;
      let nz = -(B.x - A.x);
      if (from === "front" ? nz < 0 : nz > 0) {
        nx = -nx;
        nz = -nz;
      }
      return { z, yaw: Math.atan2(nx, nz) };
    },
    halfWidthAt: wAt,
    topAt: (z) => y1F(z),
    bottomAt: (z) => y0F(z),
  };
}

/* ------------------------------ Cabina extruida ---------------------------- */

export type Pt = [number, number];

/** Redondea las esquinas de un polígono (radio por vértice, 0 = esquina viva). */
export function roundPolygon(points: Pt[], radius: number | number[], segs = 6): Pt[] {
  const n = points.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const r = Array.isArray(radius) ? radius[i] : radius;
    const p = points[i];
    if (!r) {
      out.push(p);
      continue;
    }
    const a = points[(i + n - 1) % n];
    const b = points[(i + 1) % n];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const t = Math.min(r, da * 0.48, db * 0.48);
    const pa: Pt = [p[0] + ((a[0] - p[0]) / da) * t, p[1] + ((a[1] - p[1]) / da) * t];
    const pb: Pt = [p[0] + ((b[0] - p[0]) / db) * t, p[1] + ((b[1] - p[1]) / db) * t];
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const x = (1 - u) * (1 - u) * pa[0] + 2 * (1 - u) * u * p[0] + u * u * pb[0];
      const y = (1 - u) * (1 - u) * pa[1] + 2 * (1 - u) * u * p[1] + u * u * pb[1];
      out.push([x, y]);
    }
  }
  return out;
}

export interface ExtrudeSideOptions {
  /** Medio ancho de la pieza en la base. */
  halfWidth: number;
  /** Cuánto se cierra hacia arriba (0 = paredes rectas). */
  taper?: number;
  /** Radio del biselado de las aristas. */
  bevel?: number;
  /** Altura de la base y de la cima (para el cierre). */
  yBase: number;
  yTop: number;
  /** Altura desde la que empieza a cerrarse (por defecto, la base). */
  taperFrom?: number;
  bevelSegments?: number;
}

/**
 * Pieza de perfil lateral: un polígono (z, y) extruido a lo ancho (±x), con
 * las aristas biseladas y las paredes inclinadas hacia adentro (`taper`).
 */
export function extrudeSide(profile: Pt[], o: ExtrudeSideOptions): THREE.BufferGeometry {
  const bevel = o.bevel ?? 0.04;
  const shape = new THREE.Shape();
  // El perfil se dibuja con x = -z para que, al girar, quede mirando al frente.
  profile.forEach(([z, y], i) => (i === 0 ? shape.moveTo(-z, y) : shape.lineTo(-z, y)));
  shape.closePath();
  const depth = Math.max(0.01, o.halfWidth * 2 - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: o.bevelSegments ?? 4,
    curveSegments: 1,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);
  // Después de rotar: z' = -x_local, x' = z_local.
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const taper = o.taper ?? 0;
  if (taper > 0) {
    const from = o.taperFrom ?? o.yBase;
    const h = Math.max(1e-6, o.yTop - from);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) - from) / h));
      pos.setX(i, pos.getX(i) * (1 - taper * t));
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Medio ancho de una pieza `extrudeSide` a la altura `y`. */
export function sideHalfWidth(o: Pick<ExtrudeSideOptions, "halfWidth" | "taper" | "yBase" | "yTop" | "taperFrom">, y: number): number {
  const from = o.taperFrom ?? o.yBase;
  const t = Math.min(1, Math.max(0, (y - from) / Math.max(1e-6, o.yTop - from)));
  return o.halfWidth * (1 - (o.taper ?? 0) * t);
}

/**
 * Ventana lateral: polígono (z, y) pegado a la pared inclinada de la cabina,
 * con las esquinas redondeadas. Devuelve el lado izquierdo (+x); el derecho
 * se obtiene con `mirrorX`.
 */
export function sideWindow(
  poly: Pt[],
  halfWidthAt: (y: number) => number,
  lift = 0.004,
  radius: number | number[] = 0.035,
): THREE.BufferGeometry {
  const rounded = roundPolygon(poly, radius, 5);
  const shape = new THREE.Shape(rounded.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ShapeGeometry(shape, 1);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getX(i);
    const y = pos.getY(i);
    pos.setXYZ(i, halfWidthAt(y) + lift, y, z);
  }
  // Normal hacia +x.
  const idx = geo.getIndex();
  if (idx) {
    const arr = idx.array as Uint16Array | Uint32Array;
    // ShapeGeometry mira hacia +z en (x,y): al mapear (z,y)->(y,z) el sentido se invierte según el giro.
    const a = new THREE.Vector3().fromBufferAttribute(pos, arr[0]);
    const b = new THREE.Vector3().fromBufferAttribute(pos, arr[1]);
    const c = new THREE.Vector3().fromBufferAttribute(pos, arr[2]);
    const n = b.sub(a).cross(c.sub(a));
    if (n.x < 0) {
      for (let i = 0; i < arr.length; i += 3) {
        const t = arr[i + 1];
        arr[i + 1] = arr[i + 2];
        arr[i + 2] = t;
      }
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Parabrisas / medallón: panel plano pegado a una arista inclinada del perfil
 * (de `a` a `b` en (z, y)), tan ancho como la cabina a esa altura menos `inset`.
 */
export function slopedGlass(
  a: Pt,
  b: Pt,
  halfWidthAt: (y: number) => number,
  opts: { inset?: number; startInset?: number; endInset?: number; lift?: number; radius?: number } = {},
): THREE.BufferGeometry {
  const inset = opts.inset ?? 0.07;
  const lift = opts.lift ?? 0.004;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dir = new THREE.Vector2((b[0] - a[0]) / len, (b[1] - a[1]) / len);
  const s0 = opts.startInset ?? 0.07;
  const s1 = len - (opts.endInset ?? 0.07);
  const pointAt = (s: number) => new THREE.Vector2(a[0] + dir.x * s, a[1] + dir.y * s);
  const p0 = pointAt(s0);
  const p1 = pointAt(s1);
  const w0 = Math.max(0.02, halfWidthAt(p0.y) - inset);
  const w1 = Math.max(0.02, halfWidthAt(p1.y) - inset);
  const poly: Pt[] = [
    [-w0, 0],
    [w0, 0],
    [w1, s1 - s0],
    [-w1, s1 - s0],
  ];
  const rounded = roundPolygon(poly, opts.radius ?? 0.05, 5);
  const shape = new THREE.Shape(rounded.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ShapeGeometry(shape, 1);
  // Plano local (x, s) -> mundo: x -> x, s -> (z, y) a lo largo de la arista, con un levantamiento
  // a lo largo de la normal de la arista (hacia afuera).
  const normal = new THREE.Vector2(-dir.y, dir.x);
  // Se elige el sentido de la normal que apunte hacia arriba/afuera de la cabina.
  if (normal.y < 0) normal.multiplyScalar(-1);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const s = pos.getY(i) + s0;
    const p = pointAt(s);
    pos.setXYZ(i, x, p.y + normal.y * lift, p.x + normal.x * lift);
  }
  const idx = geo.getIndex();
  if (idx) {
    const arr = idx.array as Uint16Array | Uint32Array;
    const A = new THREE.Vector3().fromBufferAttribute(pos, arr[0]);
    const B = new THREE.Vector3().fromBufferAttribute(pos, arr[1]);
    const C = new THREE.Vector3().fromBufferAttribute(pos, arr[2]);
    const n = B.sub(A).cross(C.sub(A));
    if (n.y * normal.y + n.z * normal.x < 0) {
      for (let i = 0; i < arr.length; i += 3) {
        const t = arr[i + 1];
        arr[i + 1] = arr[i + 2];
        arr[i + 2] = t;
      }
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/* ---------------------------------- Ruedas -------------------------------- */

export interface WheelSpec {
  /** Radio total del neumático y ancho (m). */
  radius: number;
  width: number;
  /** Radio del rin (m). */
  rimRadius: number;
  spokes?: number;
  /** Rin liso (camión): disco con tuercas. */
  disc?: boolean;
}

export interface WheelGeometries {
  tire: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  brake: THREE.BufferGeometry;
}

/** Neumático y rin con el eje a lo largo de X y la cara bonita hacia +X. */
export function createWheelGeometries(w: WheelSpec): WheelGeometries {
  const R = w.radius;
  const hw = w.width / 2;
  const rr = w.rimRadius;
  const side = (R - rr) * 0.9;
  // Perfil del neumático (r, x): flancos abombados y banda de rodadura plana.
  const prof: THREE.Vector2[] = [];
  const add = (r: number, x: number) => prof.push(new THREE.Vector2(r, x));
  add(rr, -hw * 0.82);
  add(rr + side * 0.35, -hw * 0.98);
  add(rr + side * 0.8, -hw * 1.0);
  add(R - 0.012, -hw * 0.9);
  add(R, -hw * 0.62);
  add(R, hw * 0.62);
  add(R - 0.012, hw * 0.9);
  add(rr + side * 0.8, hw * 1.0);
  add(rr + side * 0.35, hw * 0.98);
  add(rr, hw * 0.82);
  const tire = new THREE.LatheGeometry(prof, w.disc ? 30 : 40);
  // Lathe gira alrededor de Y con los puntos (r, y): se pasa a eje X.
  tire.rotateZ(-Math.PI / 2);

  const parts: THREE.BufferGeometry[] = [];
  // Barril del rin.
  const barrelProf = [new THREE.Vector2(rr, -hw * 0.8), new THREE.Vector2(rr * 0.97, -hw * 0.5), new THREE.Vector2(rr * 0.96, hw * 0.4), new THREE.Vector2(rr, hw * 0.78)];
  const barrel = new THREE.LatheGeometry(barrelProf, 32);
  barrel.rotateZ(-Math.PI / 2);
  parts.push(barrel);
  if (w.disc) {
    const disc = new THREE.CylinderGeometry(rr * 0.97, rr * 0.97, hw * 0.3, 32);
    disc.rotateZ(-Math.PI / 2);
    disc.translate(hw * 0.5, 0, 0);
    parts.push(disc);
    const hub = new THREE.CylinderGeometry(rr * 0.3, rr * 0.3, hw * 0.5, 24);
    hub.rotateZ(-Math.PI / 2);
    hub.translate(hw * 0.62, 0, 0);
    parts.push(hub);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const nut = new THREE.CylinderGeometry(rr * 0.05, rr * 0.05, hw * 0.12, 6);
      nut.rotateZ(-Math.PI / 2);
      nut.translate(hw * 0.66, Math.cos(a) * rr * 0.55, Math.sin(a) * rr * 0.55);
      parts.push(nut);
    }
  } else {
    const n = w.spokes ?? 5;
    // Aro exterior del rin y radios gruesos que se abren hacia la orilla.
    const lipRing = new THREE.TorusGeometry(rr * 0.93, rr * 0.07, 8, 40);
    lipRing.rotateY(Math.PI / 2);
    lipRing.translate(hw * 0.7, 0, 0);
    parts.push(lipRing);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const spoke = new RoundedBoxGeometry(hw * 0.26, rr * 0.8, rr * 0.3, 2, rr * 0.07);
      spoke.translate(hw * 0.62, rr * 0.5, 0);
      spoke.rotateX(a);
      parts.push(spoke);
    }
    const hub = new THREE.CylinderGeometry(rr * 0.24, rr * 0.24, hw * 0.4, 20);
    hub.rotateZ(-Math.PI / 2);
    hub.translate(hw * 0.7, 0, 0);
    parts.push(hub);
  }
  const rim = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
  parts.forEach((p) => p.dispose());
  // Disco de freno: detrás de los radios, oscuro.
  const brake = new THREE.CylinderGeometry(rr * 0.82, rr * 0.82, hw * 0.12, 32);
  brake.rotateZ(-Math.PI / 2);
  brake.translate(hw * 0.28, 0, 0);
  return { tire, rim, brake };
}

export interface WheelPlacement {
  x: number;
  z: number;
  /** Altura del centro (por defecto el radio). */
  y?: number;
}

/**
 * Ruedas instanciadas (un solo `InstancedMesh` por material). `x > 0` mira a
 * la izquierda del vehículo; `x < 0` se voltea para que el rin salga hacia afuera.
 */
export function addWheels(
  parent: THREE.Object3D,
  d: Disposer,
  mats: VehicleMaterials,
  spec: WheelSpec,
  places: WheelPlacement[],
  options: { tiresOnly?: boolean; spin?: (index: number) => number } = {},
): void {
  const spin = options.spin;
  const { tire, rim, brake } = createWheelGeometries(spec);
  d.track(tire);
  d.track(rim);
  d.track(brake);
  const tires = new THREE.InstancedMesh(tire, mats.rubber, places.length);
  const rims = new THREE.InstancedMesh(rim, mats.alloy, places.length);
  const brakes = new THREE.InstancedMesh(brake, mats.brake, places.length);
  d.track(tires);
  d.track(rims);
  d.track(brakes);
  const solo = options.tiresOnly === true;
  tires.name = "wheels-tire";
  rims.name = "wheels-rim";
  tires.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  places.forEach((p, i) => {
    const yaw = p.x < 0 ? Math.PI : 0;
    // El giro del rin va alrededor del eje de la rueda (X local): se compone como Ry · Rx.
    const rx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), spin ? spin(i) : (i * 1.7) % (Math.PI * 2));
    const ry = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    q.copy(ry).multiply(rx);
    m.compose(new THREE.Vector3(p.x, p.y ?? spec.radius, p.z), q, s);
    tires.setMatrixAt(i, m);
    rims.setMatrixAt(i, m);
    brakes.setMatrixAt(i, m);
  });
  tires.instanceMatrix.needsUpdate = true;
  rims.instanceMatrix.needsUpdate = true;
  brakes.instanceMatrix.needsUpdate = true;
  // Las ruedas gemelas de adentro sólo muestran la llanta.
  parent.add(tires);
  if (!solo) parent.add(rims, brakes);
}

/* --------------------------------- Detalles -------------------------------- */

/**
 * Pieza pegada a la orilla de la carrocería (faros, calaveras): se acomoda
 * mirando hacia afuera de la esquina, medio hundida en la pintura.
 */
export function placeOnEdge(
  mesh: THREE.Object3D,
  loft: Loft,
  x: number,
  y: number,
  from: "front" | "rear",
  side: 1 | -1,
  thickness: number,
  sink = 0.35,
) {
  const { z, yaw } = loft.edgeAt(x, y, from);
  const wx = loft.halfWidthAt(z, y);
  const nx = Math.sin(yaw);
  const nz = Math.cos(yaw);
  mesh.position.set(side * (wx - nx * thickness * sink), y, z - nz * thickness * sink);
  mesh.rotation.y = side * yaw;
}

export function roundedBox(
  d: Disposer,
  mat: THREE.Material,
  size: [number, number, number],
  radius: number,
  at: [number, number, number],
  segments = 3,
): THREE.Mesh {
  const geo = d.track(new RoundedBoxGeometry(size[0], size[1], size[2], segments, Math.min(radius, Math.min(...size) / 2 - 1e-4)));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...at);
  return mesh;
}

/** Lista de puntos (x, y, z) → cinta delgada que sigue la superficie lateral (línea de panel). */
export function ribbon(points: [number, number, number][], width: number, normalX = 1): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    // Dirección en el plano (z, y) de la pared; el ancho va perpendicular a ella.
    const dz = next[2] - prev[2];
    const dy = next[1] - prev[1];
    const l = Math.hypot(dz, dy) || 1;
    const nz = -dy / l;
    const ny = dz / l;
    pos.push(p[0], p[1] + ny * (width / 2), p[2] + nz * (width / 2));
    pos.push(p[0], p[1] - ny * (width / 2), p[2] - nz * (width / 2));
    if (i > 0) {
      const a = (i - 1) * 2;
      const b = i * 2;
      if (normalX > 0) idx.push(a, b, a + 1, a + 1, b, b + 1);
      else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Línea de panel en el costado (se genera la del lado izquierdo y su espejo). */
export function addSideLine(
  group: THREE.Group,
  d: Disposer,
  mat: THREE.Material,
  loft: Loft,
  pts: [number, number][],
  width = 0.008,
  lift = 0.0015,
) {
  const points = pts.map(([z, y]): [number, number, number] => [loft.halfWidthAt(z, y) + lift, y, z]);
  const g = d.track(ribbon(points, width, 1));
  const left = new THREE.Mesh(g, mat);
  left.name = "panel-line";
  const right = new THREE.Mesh(d.track(mirrorX(g)), mat);
  right.name = "panel-line";
  group.add(left, right);
}

/** Une geometrías en una sola (con atributos mínimos comunes). */
export function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const list = geos.map((g) => {
    const x = g.index ? g.toNonIndexed() : g.clone();
    for (const name of Object.keys(x.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") x.deleteAttribute(name);
    if (!x.getAttribute("uv")) x.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(x.getAttribute("position").count * 2).fill(0), 2));
    return x;
  });
  const merged = mergeGeometries(list)!;
  list.forEach((g) => g.dispose());
  return merged;
}

/** Caja de contacto en el piso: bounding box de la raíz → `{ min.y }`. */
export function groundOf(root: THREE.Object3D): number {
  return new THREE.Box3().setFromObject(root).min.y;
}
