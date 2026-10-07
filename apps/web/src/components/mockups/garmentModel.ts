import * as THREE from "three";
import type { GarmentColors } from "@/lib/mockups/types";

/**
 * Lo que la escena necesita de cada prenda (playera GLB o gorra procedural).
 *
 * Todas las mallas viven en el espacio local de la prenda (el de
 * `DesignPlacement`); la raíz no lleva transformaciones propias.
 */
export interface GarmentModel {
  root: THREE.Group;
  /** Mallas donde se proyectan y arrastran los diseños. */
  decalTargets: THREE.Mesh[];
  /** Fija los colores destino; `update` los alcanza con suavidad. */
  setColors: (colors: GarmentColors, immediate?: boolean) => void;
  /** Avanza la animación de color. Devuelve true mientras siga moviéndose. */
  update: (delta: number) => boolean;
  /** Profundidad de proyección del decal según su ancho (evita atravesar la prenda). */
  decalDepth: (scale: number) => number;
  /**
   * Geometría propia para los diseños (termo/taza: envueltos sobre el
   * cilindro). Sin ella se usa el proyector plano (`buildDecalGeometry`).
   * `size` = [ancho, alto, profundidad], en el espacio de la prenda.
   */
  decalGeometry?: (
    position: THREE.Vector3,
    normal: THREE.Vector3,
    rotation: number,
    size: THREE.Vector3,
  ) => THREE.BufferGeometry | null;
  /** Punto al que mira la cámara (por defecto, el centro de la caja de la prenda). */
  focus?: THREE.Vector3;
  /** Elevación de la cámara (radianes sobre el horizonte) para las vistas fijas. */
  viewElevation: number;
  /** Ajustes de la sombra de contacto bajo la prenda. */
  shadow: { size: number; far: number; blur: number; opacity: number };
  dispose: () => void;
}

const _target = new THREE.Color();

/**
 * Acerca un color a su destino con amortiguamiento exponencial (independiente
 * de los FPS). Devuelve true si todavía no llega.
 */
export function dampColor(
  current: THREE.Color,
  target: THREE.Color,
  lambda: number,
  delta: number,
): boolean {
  const t = 1 - Math.exp(-lambda * delta);
  current.lerp(target, t);
  const d =
    Math.abs(current.r - target.r) + Math.abs(current.g - target.g) + Math.abs(current.b - target.b);
  if (d < 1e-4) {
    current.copy(target);
    return false;
  }
  return true;
}

/** Color destino a partir de un hex de CSS (con respaldo si viene vacío/raro). */
export function parseColor(value: string | undefined, fallback: string): THREE.Color {
  try {
    return _target.set(value && value.trim() ? value : fallback).clone();
  } catch {
    return new THREE.Color(fallback);
  }
}
