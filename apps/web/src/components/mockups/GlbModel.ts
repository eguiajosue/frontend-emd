import * as THREE from "three";
import { DEFAULT_COLORS, type Garment, type GarmentColors, type VehiclePart } from "@/lib/mockups/types";
import { TRAILER_ZONES } from "@/lib/mockups/vehicles";
import { wrapGeometry } from "./DrinkwareModel";
import { TAZA_SHAPE, type DrinkwareShape } from "./drinkwareShape";
import { dampColor, parseColor, type GarmentModel } from "./garmentModel";
import { loadGlb } from "./glbLoader";

/**
 * Modelos 3D de los productos que vienen en GLB (carro, minivan, pickup,
 * camión, taza y mousepad). Ver `public/models/README.md` para el origen de
 * cada archivo.
 *
 * Un GLB trae decenas de materiales (vidrios, llantas, faros…). Sólo la
 * pintura se puede cambiar de color: cada modelo dice qué materiales son
 * pintura (por nombre) y a qué parte de color pertenecen ("body" o "mesh").
 * Cada instancia clona esos materiales para animar el color sin tocar el GLB
 * que queda en caché.
 */

type ColorPartKey = "body" | "mesh";

interface PaintFinish {
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
}

/** Pintura automotriz: base satinada con barniz brillante encima. */
const CAR_PAINT: PaintFinish = { metalness: 0.28, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 };
/** Cerámica esmaltada (taza). */
const GLAZE: PaintFinish = { metalness: 0, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 };
/** Tapete de tela / hule: mate. */
const FABRIC: PaintFinish = { metalness: 0, roughness: 0.92, clearcoat: 0, clearcoatRoughness: 0 };

interface GlbSpec {
  url: string;
  /** Producto (de ahí salen los colores por omisión). */
  garment: Garment;
  /** Unidades del GLB → unidades de escena. */
  scale: number;
  /** Giro (rad) sobre Y para dejar el frente / asa donde esperan los presets. */
  rotationY?: number;
  /** Altura (escena) a la que apoya la parte más baja del modelo. */
  baseY?: number;
  /** Materiales de pintura: el nombre del material contiene `match`. */
  paints: { part: ColorPartKey; match: string }[];
  finish: PaintFinish;
  /** Pintura sin textura de color (el GLB trae una casi negra que impediría recolorear). */
  stripMap?: boolean;
  /** Cilindro sobre el que se envuelven los diseños (sin esto, proyector plano). */
  wrap?: DrinkwareShape;
  /** Profundidad de proyección de un diseño de ancho `scale` (unidades de escena). */
  depth: (scale: number) => number;
  elevation: number;
  /** Mira la cámara (por omisión, el centro de la caja). */
  focus?: THREE.Vector3;
  shadow: (size: THREE.Vector3) => { size: number; far: number; blur: number; opacity: number };
}

const vehicleDepth = (scale: number) => Math.min(0.1, Math.max(0.02, scale * 0.45));
const vehicleShadow = (size: THREE.Vector3) => ({
  size: Math.max(size.x, size.z) * 1.45,
  far: size.y * 0.45,
  blur: 2.4,
  opacity: 0.55,
});

export const GLB_SPECS = {
  car: {
    url: "/models/car.glb",
    garment: "car",
    scale: 0.1,
    paints: [{ part: "body", match: "Paint_MAT" }],
    finish: CAR_PAINT,
    depth: vehicleDepth,
    elevation: 0.14,
    shadow: vehicleShadow,
  },
  minivan: {
    url: "/models/minivan.glb",
    garment: "minivan",
    scale: 0.1,
    paints: [{ part: "body", match: "Car Paint" }],
    finish: CAR_PAINT,
    depth: vehicleDepth,
    elevation: 0.14,
    shadow: vehicleShadow,
  },
  pickup: {
    url: "/models/pickup.glb",
    garment: "pickup",
    scale: 0.1,
    // El GLB de la pickup mira hacia -Z.
    rotationY: Math.PI,
    paints: [{ part: "body", match: "body__prim" }],
    finish: CAR_PAINT,
    // La textura de la carrocería es un blanco crema con manchas: sin ella el color elegido sale limpio.
    stripMap: true,
    depth: vehicleDepth,
    elevation: 0.14,
    shadow: vehicleShadow,
  },
  trailer: {
    url: "/models/truck.glb",
    garment: "trailer",
    scale: 0.0755,
    paints: [
      { part: "body", match: "head_paint" },
      { part: "mesh", match: "bodycolour" },
    ],
    finish: CAR_PAINT,
    depth: (scale) => Math.min(0.14, Math.max(0.03, scale * 0.4)),
    elevation: 0.12,
    shadow: vehicleShadow,
  },
  taza: {
    url: "/models/mug.glb",
    garment: "taza",
    // Tazón de 8.3 cm de diámetro y 10.2 cm de alto (la medida de la taza de 11 oz).
    scale: 0.68,
    // En el GLB el asa sale hacia -Z; los presets la esperan hacia +X.
    rotationY: -Math.PI / 2,
    baseY: -0.048,
    paints: [{ part: "body", match: "Material" }],
    finish: GLAZE,
    wrap: TAZA_SHAPE,
    depth: () => 0.02,
    elevation: 0.22,
    focus: new THREE.Vector3(0.012, 0.003, 0),
    shadow: () => ({ size: 0.32, far: 0.1, blur: 2.2, opacity: 0.6 }),
  },
  mousepad: {
    url: "/models/mousepad.glb",
    garment: "mousepad",
    // 30 × 36 cm y 9 mm de grosor.
    scale: 0.15,
    paints: [{ part: "body", match: "Material" }],
    finish: FABRIC,
    stripMap: true,
    depth: (scale) => Math.min(0.03, Math.max(0.01, scale * 0.3)),
    // Casi de planta: se diseña sobre la cara de arriba.
    elevation: 1.05,
    shadow: (size) => ({ size: Math.max(size.x, size.z) * 1.7, far: 0.05, blur: 2.2, opacity: 0.5 }),
  },
} as const satisfies Record<string, GlbSpec>;

export type GlbGarment = keyof typeof GLB_SPECS;

export function isGlbGarment(value: unknown): value is GlbGarment {
  return typeof value === "string" && value in GLB_SPECS;
}

/** Cambia a `MeshPhysicalMaterial` (clearcoat) copiando el material estándar del GLB. */
function toPhysical(source: THREE.Material): THREE.MeshPhysicalMaterial {
  if ((source as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return (source as THREE.MeshPhysicalMaterial).clone();
  const next = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(next, source as THREE.MeshStandardMaterial);
  return next;
}

/**
 * Cabina o caja del camión: la malla pertenece a una u otra según de qué lado
 * del corte (en z) quede su centro. Los GLB no distinguen las dos partes.
 */
function keepForPart(centerZ: number, part: VehiclePart | undefined): boolean {
  if (!part || part === "full") return true;
  const cut = TRAILER_ZONES.cab.zMin;
  return part === "cab" ? centerZ > cut : centerZ <= cut;
}

export async function loadGlbModel(garment: GlbGarment, colors: GarmentColors, part?: VehiclePart): Promise<GarmentModel> {
  const spec: GlbSpec = GLB_SPECS[garment];
  const gltf = await loadGlb(spec.url);

  const root = new THREE.Group();
  root.name = `glb-${garment}`;
  const holder = new THREE.Group();
  holder.rotation.y = spec.rotationY ?? 0;
  holder.scale.setScalar(spec.scale);
  // El clon comparte geometrías y texturas con el GLB en caché.
  const scene = gltf.scene.clone(true);
  holder.add(scene);
  root.add(holder);
  root.updateMatrixWorld(true);

  // El piso no depende de qué parte se muestre: se mide con el modelo completo.
  holder.position.y = (spec.baseY ?? 0) - new THREE.Box3().setFromObject(root).min.y;
  root.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });

  if (garment === "trailer" && part && part !== "full") {
    const box = new THREE.Box3();
    for (let i = meshes.length - 1; i >= 0; i--) {
      if (keepForPart(box.setFromObject(meshes[i]).getCenter(new THREE.Vector3()).z, part)) continue;
      meshes[i].removeFromParent();
      meshes.splice(i, 1);
    }
    root.updateMatrixWorld(true);
  }

  const fallback = DEFAULT_COLORS[spec.garment];
  const paints: { part: ColorPartKey; material: THREE.MeshPhysicalMaterial }[] = [];
  const targets: THREE.Mesh[] = [];
  const ownMaterials = new Map<THREE.Material, THREE.Material>();
  const ownedList: THREE.Material[] = [];

  for (const mesh of meshes) {
    const original = mesh.material as THREE.Material;
    let own = ownMaterials.get(original);
    if (!own) {
      const rule = spec.paints.find((p) => original.name.includes(p.match));
      if (rule) {
        const paint = toPhysical(original);
        paint.metalness = spec.finish.metalness;
        paint.roughness = spec.finish.roughness;
        paint.clearcoat = spec.finish.clearcoat;
        paint.clearcoatRoughness = spec.finish.clearcoatRoughness;
        if (spec.stripMap) paint.map = null;
        paint.userData.paintPart = rule.part;
        paints.push({ part: rule.part, material: paint });
        own = paint;
      } else {
        const phys = original as THREE.MeshPhysicalMaterial;
        // La transmisión pide un render extra por cuadro y el renderer de
        // exportación no la necesita: los vidrios se dibujan translúcidos.
        if (phys.isMeshPhysicalMaterial && phys.transmission > 0) {
          const glass = phys.clone();
          glass.transmission = 0;
          glass.transparent = true;
          glass.opacity = Math.min(glass.opacity, 0.35);
          glass.depthWrite = false;
          own = glass;
        } else {
          own = original;
        }
      }
      ownMaterials.set(original, own);
      if (own !== original) ownedList.push(own);
    }
    mesh.material = own;
    if (own.userData.paintPart) targets.push(mesh);
  }
  if (!targets.length) throw new Error(`El modelo «${garment}» no trae materiales de pintura`);

  const colorTargets = new Map<ColorPartKey, THREE.Color>();
  const colorOf = (key: ColorPartKey, next: GarmentColors) =>
    parseColor(next[key], (fallback[key] ?? fallback.body) as string);
  const setColors = (next: GarmentColors, immediate?: boolean) => {
    for (const p of paints) {
      const c = colorOf(p.part, next);
      colorTargets.set(p.part, c);
      if (immediate) p.material.color.copy(c);
    }
  };
  setColors(colors, true);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  return {
    root,
    decalTargets: targets,
    setColors,
    update: (delta) => {
      let moving = false;
      for (const p of paints) {
        const target = colorTargets.get(p.part);
        if (target && dampColor(p.material.color, target, 6, delta)) moving = true;
      }
      return moving;
    },
    decalDepth: spec.depth,
    decalGeometry: spec.wrap
      ? (position, _normal, rotation, size) => wrapGeometry(spec.wrap!, position, rotation, size)
      : undefined,
    focus: spec.focus?.clone() ?? box.getCenter(new THREE.Vector3()),
    viewElevation: spec.elevation,
    shadow: spec.shadow(size),
    dispose() {
      ownedList.forEach((m) => m.dispose());
      // Geometrías y texturas son del GLB en caché y se comparten entre
      // lienzos. Cada renderer que las dibuja les cuelga un listener de
      // "dispose" que sólo se quita al disparar el evento: sin esto, cada
      // apertura del estudio deja vivo al renderer anterior. Los datos siguen
      // en memoria y el siguiente renderer los vuelve a subir.
      const textures = new Set<THREE.Texture>();
      for (const geometry of new Set(meshes.map((m) => m.geometry))) geometry.dispose();
      for (const mesh of meshes) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"] as const) {
          const t = mat[key];
          if (t) textures.add(t);
        }
      }
      textures.forEach((t) => t.dispose());
    },
  };
}
