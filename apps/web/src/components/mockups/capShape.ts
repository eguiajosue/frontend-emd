/**
 * Forma paramétrica de la gorra trucker (estilo Richardson 112).
 *
 * Matemática pura (sin three) para que el modelo 3D, los presets y los tests
 * usen exactamente la misma superficie. Unidades en metros: la gorra mide lo
 * que una real (≈ 19 × 21 cm de base, ≈ 10.5 cm de corona).
 *
 * Ejes del espacio local de la gorra (el mismo de `DesignPlacement`):
 * +Z = frente, +Y = arriba, +X = lado IZQUIERDO de quien la usa
 * (la persona mira hacia +Z, así que su izquierda queda en +X).
 *
 * La corona se describe con dos parámetros:
 * - `theta`: azimut alrededor de la cabeza (0 = frente, π/2 = lado izquierdo,
 *   ±π = atrás).
 * - `s`: altura relativa de la base (0) al botón superior (1).
 */

export type Point3 = [number, number, number];

export const CAP_SHAPE = {
  /** Semieje lateral de la base (X). */
  halfWidth: 0.094,
  /** Semieje frente-atrás de la base (Z). */
  halfLength: 0.106,
  /** Altura del botón superior sobre la base. */
  height: 0.105,
  /** El botón queda un poco detrás del centro, como en una 112. */
  topZ: -0.012,
  /** Exponente de redondeo al frente: < 1 = frente alto y estructurado. */
  frontRoundness: 0.42,
  /** Exponente atrás: más cercano a 1 = caída suave hacia el broche. */
  backRoundness: 0.86,
  /** Medio ángulo que cubren los 2 paneles frontales (≈ 66°). */
  frontHalfAngle: (66 * Math.PI) / 180,
  /** Medio ángulo de la abertura del broche trasero. */
  openingHalfAngle: 0.36,
  /** Altura relativa (en `s`) del arco de la abertura trasera. */
  openingHeight: 0.2,
  /** Medio ángulo que abarca la visera alrededor del frente (≈ 80°). */
  visorHalfAngle: (80 * Math.PI) / 180,
  /** Largo de la visera al centro. */
  visorLength: 0.074,
} as const;

/** Envuelve un ángulo a (-π, π]. */
export function wrapAngle(theta: number): number {
  let t = theta % (Math.PI * 2);
  if (t > Math.PI) t -= Math.PI * 2;
  if (t <= -Math.PI) t += Math.PI * 2;
  return t;
}

/** Peso 1 al frente y 0 atrás, con transición suave por los lados. */
function frontWeight(theta: number): number {
  return Math.pow((1 + Math.cos(theta)) / 2, 1.5);
}

/** Exponente de redondeo de la corona en ese azimut. */
function roundness(theta: number): number {
  const w = frontWeight(theta);
  return CAP_SHAPE.backRoundness + (CAP_SHAPE.frontRoundness - CAP_SHAPE.backRoundness) * w;
}

/** Punto de la corona en (theta, s). */
export function crownPoint(theta: number, s: number): Point3 {
  const { halfWidth: a, halfLength: b, height: h, topZ } = CAP_SHAPE;
  const phi = Math.min(Math.max(s, 0), 1) * (Math.PI / 2);
  const rho = Math.pow(Math.max(Math.cos(phi), 0), roundness(theta));
  const y = h * Math.sin(phi);
  return [a * Math.sin(theta) * rho, y, b * Math.cos(theta) * rho + topZ * (1 - rho)];
}

/** Normal hacia afuera de la corona en (theta, s) por diferencias finitas. */
export function crownNormal(theta: number, s: number): Point3 {
  const e = 1e-4;
  const sc = Math.min(Math.max(s, e), 1 - 2e-3);
  const p0 = crownPoint(theta - e, sc);
  const p1 = crownPoint(theta + e, sc);
  const q0 = crownPoint(theta, sc - e);
  const q1 = crownPoint(theta, sc + e);
  const dt: Point3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const ds: Point3 = [q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]];
  // dθ × ds apunta hacia afuera (ver orientación de la malla en TruckerCapModel).
  const n: Point3 = [
    dt[1] * ds[2] - dt[2] * ds[1],
    dt[2] * ds[0] - dt[0] * ds[2],
    dt[0] * ds[1] - dt[1] * ds[0],
  ];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

/**
 * Altura relativa mínima de la corona en ese azimut: 0 en casi toda la base y
 * un arco (abertura del broche) atrás al centro.
 */
export function openingArch(theta: number): number {
  const d = Math.abs(wrapAngle(theta - Math.PI));
  const w = CAP_SHAPE.openingHalfAngle;
  if (d >= w) return 0;
  // Superelipse: costados casi rectos y esquinas redondeadas, como el arco real.
  const k = 2.6;
  return CAP_SHAPE.openingHeight * Math.pow(1 - Math.pow(d / w, k), 1 / k);
}

/** ¿El azimut cae en los paneles frontales estructurados? */
export function isFrontPanel(theta: number): boolean {
  return Math.abs(wrapAngle(theta)) <= CAP_SHAPE.frontHalfAngle;
}
