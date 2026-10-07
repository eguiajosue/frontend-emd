import type { DesignLayer, DesignPlacement, Garment, PlacementPreset, VehiclePart } from "./types";

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
  // Termo y taza: cilindros (`components/mockups/drinkwareShape.ts`). Los
  // diseños se envuelven sobre la superficie, así que `scale` es el ancho
  // medido sobre el arco.
  termo: [
    {
      id: "frente",
      label: "Frente",
      placement: { position: [0, -0.005, 0.04073], normal: [0, -0.04229, 0.99911], scale: 0.06 },
      view: "front",
    },
    {
      id: "reverso",
      label: "Reverso",
      placement: { position: [0, -0.005, -0.04073], normal: [0, -0.04229, -0.99911], scale: 0.06 },
      view: "back",
    },
  ],
  taza: [
    {
      id: "frente",
      label: "Frente",
      placement: { position: [0, 0.001, 0.0416], normal: [0, 0, 1], scale: 0.06 },
      view: "front",
    },
    {
      id: "reverso",
      label: "Reverso",
      placement: { position: [0, 0.001, -0.0416], normal: [0, 0, -1], scale: 0.06 },
      view: "back",
    },
    {
      // Sublimación de vuelta completa: centrada enfrente del asa (que sale
      // por +X) y dejando libre la zona del asa.
      id: "alrededor",
      label: "Alrededor",
      placement: { position: [-0.0416, 0.001, 0], normal: [-1, 0, 0], scale: 0.19 },
      view: "right",
    },
  ],
  // Rotulaciones (vehículos): las posiciones salen de raycasts sobre las
  // superficies rotulables de cada modelo (`components/mockups/*Model.ts`, los
  // tests de `vehiclePresets.test.ts` verifican que sigan sobre la pintura).
  // Izquierda / derecha son las del vehículo (la izquierda del conductor está
  // en +X). Los diseños de techo, cofre y cajuela giran 180° para leerse
  // derechos en la vista "Arriba" (frente del vehículo hacia arriba).
  car: [
    { id: "puerta-izquierda", label: "Puerta izquierda", placement: { position: [0.092, 0.062, 0.02], normal: [1, 0, 0], scale: 0.06 }, view: "left" },
    { id: "puerta-derecha", label: "Puerta derecha", placement: { position: [-0.092, 0.062, 0.02], normal: [-1, 0, 0], scale: 0.06 }, view: "right" },
    { id: "costado-izquierdo", label: "Costado completo izquierdo", placement: { position: [0.092, 0.062, -0.035], normal: [1, 0, 0], scale: 0.14 }, view: "left" },
    { id: "costado-derecho", label: "Costado completo derecho", placement: { position: [-0.092, 0.062, -0.035], normal: [-1, 0, 0], scale: 0.14 }, view: "right" },
    { id: "cofre", label: "Cofre", placement: { position: [0, 0.08577, 0.14], normal: [0, 0.98739, 0.15832], scale: 0.08, rotation: Math.PI }, view: "top" },
    { id: "techo", label: "Techo", placement: { position: [0, 0.146, -0.05], normal: [0, 1, 0], scale: 0.08, rotation: Math.PI }, view: "top" },
    { id: "cajuela", label: "Cajuela", placement: { position: [0, 0.1, -0.19], normal: [0, 1, 0], scale: 0.07, rotation: Math.PI }, view: "top" },
    { id: "trasera", label: "Parte trasera", placement: { position: [0, 0.09, -0.2363], normal: [0, 0.40891, -0.91257], scale: 0.07 }, view: "back" },
  ],
  minivan: [
    { id: "puerta-izquierda", label: "Puerta izquierda", placement: { position: [0.099, 0.072, 0.06], normal: [1, 0, 0], scale: 0.07 }, view: "left" },
    { id: "puerta-corrediza-izquierda", label: "Puerta corrediza izquierda", placement: { position: [0.099, 0.072, -0.06], normal: [1, 0, 0], scale: 0.09 }, view: "left" },
    { id: "puerta-derecha", label: "Puerta derecha", placement: { position: [-0.099, 0.072, 0.06], normal: [-1, 0, 0], scale: 0.07 }, view: "right" },
    { id: "puerta-corrediza-derecha", label: "Puerta corrediza derecha", placement: { position: [-0.099, 0.072, -0.06], normal: [-1, 0, 0], scale: 0.09 }, view: "right" },
    { id: "cofre", label: "Cofre", placement: { position: [0, 0.08866, 0.18], normal: [0, 0.98695, 0.16101], scale: 0.08, rotation: Math.PI }, view: "top" },
    { id: "techo", label: "Techo", placement: { position: [0, 0.176, -0.09], normal: [0, 1, 0], scale: 0.1, rotation: Math.PI }, view: "top" },
    { id: "trasera", label: "Puerta trasera", placement: { position: [0, 0.095, -0.25475], normal: [0, 0.05327, -0.99858], scale: 0.08 }, view: "back" },
  ],
  pickup: [
    { id: "puerta-izquierda", label: "Puerta izquierda", placement: { position: [0.094, 0.078, 0.05], normal: [1, 0, 0], scale: 0.06 }, view: "left" },
    { id: "puerta-derecha", label: "Puerta derecha", placement: { position: [-0.094, 0.078, 0.05], normal: [-1, 0, 0], scale: 0.06 }, view: "right" },
    { id: "cofre", label: "Cofre", placement: { position: [0, 0.11184, 0.17], normal: [0, 0.99954, 0.03028], scale: 0.09, rotation: Math.PI }, view: "top" },
    { id: "techo", label: "Techo", placement: { position: [0, 0.18, -0.02], normal: [0, 1, 0], scale: 0.07, rotation: Math.PI }, view: "top" },
    { id: "caja-lateral-izquierdo", label: "Caja – lateral izquierdo", placement: { position: [0.095, 0.095, -0.18], normal: [1, 0, 0], scale: 0.12 }, view: "left" },
    { id: "caja-lateral-derecho", label: "Caja – lateral derecho", placement: { position: [-0.095, 0.095, -0.18], normal: [-1, 0, 0], scale: 0.12 }, view: "right" },
    { id: "caja-compuerta", label: "Caja – compuerta", placement: { position: [0, 0.082, -0.2655], normal: [0, 0, -1], scale: 0.1 }, view: "back" },
  ],
  trailer: [
    { id: "caja-lateral-izquierdo", label: "Caja – lateral izquierdo", placement: { position: [0.13, 0.26, -0.6], normal: [1, 0, 0], scale: 0.5 }, view: "left", parts: ["full", "box"] },
    { id: "caja-lateral-derecho", label: "Caja – lateral derecho", placement: { position: [-0.13, 0.26, -0.6], normal: [-1, 0, 0], scale: 0.5 }, view: "right", parts: ["full", "box"] },
    { id: "caja-puerta-trasera", label: "Caja – puerta trasera", placement: { position: [0, 0.26, -1.255], normal: [0, 0, -1], scale: 0.16 }, view: "back", parts: ["full", "box"] },
    { id: "caja-techo", label: "Caja – techo", placement: { position: [0, 0.405, -0.6], normal: [0, 1, 0], scale: 0.16, rotation: Math.PI }, view: "top", parts: ["full", "box"] },
    { id: "caja-frente", label: "Caja – frente", placement: { position: [0, 0.26, 0.085], normal: [0, 0, 1], scale: 0.16 }, view: "front", parts: ["box"] },
    { id: "cabina-puerta-izquierda", label: "Cabina – puerta izquierda", placement: { position: [0.12, 0.18, 0.43], normal: [1, 0, 0], scale: 0.07 }, view: "left", parts: ["full", "cab"] },
    { id: "cabina-puerta-derecha", label: "Cabina – puerta derecha", placement: { position: [-0.12, 0.18, 0.43], normal: [-1, 0, 0], scale: 0.07 }, view: "right", parts: ["full", "cab"] },
    { id: "cabina-cofre", label: "Cabina – cofre", placement: { position: [0, 0.22901, 0.6], normal: [0, 0.99501, 0.09976], scale: 0.12, rotation: Math.PI }, view: "top", parts: ["full", "cab"] },
    { id: "cabina-techo", label: "Cabina – techo", placement: { position: [0, 0.3409, 0.3], normal: [0, 0.99249, 0.12236], scale: 0.12, rotation: Math.PI }, view: "top", parts: ["full", "cab"] },
  ],
  bicycle: [
    { id: "tubo-diagonal-izquierdo", label: "Tubo diagonal izquierdo", placement: { position: [0.00563, 0.12875, 0.05], normal: [1, 0, 0], scale: 0.06 }, view: "left" },
    { id: "tubo-diagonal-derecho", label: "Tubo diagonal derecho", placement: { position: [-0.00562, 0.12875, 0.05], normal: [-1, 0, 0], scale: 0.06 }, view: "right" },
    { id: "guardafango-trasero", label: "Guardafango trasero", placement: { position: [0, 0.177, -0.14], normal: [0, 1, 0], scale: 0.045, rotation: Math.PI }, view: "top" },
    { id: "canastilla-frente", label: "Canastilla (frente)", placement: { position: [0, 0.2425, 0.194], normal: [0, 0, 1], scale: 0.07 }, view: "front" },
    { id: "canastilla-izquierda", label: "Canastilla (lado)", placement: { position: [0.044, 0.2425, 0.16], normal: [1, 0, 0], scale: 0.05 }, view: "left" },
  ],
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

/**
 * Presets de una prenda. En el tráiler sólo salen los de la parte que se ve
 * (completo, cabina o caja); el resto de las prendas ignora `part`.
 */
export function presetsFor(garment: Garment, part?: VehiclePart): PlacementPreset[] {
  const all = PLACEMENT_PRESETS[garment] ?? [];
  if (!part) return all;
  return all.filter((p) => !p.parts || p.parts.includes(part));
}

/** Dónde cae un diseño nuevo: el primer preset de la prenda (centro del frente). */
export function defaultPlacement(garment: Garment, part?: VehiclePart): DesignPlacement {
  const first = presetsFor(garment, part)[0] ?? PLACEMENT_PRESETS.tshirt[0];
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
