import * as THREE from "three";
import { DEFAULT_COLORS, type GarmentColors } from "@/lib/mockups/types";
import { dampColor, parseColor, type GarmentModel } from "./garmentModel";
import { loadGlb } from "./glbLoader";

/**
 * Playera básica: GLB de pmndrs/examples (t-shirt-configurator, MIT) con la
 * oclusión ambiental horneada. Ver `public/models/README.md`.
 *
 * Espacio local = el del GLB: frente hacia +Z, arriba +Y, la izquierda de
 * quien la usa en +X. Mide ≈ 0.55 × 0.61 (ancho × alto).
 */

export const SHIRT_MODEL_URL = "/models/tshirt.glb";

export async function loadShirtModel(colors: GarmentColors): Promise<GarmentModel> {
  const gltf = await loadGlb(SHIRT_MODEL_URL);
  let source: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => {
    if (!source && (o as THREE.Mesh).isMesh && o.name === "T_Shirt_male") source = o as THREE.Mesh;
  });
  if (!source) throw new Error("El modelo de playera no trae la malla T_Shirt_male");
  const src = source as THREE.Mesh;
  const baseMaterial = src.material as THREE.MeshStandardMaterial;

  // Material propio por instancia: color animable sin tocar el GLB cacheado.
  // Rugosidad 1 = algodón mate; se conservan el normal map de tela y la AO.
  // El "sheen" (brillo de tela en ángulos rasantes) evita que las playeras
  // oscuras se vean como una silueta plana.
  const material = new THREE.MeshPhysicalMaterial({
    color: parseColor(colors.body, DEFAULT_COLORS.tshirt.body),
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    normalMap: baseMaterial.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    aoMap: baseMaterial.aoMap,
    aoMapIntensity: 0.6,
    sheen: 0.6,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color("#ffffff").multiplyScalar(0.35),
  });

  const mesh = new THREE.Mesh(src.geometry, material);
  mesh.name = "shirt";
  const root = new THREE.Group();
  root.name = "garment-tshirt";
  root.add(mesh);

  const target = material.color.clone();

  return {
    root,
    decalTargets: [mesh],
    setColors(next, immediate) {
      target.copy(parseColor(next.body, DEFAULT_COLORS.tshirt.body));
      if (immediate) material.color.copy(target);
    },
    update(delta) {
      return dampColor(material.color, target, 6, delta);
    },
    decalDepth(scale) {
      // Los triángulos que miran al otro lado se descartan, así que se puede
      // proyectar hondo y no recortar diseños en zonas curvas.
      return THREE.MathUtils.clamp(scale * 1.1, 0.04, 0.22);
    },
    viewElevation: 0.06,
    shadow: { size: 1.4, far: 0.75, blur: 2.6, opacity: 0.42 },
    dispose() {
      material.dispose();
      // La geometría y las texturas son del GLB cacheado y se comparten entre
      // lienzos. Cada renderer que las dibuja les cuelga un listener de
      // "dispose" que sólo se quita al disparar el evento: sin esto, cada
      // apertura del estudio deja vivo al renderer anterior. Los datos (arrays
      // e imágenes) siguen en memoria y el siguiente renderer los vuelve a subir.
      src.geometry.dispose();
      baseMaterial.normalMap?.dispose();
      baseMaterial.aoMap?.dispose();
    },
  };
}
