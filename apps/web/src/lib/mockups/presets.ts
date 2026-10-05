import type { DesignLayer, DesignPlacement, Garment, PlacementPreset } from "./types";

/**
 * Posiciones predeterminadas por prenda, en el espacio local de cada modelo
 * (ver `components/mockups/ShirtModel.ts` y `capShape.ts`).
 *
 * Izquierda / derecha son las de QUIEN USA la prenda (convención de bordado:
 * "pecho izquierdo" es el corazón). En el modelo, su izquierda está en +X, así
 * que vista de frente aparece a la derecha de la pantalla.
 *
 * Los puntos salen de raycasts sobre las mallas reales y los tests verifican
 * que sigan sobre la superficie si cambia el modelo.
 */
export const PLACEMENT_PRESETS: Record<Garment, PlacementPreset[]> = {
  tshirt: [
    {
      id: "centro-frente",
      label: "Centro frente",
      placement: { position: [0, 0.05, 0.1324], normal: [-0.01, 0.04, 0.999], scale: 0.2 },
      view: "front",
    },
    {
      id: "pecho-izquierdo",
      label: "Pecho izquierdo",
      placement: { position: [0.075, 0.11, 0.1156], normal: [0.23, 0.395, 0.889], scale: 0.07 },
      view: "front",
    },
    {
      id: "pecho-derecho",
      label: "Pecho derecho",
      placement: { position: [-0.075, 0.11, 0.1157], normal: [-0.221, 0.395, 0.891], scale: 0.07 },
      view: "front",
    },
    {
      id: "espalda-alta",
      label: "Espalda alta",
      placement: { position: [0, 0.15, -0.1109], normal: [-0.003, 0.243, -0.97], scale: 0.12 },
      view: "back",
    },
    {
      id: "centro-espalda",
      label: "Centro espalda",
      placement: { position: [0, 0, -0.117], normal: [0.037, -0.003, -0.999], scale: 0.2 },
      view: "back",
    },
    {
      id: "manga-izquierda",
      label: "Manga izquierda",
      placement: { position: [0.2463, 0.1, -0.015], normal: [0.977, 0.21, -0.027], scale: 0.05 },
      view: "left",
    },
    {
      id: "manga-derecha",
      label: "Manga derecha",
      placement: { position: [-0.2491, 0.1, -0.015], normal: [-0.971, 0.237, -0.035], scale: 0.05 },
      view: "right",
    },
  ],
  cap: [
    {
      id: "frente",
      label: "Frente",
      placement: { position: [0, 0.052, 0.0992], normal: [0, 0.28, 0.96], scale: 0.085 },
      view: "front",
    },
    {
      id: "lateral-izquierdo",
      label: "Lateral izquierdo",
      placement: { position: [0.0888, 0.04, 0.0065], normal: [0.967, 0.253, 0.044], scale: 0.045 },
      view: "left",
    },
    {
      id: "lateral-derecho",
      label: "Lateral derecho",
      placement: { position: [-0.0888, 0.04, 0.0065], normal: [-0.967, 0.253, 0.044], scale: 0.045 },
      view: "right",
    },
    {
      id: "atras",
      label: "Atrás",
      placement: { position: [0, 0.058, -0.0924], normal: [0, 0.464, -0.886], scale: 0.05 },
      view: "back",
    },
  ],
  // Sin modelo 3D todavía (ver lib/mockups/garments.ts): sus presets salen de
  // raycasts sobre el GLB cuando llegue. Mientras, `defaultPlacement` usa los
  // de la playera.
  hoodie: [],
  "dress-shirt": [],
};

/** Convierte un preset en `DesignPlacement` (copias: nunca comparte arreglos). */
export function presetPlacement(preset: PlacementPreset): DesignPlacement {
  return {
    position: [...preset.placement.position],
    normal: [...preset.placement.normal],
    scale: preset.placement.scale,
    rotation: preset.placement.rotation ?? 0,
  };
}

/** Dónde cae un diseño nuevo: el primer preset de la prenda (centro del frente). */
export function defaultPlacement(garment: Garment): DesignPlacement {
  const first = PLACEMENT_PRESETS[garment]?.[0] ?? PLACEMENT_PRESETS.tshirt[0];
  return presetPlacement(first);
}

/** Busca un preset por id dentro de la prenda. */
export function findPreset(garment: Garment, id: string): PlacementPreset | undefined {
  return (PLACEMENT_PRESETS[garment] ?? []).find((p) => p.id === id);
}

/**
 * Coloca la capa en el preset: posición, normal y tamaño estándar de esa
 * ubicación (el giro vuelve a 0 salvo que el preset diga otro). Devuelve una
 * capa nueva; no muta la original.
 */
export function applyPreset(layer: DesignLayer, preset: PlacementPreset): DesignLayer {
  return { ...layer, placement: presetPlacement(preset) };
}
