import * as THREE from "three";
import { DEFAULT_COLORS, type GarmentColors } from "@/lib/mockups/types";
import {
  CAP_SHAPE,
  crownNormal,
  crownPoint,
  openingArch,
  type Point3,
} from "./capShape";
import { dampColor, parseColor, type GarmentModel } from "./garmentModel";
import { SHADOW_ONLY_LAYER } from "./studioLighting";

/**
 * Gorra trucker estilo Richardson 112, construida por código (sin assets):
 *
 * - `front`: 2 paneles frontales estructurados (costura al centro).
 * - `mesh`: 3 paneles traseros de malla con textura generada en canvas y la
 *   abertura en arco del broche.
 * - `visor`: visera precurva con pespuntes.
 * - Botón superior, ribete del arco, broche (snapback) y vista del sudadero.
 *
 * Los diseños se proyectan sobre `front` y `mesh` (`decalTargets`). Para
 * cambiarla por un GLB real más adelante (TODO R5), basta con mantener esos
 * nombres de malla y el mismo espacio local (ver `capShape.ts`).
 */

const FRONT_SEGMENTS = 72;
const MESH_SEGMENTS = 220;
const HEIGHT_SEGMENTS = 56;

// ---------------------------------------------------------------------------
// Texturas generadas en canvas (blanco = color de la tela; se tiñen con
// `material.color`, así el color se cambia sin regenerarlas).
// ---------------------------------------------------------------------------

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Línea de pespunte (guiones cortos) en el canvas. */
function stitchLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dash: number,
  gap: number,
) {
  ctx.setLineDash([dash, gap]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Paneles frontales: costura central hundida, pespuntes a los lados y en la
 * base. `u` recorre el frente de lado a lado, `v` de la base al botón.
 */
function frontPanelTextures() {
  const W = 1024;
  const H = 512;
  const color = makeCanvas(W, H);
  const bump = makeCanvas(W, H);

  // Color: base blanca con sarga muy sutil para que no se vea plástico.
  const c = color.ctx;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, W, H);
  c.globalAlpha = 0.035;
  c.strokeStyle = "#000000";
  c.lineWidth = 1;
  for (let x = -H; x < W; x += 4) {
    c.beginPath();
    c.moveTo(x, H);
    c.lineTo(x + H, 0);
    c.stroke();
  }
  c.globalAlpha = 1;

  // Relieve: gris medio = plano, más oscuro = hundido.
  const b = bump.ctx;
  b.fillStyle = "#808080";
  b.fillRect(0, 0, W, H);

  const cx = W / 2;
  for (const ctx of [c, b]) {
    const isBump = ctx === b;
    // Costura central (canal hundido).
    const grad = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0);
    grad.addColorStop(0, isBump ? "#808080" : "rgba(0,0,0,0)");
    grad.addColorStop(0.5, isBump ? "#2a2a2a" : "rgba(0,0,0,0.22)");
    grad.addColorStop(1, isBump ? "#808080" : "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 7, 0, 14, H);
    // Pespuntes a ambos lados de la costura central y de las orillas.
    ctx.strokeStyle = isBump ? "#b8b8b8" : "rgba(0,0,0,0.16)";
    ctx.lineWidth = 2.2;
    for (const x of [cx - 13, cx + 13, 9, W - 9]) stitchLine(ctx, x, 0, x, H, 9, 6);
    // Pespunte de la base (donde va cosido el sudadero).
    stitchLine(ctx, 0, H - 14, W, H - 14, 9, 6);
    // Orillas del panel ligeramente hundidas (costura con la malla).
    ctx.fillStyle = isBump ? "#4a4a4a" : "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, 3, H);
    ctx.fillRect(W - 3, 0, 3, H);
  }
  return { map: toTexture(color.canvas, true), bumpMap: toTexture(bump.canvas, false) };
}

/**
 * Malla trucker: hoyos hexagonales escalonados. Mosaico continuo (se repite
 * sin cortes) de 2 × 2 celdas.
 */
function meshTextures() {
  const S = 128;
  const color = makeCanvas(S, S);
  const bump = makeCanvas(S, S);
  const holes: [number, number][] = [
    [0, 0], [S / 2, 0], [S, 0],
    [S / 4, S / 2], [(3 * S) / 4, S / 2],
    [0, S], [S / 2, S], [S, S],
    [-S / 4, S / 2], [(5 * S) / 4, S / 2],
  ];
  const r = S * 0.215;
  const hex = (ctx: CanvasRenderingContext2D, x: number, y: number, rad: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const px = x + rad * Math.cos(a);
      const py = y + rad * Math.sin(a) * 0.92;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  const c = color.ctx;
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, S, S);
  c.lineJoin = "round";
  for (const [x, y] of holes) {
    // Hoyo: se ve el interior en sombra; borde suave hacia el hilo.
    c.fillStyle = "#8c8c8c";
    hex(c, x, y, r);
    c.fill();
    c.fillStyle = "#666666";
    hex(c, x, y, r * 0.7);
    c.fill();
  }

  const b = bump.ctx;
  b.fillStyle = "#c8c8c8";
  b.fillRect(0, 0, S, S);
  for (const [x, y] of holes) {
    b.fillStyle = "#3a3a3a";
    hex(b, x, y, r);
    b.fill();
  }

  const map = toTexture(color.canvas, true);
  const bumpMap = toTexture(bump.canvas, false);
  for (const t of [map, bumpMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return { map, bumpMap };
}

/** Visera: 8 filas de pespunte paralelas a la orilla (típicas de la 112). */
function visorTextures() {
  const W = 1024;
  const H = 256;
  const color = makeCanvas(W, H);
  const bump = makeCanvas(W, H);
  color.ctx.fillStyle = "#ffffff";
  color.ctx.fillRect(0, 0, W, H);
  bump.ctx.fillStyle = "#808080";
  bump.ctx.fillRect(0, 0, W, H);
  // CanvasTexture invierte Y: la fila 0 del canvas es v = 1 (orilla exterior).
  for (const [ctx, style] of [
    [color.ctx, "rgba(0,0,0,0.2)"],
    [bump.ctx, "#bdbdbd"],
  ] as const) {
    ctx.strokeStyle = style;
    ctx.lineWidth = 2.4;
    for (let k = 0; k < 8; k++) {
      const y = H * (0.06 + k * 0.075);
      stitchLine(ctx, 0, y, W, y, 8, 5);
    }
  }
  return { map: toTexture(color.canvas, true), bumpMap: toTexture(bump.canvas, false) };
}

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

interface CrownPatchOptions {
  thetaStart: number;
  thetaEnd: number;
  segments: number;
  /** UV: si se da, u/v en metros × densidad (para la malla que se repite). */
  tiledDensity?: number;
  /** Respetar el arco del broche (sólo en los paneles traseros). */
  withOpening?: boolean;
  /** Ángulos que deben caer exactamente en una columna (orillas del arco). */
  snapThetas?: number[];
}

function crownPatch(opts: CrownPatchOptions): THREE.BufferGeometry {
  const { thetaStart, thetaEnd, segments, tiledDensity, withOpening, snapThetas = [] } = opts;
  const thetas: number[] = [];
  for (let i = 0; i <= segments; i++) thetas.push(thetaStart + ((thetaEnd - thetaStart) * i) / segments);
  // Mueve la columna más cercana a cada ángulo clave para que el arco del broche
  // arranque limpio, sin escalones.
  for (const snap of snapThetas) {
    let best = 0;
    for (let i = 1; i < thetas.length; i++) if (Math.abs(thetas[i] - snap) < Math.abs(thetas[best] - snap)) best = i;
    thetas[best] = snap;
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const cols = thetas.length;
  const rows = HEIGHT_SEGMENTS + 1;
  const meridianLength = 0.16;
  const radius = (CAP_SHAPE.halfWidth + CAP_SHAPE.halfLength) / 2;

  for (const theta of thetas) {
    const smin = withOpening ? openingArch(theta) : 0;
    for (let j = 0; j < rows; j++) {
      const t = j / HEIGHT_SEGMENTS;
      const s = smin + t * (1 - smin);
      const p = crownPoint(theta, s);
      const n = crownNormal(theta, s);
      positions.push(...p);
      normals.push(...n);
      if (tiledDensity) {
        uvs.push(theta * radius * tiledDensity, s * meridianLength * tiledDensity);
      } else {
        uvs.push((theta - thetaStart) / (thetaEnd - thetaStart), s);
      }
    }
  }

  const index: number[] = [];
  for (let i = 0; i < cols - 1; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j;
      const b = (i + 1) * rows + j;
      const c = (i + 1) * rows + j + 1;
      const d = i * rows + j + 1;
      index.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

/** Visera precurva: cara superior, inferior y canto, con UV para los pespuntes. */
function visorGeometry() {
  const { halfWidth: a, halfLength: b, visorHalfAngle, visorLength } = CAP_SHAPE;
  const NU = 72;
  const NV = 18;
  const thickness = 0.0034;
  const tilt = Math.tan((17 * Math.PI) / 180);
  // Curva de fábrica: los lados caen más que el centro y la punta se dobla un poco.
  const sideCurve = 3.6;
  const tipCurve = 1.4;

  // Superficie media de la visera.
  const mid: THREE.Vector3[][] = [];
  for (let i = 0; i <= NU; i++) {
    const u = (i / NU) * 2 - 1;
    const theta = u * visorHalfAngle;
    // Orilla interior pegada a la base de la corona (un poco hacia adentro).
    const inner = new THREE.Vector3(a * Math.sin(theta) * 0.985, 0.002, b * Math.cos(theta) * 0.985);
    const normal = new THREE.Vector3(Math.sin(theta) / a, 0, Math.cos(theta) / b).normalize();
    const dir = normal.multiplyScalar(0.4).add(new THREE.Vector3(0, 0, 0.6)).normalize();
    const len = visorLength * Math.pow(Math.max(1 - Math.pow(Math.abs(u), 2.3), 0), 0.62);
    const col: THREE.Vector3[] = [];
    for (let j = 0; j <= NV; j++) {
      const v = j / NV;
      const d = len * v; // distancia desde la costura con la corona
      const p = inner.clone().addScaledVector(dir, d);
      // Inclinación hacia abajo + caída proporcional a lo que sobresale (en las
      // puntas, donde la visera muere en la corona, no cuelga nada).
      p.y -= d * tilt + sideCurve * p.x * p.x * (d / visorLength) + tipCurve * d * d;
      col.push(p);
    }
    mid.push(col);
  }

  const top: number[] = [];
  const bottom: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= NU; i++) {
    for (let j = 0; j <= NV; j++) {
      const p = mid[i][j];
      top.push(p.x, p.y + thickness / 2, p.z);
      bottom.push(p.x, p.y - thickness / 2, p.z);
      uv.push(i / NU, j / NV);
    }
  }
  const idx = (i: number, j: number) => i * (NV + 1) + j;
  const topIndex: number[] = [];
  const bottomIndex: number[] = [];
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a0 = idx(i, j);
      const b0 = idx(i + 1, j);
      const c0 = idx(i + 1, j + 1);
      const d0 = idx(i, j + 1);
      // Arriba: normal hacia +Y; abajo, al revés.
      topIndex.push(a0, c0, b0, a0, d0, c0);
      bottomIndex.push(a0, b0, c0, a0, c0, d0);
    }
  }
  const make = (pos: number[], index: number[], withUv: boolean) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    if (withUv) g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  };
  const topGeo = make(top, topIndex, true);
  const bottomGeo = make(bottom, bottomIndex, true);

  // Canto exterior: une arriba y abajo por la orilla (v = 1).
  const rim: number[] = [];
  const rimIndex: number[] = [];
  for (let i = 0; i <= NU; i++) {
    const p = mid[i][NV];
    rim.push(p.x, p.y + thickness / 2, p.z, p.x, p.y - thickness / 2, p.z);
  }
  for (let i = 0; i < NU; i++) {
    const a0 = i * 2;
    rimIndex.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2);
  }
  const rimGeo = new THREE.BufferGeometry();
  rimGeo.setAttribute("position", new THREE.Float32BufferAttribute(rim, 3));
  rimGeo.setIndex(rimIndex);
  rimGeo.computeVertexNormals();

  return { topGeo, bottomGeo, rimGeo };
}

/** Tubo a lo largo de puntos de la corona, despegado un poco hacia afuera. */
function tubeAlong(points: Point3[], normals: Point3[], offset: number, radius: number, closed = false) {
  const pts = points.map(
    (p, i) => new THREE.Vector3(p[0] + normals[i][0] * offset, p[1] + normals[i][1] * offset, p[2] + normals[i][2] * offset),
  );
  const curve = new THREE.CatmullRomCurve3(pts, closed, "centripetal");
  return new THREE.TubeGeometry(curve, Math.max(points.length * 2, 32), radius, 8, closed);
}

/** Banda delgada que sigue la base (sudadero y correa del broche). */
function baseBand(thetaStart: number, thetaEnd: number, scale: number, y0: number, y1: number, segments: number) {
  const pos: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = thetaStart + ((thetaEnd - thetaStart) * i) / segments;
    const x = CAP_SHAPE.halfWidth * Math.sin(t) * scale;
    const z = CAP_SHAPE.halfLength * Math.cos(t) * scale;
    pos.push(x, y0, z, x, y1, z);
  }
  for (let i = 0; i < segments; i++) {
    const a0 = i * 2;
    index.push(a0, a0 + 2, a0 + 3, a0, a0 + 3, a0 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

export function createTruckerCapModel(colors: GarmentColors): GarmentModel {
  const defaults = DEFAULT_COLORS.cap;
  const fw = CAP_SHAPE.frontHalfAngle;
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  const frontTex = frontPanelTextures();
  const meshTex = meshTextures();
  const visorTex = visorTextures();
  [frontTex.map, frontTex.bumpMap, meshTex.map, meshTex.bumpMap, visorTex.map, visorTex.bumpMap].forEach(track);

  const frontMat = track(
    new THREE.MeshPhysicalMaterial({
      map: frontTex.map,
      bumpMap: frontTex.bumpMap,
      bumpScale: 0.6,
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide,
      sheen: 0.5,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color("#ffffff").multiplyScalar(0.3),
    }),
  );
  const meshMat = track(
    new THREE.MeshStandardMaterial({
      map: meshTex.map,
      bumpMap: meshTex.bumpMap,
      bumpScale: 0.9,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  const visorTopMat = track(
    new THREE.MeshStandardMaterial({ map: visorTex.map, bumpMap: visorTex.bumpMap, bumpScale: 0.5, roughness: 0.78 }),
  );
  const visorBottomMat = track(new THREE.MeshStandardMaterial({ roughness: 0.85 }));
  const visorRimMat = track(new THREE.MeshStandardMaterial({ roughness: 0.8 }));
  const buttonMat = track(new THREE.MeshStandardMaterial({ roughness: 0.7 }));
  const strapMat = track(new THREE.MeshStandardMaterial({ roughness: 0.45, side: THREE.DoubleSide }));
  const bindingMat = track(new THREE.MeshStandardMaterial({ roughness: 0.85 }));
  const sweatbandMat = track(
    new THREE.MeshStandardMaterial({ color: "#3a3a3a", roughness: 0.95, side: THREE.DoubleSide }),
  );

  const root = new THREE.Group();
  root.name = "garment-cap";

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    track(geo);
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // Corona: frente estructurado + 3 paneles de malla con la abertura del broche.
  const front = add(crownPatch({ thetaStart: -fw, thetaEnd: fw, segments: FRONT_SEGMENTS }), frontMat, "front");
  const w = CAP_SHAPE.openingHalfAngle;
  const mesh = add(
    crownPatch({
      thetaStart: fw,
      thetaEnd: Math.PI * 2 - fw,
      segments: MESH_SEGMENTS,
      tiledDensity: 1 / 0.0085,
      withOpening: true,
      snapThetas: [Math.PI - w, Math.PI + w],
    }),
    meshMat,
    "mesh",
  );

  // Visera.
  const visor = visorGeometry();
  add(visor.topGeo, visorTopMat, "visor");
  add(visor.bottomGeo, visorBottomMat, "visor-bottom");
  add(visor.rimGeo, visorRimMat, "visor-rim");

  // Costuras de los paneles traseros (3 paneles entre los frontales).
  const rearArc = Math.PI * 2 - 2 * fw;
  const seamThetas = [fw, fw + rearArc / 3, fw + (2 * rearArc) / 3, Math.PI * 2 - fw];
  for (const theta of seamThetas) {
    const pts: Point3[] = [];
    const ns: Point3[] = [];
    const smin = openingArch(theta);
    for (let j = 0; j <= 40; j++) {
      const s = smin + (j / 40) * (0.985 - smin);
      pts.push(crownPoint(theta, s));
      ns.push(crownNormal(theta, s));
    }
    add(tubeAlong(pts, ns, 0.0005, 0.0008), bindingMat, "seam");
  }

  // Ribete del arco del broche.
  {
    const pts: Point3[] = [];
    const ns: Point3[] = [];
    for (let i = 0; i <= 48; i++) {
      const theta = Math.PI - w + (2 * w * i) / 48;
      const s = openingArch(theta);
      pts.push(crownPoint(theta, s));
      ns.push(crownNormal(theta, s));
    }
    add(tubeAlong(pts, ns, 0.0004, 0.0022), bindingMat, "binding");
  }

  // Botón superior.
  {
    const top = crownPoint(0, 1);
    const geo = new THREE.SphereGeometry(0.0088, 28, 14);
    geo.scale(1, 0.42, 1);
    geo.translate(top[0], top[1] + 0.0012, top[2]);
    add(geo, buttonMat, "button");
  }

  // Sudadero: banda oscura por dentro de la base (se asoma por el broche).
  add(baseBand(0, Math.PI * 2, 0.962, 0.0005, 0.022, 160), sweatbandMat, "sweatband");

  // Broche (snapback): correa por dentro de la abertura con sus botones.
  {
    const ext = w + 0.16;
    add(baseBand(Math.PI - ext, Math.PI + ext, 0.976, 0.004, 0.0175, 48), strapMat, "strap");
    const studGeo = new THREE.CylinderGeometry(0.0026, 0.0026, 0.0022, 16);
    studGeo.rotateX(Math.PI / 2);
    for (let k = -3; k <= 3; k++) {
      const theta = Math.PI + k * (w / 3.6);
      const x = CAP_SHAPE.halfWidth * Math.sin(theta) * 0.978;
      const z = CAP_SHAPE.halfLength * Math.cos(theta) * 0.978;
      const g = studGeo.clone();
      const n = new THREE.Vector3(Math.sin(theta) / CAP_SHAPE.halfWidth, 0, Math.cos(theta) / CAP_SHAPE.halfLength).normalize();
      g.lookAt(n);
      g.translate(x, 0.0108, z);
      add(g, strapMat, "strap-stud");
    }
    studGeo.dispose();
  }

  // La corona es hueca: sin esto la sombra de contacto sale como un anillo.
  // Un disco en la base, visible sólo para la cámara de la sombra, la rellena.
  {
    const geo = track(new THREE.CircleGeometry(1, 64));
    geo.rotateX(-Math.PI / 2);
    geo.scale(CAP_SHAPE.halfWidth * 0.96, 1, CAP_SHAPE.halfLength * 0.96);
    geo.translate(0, 0.03, 0);
    const proxy = new THREE.Mesh(geo, track(new THREE.MeshBasicMaterial()));
    proxy.name = "shadow-proxy";
    proxy.layers.set(SHADOW_ONLY_LAYER);
    root.add(proxy);
  }

  // Colores: frente/botón/broche = body; malla y ribete = mesh; visera = visor.
  const target = {
    body: new THREE.Color(),
    mesh: new THREE.Color(),
    visor: new THREE.Color(),
    visorUnder: new THREE.Color(),
  };
  const bodyMats = [frontMat, buttonMat, strapMat];
  const meshMats = [meshMat, bindingMat];
  const visorMats = [visorTopMat, visorRimMat];

  const setColors = (next: GarmentColors, immediate?: boolean) => {
    target.body.copy(parseColor(next.body, defaults.body));
    target.mesh.copy(parseColor(next.mesh, defaults.mesh ?? "#ffffff"));
    target.visor.copy(parseColor(next.visor, next.body || defaults.visor || defaults.body));
    target.visorUnder.copy(target.visor).multiplyScalar(0.82);
    if (immediate) {
      bodyMats.forEach((m) => m.color.copy(target.body));
      meshMats.forEach((m) => m.color.copy(target.mesh));
      visorMats.forEach((m) => m.color.copy(target.visor));
      visorBottomMat.color.copy(target.visorUnder);
    }
  };
  setColors(colors, true);

  return {
    root,
    decalTargets: [front, mesh],
    setColors,
    update(delta) {
      let moving = false;
      for (const m of bodyMats) moving = dampColor(m.color, target.body, 6, delta) || moving;
      for (const m of meshMats) moving = dampColor(m.color, target.mesh, 6, delta) || moving;
      for (const m of visorMats) moving = dampColor(m.color, target.visor, 6, delta) || moving;
      moving = dampColor(visorBottomMat.color, target.visorUnder, 6, delta) || moving;
      return moving;
    },
    decalDepth(scale) {
      return THREE.MathUtils.clamp(scale * 0.6, 0.02, 0.06);
    },
    // Casi al centro de la corona: con el centro de la caja la visera jala el
    // encuadre hacia adelante y la vista de atrás sale más chica que la de frente.
    focus: new THREE.Vector3(0, 0.05, 0.035),
    viewElevation: 0.2,
    shadow: { size: 0.6, far: 0.14, blur: 2, opacity: 0.55 },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
