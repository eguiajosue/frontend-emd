import * as THREE from "three";
import { DEFAULT_COLORS, type GarmentColors } from "@/lib/mockups/types";
import { dampColor, parseColor, type GarmentModel } from "./garmentModel";
import { Disposer, VEHICLE_SCALE } from "./vehicleKit";

/**
 * Envoltorio común de los modelos de vehículo: toma lo que armó cada uno en
 * metros (grupo, mallas rotulables, materiales de pintura) y lo convierte en
 * un `GarmentModel` del estudio (escalado a unidades de escena, color
 * animado, sombra de contacto y profundidad de proyección de los diseños).
 */

export interface VehicleBuild {
  /** Todo el vehículo en metros (+Z al frente, +X a la izquierda, piso en y = 0). */
  group: THREE.Group;
  disposer: Disposer;
  /** Pinturas por parte de color: "body" (carrocería / cabina) y "mesh" (caja). */
  paints: { part: "body" | "mesh"; material: THREE.MeshPhysicalMaterial }[];
  /** Mallas donde se pegan los diseños (sólo superficies rotulables). */
  targets: THREE.Mesh[];
  /** Profundidad de proyección de un diseño de ancho `scale` (unidades de escena). */
  depth: (scale: number) => number;
  /** Elevación de la cámara en las vistas fijas. */
  elevation?: number;
  /** Mira la cámara (m, en el espacio del grupo). */
  focus?: THREE.Vector3;
  /** Escala metros → escena (por defecto `VEHICLE_SCALE`; la bicicleta se agranda para que no se vea diminuta). */
  scale?: number;
}

/** Los vértices sin color (cabinas, vidrios) se pintan de blanco para que `vertexColors` no los ponga negros. */
export function ensureVertexColors(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.getAttribute("color")) {
    const n = geo.getAttribute("position").count;
    geo.setAttribute("color", new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
  }
  return geo;
}

export function finishVehicle(build: VehicleBuild, defaults: GarmentColors, colors: GarmentColors, fallbackKey: keyof typeof DEFAULT_COLORS): GarmentModel {
  const root = new THREE.Group();
  root.name = `vehicle-${fallbackKey}`;
  const scale = build.scale ?? VEHICLE_SCALE;
  build.group.scale.setScalar(scale);
  root.add(build.group);
  root.updateMatrixWorld(true);

  const targets = new Map<"body" | "mesh", THREE.Color>();
  const base = DEFAULT_COLORS[fallbackKey];
  const colorOf = (part: "body" | "mesh", next: GarmentColors) =>
    parseColor(next[part], (defaults[part] ?? base[part] ?? base.body) as string);
  const setColors = (next: GarmentColors, immediate?: boolean) => {
    for (const p of build.paints) {
      const c = colorOf(p.part, next);
      targets.set(p.part, c);
      if (immediate) p.material.color.copy(c);
    }
  };
  setColors(colors, true);

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.z);
  const focus = build.focus ? build.focus.clone().multiplyScalar(scale) : new THREE.Vector3(center.x, center.y, center.z);

  return {
    root,
    decalTargets: build.targets,
    setColors,
    update: (delta) => {
      let moving = false;
      for (const p of build.paints) {
        const target = targets.get(p.part);
        if (target && dampColor(p.material.color, target, 6, delta)) moving = true;
      }
      return moving;
    },
    decalDepth: build.depth,
    focus,
    viewElevation: build.elevation ?? 0.14,
    shadow: { size: longest * 1.45, far: size.y * 0.45, blur: 2.4, opacity: 0.55 },
    dispose: () => build.disposer.dispose(),
  };
}
