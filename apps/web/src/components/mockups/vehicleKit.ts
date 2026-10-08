import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Piezas comunes de los vehículos procedurales (hoy sólo la bicicleta; el
 * carro, la minivan, la pickup y el camión son GLB, ver `GlbModel.ts`). Todo
 * se construye en METROS, con +Z hacia el frente, +X hacia la izquierda del
 * vehículo y +Y hacia arriba; cada modelo lo mete en un grupo escalado
 * (`VEHICLE_SCALE`) para que el vehículo mida lo mismo que una prenda en la
 * escena (1 unidad de escena = 10 m).
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
