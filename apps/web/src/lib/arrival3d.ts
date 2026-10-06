import { arrivalTimeline, PRIORITY_STYLE, type ArrivalPriority, type ArrivalTimeline } from "@/lib/packageArrivals";

/**
 * Coreografía de la llegada de paquetes en 3D (Modo TV de Tareas). Aquí sólo
 * hay matemática pura (sin three ni DOM): parámetros por prioridad, la pose
 * de la caja / solapas / hoja en cada milisegundo y la cuenta para pasar la
 * hoja 3D a coordenadas de pantalla (y de ahí al vuelo DOM a su tarjeta).
 *
 * Los tiempos grandes son los mismos de `arrivalTimeline` (aterriza → abre →
 * hoja → vuela → fin): la campanita, el brillo de la tarjeta y la cola no
 * cambian entre la versión 3D y la 2D (SVG) de respaldo.
 */

export type Entry3D = "drop" | "float" | "slide";

export interface Choreo3D {
  /** Cómo entra la caja: cae, baja flotando o vuelve deslizándose (cambios). */
  entry: Entry3D;
  /** Color de la prioridad (cinta, brillo, partículas). */
  color: string;
  /** Altura (unidades de mundo) desde la que cae / baja. */
  dropHeight: number;
  /** Desde dónde entra deslizándose (x, unidades de mundo). */
  slideFrom: number;
  /** Estirón en la caída y aplastón al tocar el piso (0–0.3). */
  stretch: number;
  squash: number;
  /** Rebotes después del aplastón y altura del primero. */
  bounces: number;
  bounceHeight: number;
  /** Sacudida al aterrizar (amplitud en x) y su duración. */
  shake: number;
  shakeMs: number;
  /** Temblor de cámara al aterrizar (vencido). */
  camShake: number;
  /** Inclinación con la que entra (radianes). */
  tilt: number;
  /** Solapas: duración de cada una, desfase entre ellas y "pasada" del easeOutBack. */
  flapMs: number;
  flapStagger: number;
  flapOvershoot: number;
  /** Partículas del estallido y su velocidad. */
  particles: number;
  particleSpeed: number;
  /** Brillo propio de la cinta (emisivo) en reposo. */
  emissive: number;
  /** Latido de alarma (Hz); 0 = sin latido. */
  pulseHz: number;
  /** Flotación después de aterrizar (unidades de mundo); 0 = quieta. */
  hover: number;
  /** Acercamiento de cámara durante la llegada (unidades de mundo). */
  dolly: number;
  /** Ondas en el piso al aterrizar. */
  rings: number;
  /** Intensidad del destello al abrir. */
  burst: number;
}

/** Ángulo de las solapas abiertas (≈112°: un poco hacia afuera, como una caja real). */
export const FLAP_OPEN_ANGLE = 1.95;

export const CHOREO_3D: Record<ArrivalPriority, Choreo3D> = {
  overdue: {
    entry: "drop",
    color: PRIORITY_STYLE.overdue.color,
    dropHeight: 7.5,
    slideFrom: 0,
    stretch: 0.14,
    squash: 0.26,
    bounces: 2,
    bounceHeight: 0.32,
    shake: 0.16,
    shakeMs: 520,
    camShake: 0.06,
    tilt: 0.22,
    flapMs: 380,
    flapStagger: 60,
    flapOvershoot: 2.2,
    particles: 280,
    particleSpeed: 5.2,
    emissive: 0.55,
    pulseHz: 2.6,
    hover: 0,
    dolly: 0.9,
    rings: 2,
    burst: 1.3,
  },
  at_risk: {
    entry: "drop",
    color: PRIORITY_STYLE.at_risk.color,
    dropHeight: 6,
    slideFrom: 0,
    stretch: 0.1,
    squash: 0.2,
    bounces: 3,
    bounceHeight: 0.5,
    shake: 0,
    shakeMs: 0,
    camShake: 0.02,
    tilt: 0.12,
    flapMs: 460,
    flapStagger: 80,
    flapOvershoot: 1.9,
    particles: 200,
    particleSpeed: 4.2,
    emissive: 0.3,
    pulseHz: 0,
    hover: 0,
    dolly: 0.7,
    rings: 1,
    burst: 1,
  },
  calm: {
    entry: "float",
    color: PRIORITY_STYLE.calm.color,
    dropHeight: 3.6,
    slideFrom: 0,
    stretch: 0,
    squash: 0.05,
    bounces: 0,
    bounceHeight: 0,
    shake: 0,
    shakeMs: 0,
    camShake: 0,
    tilt: 0.08,
    flapMs: 560,
    flapStagger: 100,
    flapOvershoot: 1.4,
    particles: 140,
    particleSpeed: 3,
    emissive: 0.18,
    pulseHz: 0,
    hover: 0.07,
    dolly: 0.6,
    rings: 1,
    burst: 0.75,
  },
  changes: {
    entry: "slide",
    color: PRIORITY_STYLE.changes.color,
    dropHeight: 0,
    slideFrom: 8,
    stretch: 0,
    squash: 0.08,
    bounces: 0,
    bounceHeight: 0,
    shake: 0,
    shakeMs: 0,
    camShake: 0,
    tilt: 0.16,
    flapMs: 480,
    flapStagger: 90,
    flapOvershoot: 1.7,
    particles: 170,
    particleSpeed: 3.6,
    emissive: 0.25,
    pulseHz: 0,
    hover: 0,
    dolly: 0.6,
    rings: 1,
    burst: 0.9,
  },
};

/** Los tiempos de `arrivalTimeline` más los de la escena 3D (ms desde el inicio). */
export interface Arrival3DTimeline extends ArrivalTimeline {
  /** Estallido de luz y partículas al abrirse las solapas. */
  burst: number;
  /** La hoja empieza a subir / termina de girar hacia la cámara. */
  riseStart: number;
  riseEnd: number;
  /** La caja termina de hundirse y desvanecerse después del pase al DOM. */
  sinkEnd: number;
}

export function arrival3DTimeline(priority: ArrivalPriority, batch = false): Arrival3DTimeline {
  const base = arrivalTimeline(priority, batch);
  const riseStart = base.open + 200;
  // La hoja queda quieta un momento antes de volar: que se pueda leer.
  const riseEnd = Math.min(base.sheet + 650, base.fly - 450);
  return { ...base, burst: base.open + 120, riseStart, riseEnd, sinkEnd: base.fly + 520 };
}

// --- Easings -----------------------------------------------------------------

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInCubic = (t: number) => t ** 3;
export const easeInQuad = (t: number) => t * t;
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** Pasa de largo y vuelve (`s` = cuánto). */
export function easeOutBack(t: number, s = 1.70158): number {
  const c3 = s + 1;
  return 1 + c3 * (t - 1) ** 3 + s * (t - 1) ** 2;
}

/** Progreso 0–1 de un tramo [start, start+duration]. */
export function segment(ms: number, start: number, duration: number): number {
  return duration <= 0 ? (ms >= start ? 1 : 0) : clamp01((ms - start) / duration);
}

// --- Poses -------------------------------------------------------------------

export interface BoxPose {
  x: number;
  y: number;
  rotY: number;
  rotZ: number;
  /** Escalas (el pivote es la base de la caja: el aplastón no la despega del piso). */
  sx: number;
  sy: number;
  sz: number;
  /** 1 = sólida; baja a 0 al hundirse después del pase al DOM. */
  opacity: number;
}

const REST: BoxPose = { x: 0, y: 0, rotY: 0, rotZ: 0, sx: 1, sy: 1, sz: 1, opacity: 1 };

/** Duración de cada rebote (se acortan y achican como una pelota). */
function hops(c: Choreo3D): { start: number; duration: number; height: number }[] {
  const out: { start: number; duration: number; height: number }[] = [];
  let start = 120;
  for (let i = 0; i < c.bounces; i++) {
    const duration = 260 * 0.6 ** i;
    out.push({ start, duration, height: c.bounceHeight * 0.4 ** i });
    start += duration;
  }
  return out;
}

/** Pose de la caja en `ms`. */
export function boxPose(ms: number, c: Choreo3D, tl: Arrival3DTimeline): BoxPose {
  const p: BoxPose = { ...REST };
  const land = tl.land;

  if (c.entry === "slide") {
    if (ms < land) {
      const u = segment(ms, 0, land);
      const e = easeOutBack(u, 1.25);
      p.x = c.slideFrom * (1 - e);
      // Se inclina hacia atrás al frenar (inercia) y gira un poco: "vuelve".
      p.rotZ = c.tilt * Math.sin(Math.PI * u) * (1 - u * 0.5);
      p.rotY = -0.45 * (1 - easeOutCubic(u));
    } else {
      const a = ms - land;
      p.rotZ = c.tilt * 0.35 * Math.sin((a / 1000) * Math.PI * 2 * 3) * Math.exp(-a / 260);
    }
  } else if (c.entry === "float") {
    if (ms < land) {
      const u = segment(ms, 0, land);
      const e = easeOutCubic(u);
      p.y = c.dropHeight * (1 - e);
      p.rotY = 0.55 * (1 - e);
      p.rotZ = c.tilt * Math.sin(Math.PI * u);
    }
  } else if (ms < land) {
    // Caída con gravedad: acelera, se estira en la dirección del movimiento.
    const u = segment(ms, 0, land);
    p.y = c.dropHeight * (1 - easeInQuad(u));
    p.sy = 1 + c.stretch * u;
    p.sx = p.sz = 1 / Math.sqrt(p.sy);
    p.rotZ = c.tilt * (1 - u);
    p.rotY = 0.35 * (1 - u);
  }

  if (ms >= land) {
    const a = ms - land;
    // Aplastón al tocar el piso: lo que vende el peso.
    if (a < 170 && c.squash > 0) {
      const k = Math.sin(Math.PI * (a / 170));
      p.sy = 1 - c.squash * k;
      p.sx = p.sz = 1 + c.squash * 0.55 * k;
    }
    for (const hop of hops(c)) {
      const u = (a - hop.start) / hop.duration;
      if (u >= 0 && u <= 1) p.y = hop.height * 4 * u * (1 - u);
    }
    if (c.shake > 0 && a < c.shakeMs) {
      const decay = (1 - a / c.shakeMs) ** 2;
      p.x += c.shake * Math.sin((a / 1000) * Math.PI * 2 * 13) * decay;
      p.rotZ += c.shake * 0.45 * Math.sin((a / 1000) * Math.PI * 2 * 11 + 1.2) * decay;
    }
    if (c.hover > 0) {
      const ramp = segment(a, 0, 450);
      p.y += c.hover * ramp * (0.5 - 0.5 * Math.cos((a / 2400) * Math.PI * 2));
    }
  }

  // Después del pase al DOM: se hunde y se desvanece.
  if (ms > tl.fly) {
    const s = easeInCubic(segment(ms, tl.fly, tl.sinkEnd - tl.fly));
    p.y -= 0.9 * s;
    p.sx *= 1 - 0.12 * s;
    p.sy *= 1 - 0.12 * s;
    p.sz *= 1 - 0.12 * s;
    // La opacidad cae antes que la caja: no queda tapando el tablero.
    p.opacity = (1 - segment(ms, tl.fly, tl.sinkEnd - tl.fly)) ** 2;
  }
  return p;
}

/**
 * Ángulo de una solapa (0 = cerrada, `FLAP_OPEN_ANGLE` = abierta). Orden:
 * primero las dos largas (las de la cinta), después las cortas de adentro.
 */
export function flapAngle(ms: number, c: Choreo3D, tl: Arrival3DTimeline, index: number): number {
  const u = segment(ms, tl.open + index * c.flapStagger, c.flapMs);
  return FLAP_OPEN_ANGLE * easeOutBack(u, c.flapOvershoot);
}

export interface SheetMotion {
  /** Posición: 0 = dentro de la caja, 1 = frente a la cámara (pasa de largo un poco). */
  lift: number;
  /** Giro: 0 = acostada, 1 = mirando a la cámara. */
  turn: number;
  /** Giro extra en el plano (aletea al salir y se asienta). */
  twist: number;
  /** Visible (sale de la caja hasta el pase al DOM). */
  visible: boolean;
}

/** Movimiento de la hoja `index` (en lote salen escalonadas, en abanico). */
export function sheetMotion(ms: number, tl: Arrival3DTimeline, index = 0): SheetMotion {
  const start = tl.riseStart + index * 90;
  const u = segment(ms, start, Math.max(1, tl.riseEnd - start));
  return {
    lift: easeOutBack(u, 1.15),
    turn: easeInOutCubic(clamp01(u * 1.15)),
    twist: 0.4 * Math.sin(Math.PI * u) * (1 - u),
    visible: ms >= start && ms < tl.fly,
  };
}

/** Destello de luz al abrir: sube rápido y se apaga en ~0.6 s. */
export function burstEnvelope(ms: number, tl: Arrival3DTimeline): number {
  const a = ms - tl.burst;
  if (a < 0) return 0;
  if (a < 90) return a / 90;
  return Math.exp(-(a - 90) / 320);
}

/** Acercamiento de cámara: arranca `dolly` más lejos y llega cuando la hoja termina de girar. */
export function cameraDolly(ms: number, c: Choreo3D, tl: Arrival3DTimeline): number {
  return c.dolly * (1 - easeInOutSine(segment(ms, 0, tl.riseEnd)));
}

/** Temblor vertical de cámara al aterrizar (sólo lo pesado). */
export function cameraShake(ms: number, c: Choreo3D, tl: Arrival3DTimeline): number {
  const a = ms - tl.land;
  if (c.camShake <= 0 || a < 0 || a > 380) return 0;
  return c.camShake * Math.sin((a / 1000) * Math.PI * 2 * 17) * (1 - a / 380) ** 2;
}

/** Latido de alarma 0–1 (vencido); 0 si la prioridad no late. */
export function alarmPulse(ms: number, c: Choreo3D): number {
  return c.pulseHz > 0 ? 0.5 + 0.5 * Math.sin((ms / 1000) * Math.PI * 2 * c.pulseHz) : 0;
}

/** Onda `index` en el piso: progreso 0–1 (o null si no corresponde). */
export function ringProgress(ms: number, c: Choreo3D, tl: Arrival3DTimeline, index: number): number | null {
  if (index >= c.rings) return null;
  const u = (ms - tl.land - index * 180) / 750;
  return u < 0 || u > 1 ? null : u;
}

// --- Pase a pantalla -----------------------------------------------------------

export interface Point2 {
  x: number;
  y: number;
}

export interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** NDC (−1…1, y hacia arriba) → píxeles CSS del viewport (y hacia abajo). */
export function ndcToScreen(ndc: Point2, viewport: Viewport): Point2 {
  return {
    x: viewport.left + ((ndc.x + 1) / 2) * viewport.width,
    y: viewport.top + ((1 - ndc.y) / 2) * viewport.height,
  };
}

/** Dónde quedó la hoja en pantalla: centro, tamaño y giro (grados). */
export interface ScreenSheet {
  cx: number;
  cy: number;
  width: number;
  height: number;
  angle: number;
}

/**
 * De las cuatro esquinas proyectadas (arriba-izq, arriba-der, abajo-der,
 * abajo-izq) al rectángulo girado que mejor las cubre. La hoja mira a la
 * cámara, así que la perspectiva casi no la deforma: se promedian lados
 * opuestos.
 */
export function quadToScreenSheet([tl, tr, br, bl]: [Point2, Point2, Point2, Point2]): ScreenSheet {
  const dist = (a: Point2, b: Point2) => Math.hypot(b.x - a.x, b.y - a.y);
  const top = { x: (tr.x - tl.x + br.x - bl.x) / 2, y: (tr.y - tl.y + br.y - bl.y) / 2 };
  return {
    cx: (tl.x + tr.x + br.x + bl.x) / 4,
    cy: (tl.y + tr.y + br.y + bl.y) / 4,
    width: (dist(tl, tr) + dist(bl, br)) / 2,
    height: (dist(tl, bl) + dist(tr, br)) / 2,
    angle: (Math.atan2(top.y, top.x) * 180) / Math.PI,
  };
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * El vuelo DOM de la hoja: arranca exactamente donde quedó la 3D (escala y
 * giro) y termina con su borde de arriba sobre el de la tarjeta, del mismo
 * ancho. `natural` es el tamaño sin transformar de la hoja DOM; el elemento
 * se posiciona con su centro en (cx, cy) y se mueve sólo con transform.
 */
export function sheetFlight(
  from: ScreenSheet,
  target: RectLike,
  natural: { width: number; height: number }
): { startScale: number; endScale: number; dx: number; dy: number; startAngle: number } {
  const startScale = natural.width > 0 ? from.width / natural.width : 1;
  const endScale = natural.width > 0 ? target.width / natural.width : 1;
  const endCx = target.left + target.width / 2;
  const endCy = target.top + (natural.height * endScale) / 2;
  return { startScale, endScale, dx: endCx - from.cx, dy: endCy - from.cy, startAngle: from.angle };
}

/** Ancho en mundo que ocupa `px` píxeles a `distance` de una cámara con `fovDeg` vertical. */
export function worldWidthForPixels(px: number, distance: number, fovDeg: number, viewportHeightPx: number): number {
  const visibleHeight = 2 * distance * Math.tan(((fovDeg / 2) * Math.PI) / 180);
  return viewportHeightPx > 0 ? (px * visibleHeight) / viewportHeightPx : 0;
}

/**
 * Distancia de cámara: la base, o más lejos si la pantalla es angosta y la
 * escena (`sceneWidth`) no entraría a lo ancho.
 */
export function cameraDistanceForAspect(aspect: number, base: number, fovDeg: number, sceneWidth: number): number {
  const vHalf = ((fovDeg / 2) * Math.PI) / 180;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(aspect, 0.1));
  return Math.max(base, sceneWidth / 2 / Math.tan(hHalf));
}

/** Ancho objetivo (px) de la hoja 3D: legible desde lejos sin tapar todo. */
export function sheetPixelWidth(viewportWidth: number, batch: boolean, count: number): number {
  if (!batch) return Math.round(Math.min(380, Math.max(240, viewportWidth * 0.3)));
  // Lado a lado sin taparse (con un respiro de 4 % entre hojas).
  const each = (viewportWidth * 0.82) / (Math.max(1, count) * 1.04);
  return Math.round(Math.min(240, Math.max(150, each)));
}

/**
 * Dónde termina la hoja: `y` es la fracción de la altura de pantalla (desde
 * arriba) de su centro y `distance` la distancia a la cámara (entre la
 * cámara y la caja). En lote, más abajo para que el abanico no se corte.
 */
export function sheetScreenTarget(batch: boolean): { y: number; distance: number } {
  return batch ? { y: 0.4, distance: 5.6 } : { y: 0.36, distance: 5 };
}

/** Abanico de `count` hojas: desplazamiento (en anchos de hoja) y giro (rad) de cada una. */
export function fanLayout(count: number): { offset: number; angle: number; depth: number }[] {
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => {
    const k = i - mid;
    return { offset: k * 1.04, angle: -k * 0.06, depth: -Math.abs(k) * 0.08 };
  });
}
