import * as THREE from "three";
import { DEFAULT_COLORS, RAW_STEEL_HEX, isRawSteel, type GarmentColors } from "@/lib/mockups/types";
import {
  TERMO,
  TERMO_SHAPE,
  termoBodyProfile,
  termoLidProfile,
  wrapDecalArrays,
  type DrinkwareShape,
} from "./drinkwareShape";
import { dampColor, parseColor, type GarmentModel } from "./garmentModel";

/**
 * Termo (tumbler de acero inoxidable con pintura electrostática), construido
 * por código (`LatheGeometry`). La taza es un GLB (`GlbModel.ts`).
 *
 * Los diseños no usan el proyector plano de las prendas: se "envuelven" sobre
 * el cilindro (`wrapDecalArrays`), con el ancho medido sobre la superficie.
 */

const LATHE_SEGMENTS = 128;

let brushedCache: THREE.CanvasTexture | null = null;
let brushedUsers = 0;

/**
 * Textura de rugosidad de acero cepillado: vetas finas horizontales (en las
 * UV del torno y de los diseños, horizontal = alrededor del termo). Se
 * comparte entre el cuerpo y los grabados; cada usuario la libera con
 * `releaseBrushedTexture`.
 */
export function acquireBrushedTexture(): THREE.CanvasTexture {
  brushedUsers++;
  if (brushedCache) return brushedCache;
  const W = 256;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, W, H);
    // Ruido determinista (LCG) para que el mockup salga igual cada vez.
    let seed = 1337;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let y = 0; y < H; y++) {
      const g = 128 + (rand() - 0.5) * 70;
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 0.35;
    for (let k = 0; k < 900; k++) {
      const g = rand() > 0.5 ? 210 : 60;
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(rand() * W, rand() * H, 20 + rand() * 120, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  brushedCache = tex;
  return tex;
}

export function releaseBrushedTexture() {
  brushedUsers = Math.max(0, brushedUsers - 1);
  if (brushedUsers === 0 && brushedCache) {
    brushedCache.dispose();
    brushedCache = null;
  }
}

function lathe(points: [number, number][], segments = LATHE_SEGMENTS) {
  // Empieza en +X: la costura del torno queda de lado (en la taza, bajo el asa).
  const geo = new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
    Math.PI / 2,
  );
  geo.computeVertexNormals();
  return geo;
}

/** Geometría del diseño envuelta sobre el cuerpo (en el espacio local = mundo). */
export function wrapGeometry(
  shape: DrinkwareShape,
  position: THREE.Vector3,
  rotation: number,
  size: THREE.Vector3,
): THREE.BufferGeometry | null {
  const arrays = wrapDecalArrays(shape, position, rotation, size.x, size.y);
  if (!arrays) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(arrays.positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(arrays.normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(arrays.uvs, 2));
  geo.computeBoundingSphere();
  return geo;
}

/* --------------------------------- Termo --------------------------------- */

/** Pintura electrostática: satinada, sin brillo metálico. */
const POWDER = { metalness: 0.05, roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.6 };
/** Acero natural cepillado. */
const STEEL = { metalness: 1, roughness: 0.3, clearcoat: 0, clearcoatRoughness: 0 };

export function createTermoModel(colors: GarmentColors): GarmentModel {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const brushed = acquireBrushedTexture();
  const root = new THREE.Group();
  root.name = "termo";

  const bodyMat = track(
    new THREE.MeshPhysicalMaterial({
      ...POWDER,
      roughnessMap: null,
      anisotropy: 0,
      anisotropyRotation: 0,
    }),
  );
  const body = new THREE.Mesh(track(lathe(termoBodyProfile())), bodyMat);
  body.name = "termo-body";
  body.castShadow = true;
  root.add(body);

  // Aro de acero sin pintar justo bajo la tapa (como los tumblers reales).
  const lipMat = track(
    new THREE.MeshPhysicalMaterial({ color: RAW_STEEL_HEX, metalness: 1, roughness: 0.25, roughnessMap: brushed }),
  );
  const lip = new THREE.Mesh(
    track(
      lathe([
        [TERMO.topRadius - 0.0002, TERMO.topY - 0.0045],
        [TERMO.topRadius + 0.0003, TERMO.topY - 0.0035],
        [TERMO.topRadius + 0.0003, TERMO.topY - 0.0005],
      ]),
    ),
    lipMat,
  );
  root.add(lip);

  // Tapa transparente ahumada no se lee bien en un mockup: tapa negra a presión.
  const lidMat = track(
    new THREE.MeshPhysicalMaterial({ color: "#16171a", roughness: 0.38, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.35 }),
  );
  const lid = new THREE.Mesh(track(lathe(termoLidProfile())), lidMat);
  lid.name = "termo-lid";
  lid.castShadow = true;
  root.add(lid);

  // Corredera de la boquilla, hacia el frente.
  const lidTop = TERMO.topY - 0.004 + TERMO.lidHeight;
  const slider = new THREE.Mesh(
    track(new THREE.CapsuleGeometry(0.0045, 0.014, 6, 16)),
    track(new THREE.MeshStandardMaterial({ color: "#0c0c0e", roughness: 0.5 })),
  );
  slider.rotation.z = Math.PI / 2;
  slider.scale.set(1, 1, 0.35);
  slider.position.set(0, lidTop + 0.0012, TERMO.lidRadius * 0.45);
  root.add(slider);
  const mouth = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.016, 0.002, 0.005)),
    track(new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.8 })),
  );
  mouth.position.set(0, lidTop + 0.0004, TERMO.lidRadius * 0.72);
  root.add(mouth);

  const target = new THREE.Color();
  let steel = false;
  const applyFinish = (raw: boolean) => {
    steel = raw;
    const f = raw ? STEEL : POWDER;
    bodyMat.metalness = f.metalness;
    bodyMat.roughness = f.roughness;
    bodyMat.clearcoat = f.clearcoat;
    bodyMat.clearcoatRoughness = f.clearcoatRoughness;
    bodyMat.roughnessMap = raw ? brushed : null;
    bodyMat.anisotropy = raw ? 0.6 : 0;
    bodyMat.needsUpdate = true;
  };
  const setColors = (next: GarmentColors, immediate?: boolean) => {
    target.copy(parseColor(next.body, DEFAULT_COLORS.termo.body));
    if (isRawSteel(next.body) !== steel) applyFinish(isRawSteel(next.body));
    if (immediate) bodyMat.color.copy(target);
  };
  applyFinish(isRawSteel(colors.body));
  setColors(colors, true);

  return {
    root,
    decalTargets: [body],
    setColors,
    update: (delta) => dampColor(bodyMat.color, target, 6, delta),
    decalDepth: () => 0.02,
    decalGeometry: (position, _normal, rotation, size) => wrapGeometry(TERMO_SHAPE, position, rotation, size),
    focus: new THREE.Vector3(0, -0.004, 0),
    viewElevation: 0.12,
    shadow: { size: 0.4, far: 0.12, blur: 2.2, opacity: 0.6 },
    dispose() {
      disposables.forEach((d) => d.dispose());
      releaseBrushedTexture();
    },
  };
}
