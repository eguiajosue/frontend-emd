import { arrivalTimeline, PRIORITY_STYLE, type ArrivalPriority, type ArrivalTimeline } from "@/lib/packageArrivals";

/**
 * Coreografía de la llegada de pedidos del Modo TV de Tareas: una impresora
 * térmica de tickets entra, imprime el ticket del pedido línea por línea, la
 * guillotina lo corta y el ticket vuela a su tarjeta. Aquí sólo hay
 * matemática pura (sin three ni DOM): parámetros por prioridad, el horario
 * de impresión/corte de cada ticket, la pose de la impresora y del papel en
 * cada milisegundo y la cuenta para pasar el ticket 3D a coordenadas de
 * pantalla (y de ahí al vuelo DOM a su tarjeta).
 *
 * Los tiempos grandes son los de `arrivalTimeline` (llega → imprime → vuela →
 * fin): la campanita, el brillo de la tarjeta y la cola no cambian entre la
 * versión 3D y la 2D (SVG) de respaldo, que usa este mismo horario.
 */

export type PrinterEntry = "drop" | "float" | "slide";
export type LedMode = "blink" | "steady" | "breathe";

export interface PrinterChoreo {
  /** Cómo entra la impresora: cae, baja flotando o entra deslizándose (cambios). */
  entry: PrinterEntry;
  /** Color de la prioridad (LED, contraluz, brillo del ticket). */
  color: string;
  /** Encabezado impreso del ticket ("VENCIDO", "CAMBIOS"…). */
  header: string;
  /** Tinta del encabezado: roja/violeta en los avisos fuertes, negra en el resto. */
  ink: string;
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
  /** LED de estado: parpadea (alarma), fijo o "respira" (calma), y su frecuencia. */
  led: LedMode;
  ledHz: number;
  /** De que se asienta a que arranca el motor (ms). */
  wakeMs: number;
  /** Lo que tarda en salir un ticket entero (ms) y en cuántos pasos de motor. */
  feedMs: number;
  feedSteps: number;
  /** Vibración de la impresora mientras imprime (unidades de mundo). */
  printJitter: number;
  /** Pausa entre que termina de salir y la guillotina corta (ms). */
  cutPause: number;
  /** Lo que tarda el ticket cortado en llegar frente a la cámara (ms). */
  riseMs: number;
  /** Papelitos que suelta el corte y su velocidad. */
  chips: number;
  chipSpeed: number;
  /** Curvatura del papel al salir (el rollo lo deja curvado hacia atrás). */
  curl: number;
  /** Acercamiento de cámara durante la llegada (unidades de mundo). */
  dolly: number;
  /** Destello del corte (intensidad). */
  flash: number;
  /** Latido de alarma de la luz de contorno (Hz); 0 = sin latido. */
  pulseHz: number;
}

export const CHOREO_3D: Record<ArrivalPriority, PrinterChoreo> = {
  overdue: {
    entry: "drop",
    color: PRIORITY_STYLE.overdue.color,
    header: "VENCIDO",
    ink: "#dc2626",
    dropHeight: 6.5,
    slideFrom: 0,
    stretch: 0.1,
    squash: 0.16,
    bounces: 1,
    bounceHeight: 0.16,
    shake: 0.12,
    shakeMs: 480,
    camShake: 0.05,
    tilt: 0.18,
    led: "blink",
    ledHz: 4,
    wakeMs: 120,
    feedMs: 620,
    feedSteps: 9,
    printJitter: 0.012,
    cutPause: 60,
    riseMs: 620,
    chips: 46,
    chipSpeed: 2.6,
    curl: 0.26,
    dolly: 0.8,
    flash: 1.3,
    pulseHz: 2.6,
  },
  at_risk: {
    entry: "drop",
    color: PRIORITY_STYLE.at_risk.color,
    header: "URGENTE",
    ink: "#0f172a",
    dropHeight: 5,
    slideFrom: 0,
    stretch: 0.07,
    squash: 0.12,
    bounces: 1,
    bounceHeight: 0.2,
    shake: 0,
    shakeMs: 0,
    camShake: 0.015,
    tilt: 0.1,
    led: "steady",
    ledHz: 0,
    wakeMs: 340,
    feedMs: 760,
    feedSteps: 8,
    printJitter: 0.006,
    cutPause: 90,
    riseMs: 600,
    chips: 34,
    chipSpeed: 2.1,
    curl: 0.22,
    dolly: 0.6,
    flash: 1,
    pulseHz: 0,
  },
  calm: {
    entry: "float",
    color: PRIORITY_STYLE.calm.color,
    header: "NUEVO",
    ink: "#0f172a",
    dropHeight: 3,
    slideFrom: 0,
    stretch: 0,
    squash: 0.04,
    bounces: 0,
    bounceHeight: 0,
    shake: 0,
    shakeMs: 0,
    camShake: 0,
    tilt: 0.06,
    led: "breathe",
    ledHz: 0.8,
    wakeMs: 200,
    feedMs: 900,
    feedSteps: 7,
    printJitter: 0.004,
    cutPause: 110,
    riseMs: 560,
    chips: 26,
    chipSpeed: 1.7,
    curl: 0.2,
    dolly: 0.5,
    flash: 0.7,
    pulseHz: 0,
  },
  changes: {
    entry: "slide",
    color: PRIORITY_STYLE.changes.color,
    header: "CAMBIOS",
    ink: "#7c3aed",
    dropHeight: 0,
    slideFrom: 7,
    stretch: 0,
    squash: 0.06,
    bounces: 0,
    bounceHeight: 0,
    shake: 0,
    shakeMs: 0,
    camShake: 0,
    tilt: 0.14,
    led: "steady",
    ledHz: 0,
    wakeMs: 180,
    feedMs: 820,
    feedSteps: 8,
    printJitter: 0.006,
    cutPause: 90,
    riseMs: 640,
    chips: 30,
    chipSpeed: 2,
    curl: 0.22,
    dolly: 0.5,
    flash: 0.9,
    pulseHz: 0,
  },
};

/** Lo que el ticket se queda quieto frente a la cámara antes de volar (ms): que se pueda leer. */
export const READ_HOLD_MS = 450;
/** Del corte a que el ticket arranca hacia la cámara (el "clac" de la guillotina). */
export const CUT_TO_RISE_MS = 60;
/** Lo que dura la pasada de la cuchilla (ida) antes del corte. */
export const BLADE_MS = 70;

/** Horario de un ticket (ms desde el inicio de la llegada). */
export interface TicketSlot {
  feedStart: number;
  feedEnd: number;
  /** La guillotina corta. */
  cut: number;
  riseStart: number;
  riseEnd: number;
}

/** Los tiempos de `arrivalTimeline` más los de la impresora. */
export interface PrintTimeline extends ArrivalTimeline {
  /** Un ticket por pedido del abanico (uno solo si no es lote), en orden de impresión. */
  tickets: TicketSlot[];
  /** La impresora termina de hundirse y desvanecerse después del pase al DOM. */
  sinkEnd: number;
}

/**
 * Horario de impresión. Un pedido: un ticket que sale a la velocidad de su
 * prioridad. Lote: `count` tickets cortos, uno detrás de otro (cada uno se
 * corta y sube a su lugar del abanico mientras sale el siguiente), repartidos
 * para que el último termine de subir `READ_HOLD_MS` antes de volar.
 */
export function printTimeline(priority: ArrivalPriority, batch = false, count = 1): PrintTimeline {
  const base = arrivalTimeline(priority, batch);
  const c = CHOREO_3D[priority];
  const first = base.land + c.wakeMs;
  const lastRiseEnd = base.fly - READ_HOLD_MS;
  const n = batch ? Math.max(1, count) : 1;
  const tickets: TicketSlot[] = [];
  if (n === 1) {
    const feed = Math.max(200, Math.min(c.feedMs, lastRiseEnd - c.riseMs - CUT_TO_RISE_MS - c.cutPause - first));
    const cut = first + feed + c.cutPause;
    const riseStart = cut + CUT_TO_RISE_MS;
    tickets.push({ feedStart: first, feedEnd: first + feed, cut, riseStart, riseEnd: Math.min(lastRiseEnd, riseStart + c.riseMs) });
  } else {
    const rise = Math.min(c.riseMs, 560);
    const pause = Math.min(c.cutPause, 50);
    const span = lastRiseEnd - rise - first;
    // Cada ticket del lote es corto: sale en ~la mitad del tiempo de uno suelto.
    const period = Math.min(c.feedMs * 0.55 + pause + CUT_TO_RISE_MS, span / n);
    const feed = Math.max(120, period - pause - CUT_TO_RISE_MS);
    for (let i = 0; i < n; i++) {
      const feedStart = Math.round(first + i * period);
      const cut = feedStart + Math.round(feed) + pause;
      const riseStart = cut + CUT_TO_RISE_MS;
      tickets.push({ feedStart, feedEnd: feedStart + Math.round(feed), cut, riseStart, riseEnd: riseStart + rise });
    }
  }
  return { ...base, tickets, sinkEnd: base.fly + 520 };
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

/**
 * Avance del papel a pasos de motor: en cada paso el papel se mueve durante
 * el 60 % del tiempo (con arranque y frenada suaves) y queda quieto el resto,
 * como el avance línea por línea de una impresora térmica. 0–1, monótono.
 */
export function steppedFeed(u: number, steps: number): number {
  const t = clamp01(u);
  if (steps <= 1) return easeInOutSine(t);
  if (t >= 1) return 1;
  const pos = t * steps;
  const i = Math.floor(pos);
  const f = pos - i;
  return (i + easeInOutSine(clamp01(f / 0.6))) / steps;
}

// --- Impresora ---------------------------------------------------------------

export interface PrinterPose {
  x: number;
  y: number;
  rotY: number;
  rotZ: number;
  /** Escalas (el pivote es la base: el aplastón no la despega del piso). */
  sx: number;
  sy: number;
  sz: number;
  /** 1 = sólida; baja a 0 al hundirse después del pase al DOM. */
  opacity: number;
}

const REST: PrinterPose = { x: 0, y: 0, rotY: 0, rotZ: 0, sx: 1, sy: 1, sz: 1, opacity: 1 };

/** Rebotes (se acortan y achican como una pelota). */
function hops(c: PrinterChoreo): { start: number; duration: number; height: number }[] {
  const out: { start: number; duration: number; height: number }[] = [];
  let start = 110;
  for (let i = 0; i < c.bounces; i++) {
    const duration = 220 * 0.6 ** i;
    out.push({ start, duration, height: c.bounceHeight * 0.4 ** i });
    start += duration;
  }
  return out;
}

/** ¿Está saliendo papel en `ms`? (para la vibración, el LED y el motor). */
export function isFeeding(ms: number, tl: PrintTimeline): boolean {
  return tl.tickets.some((s) => ms >= s.feedStart && ms < s.feedEnd);
}

/** Pose de la impresora en `ms`. */
export function printerPose(ms: number, c: PrinterChoreo, tl: PrintTimeline): PrinterPose {
  const p: PrinterPose = { ...REST };
  const land = tl.land;

  if (c.entry === "slide") {
    if (ms < land) {
      const u = segment(ms, 0, land);
      const e = easeOutBack(u, 1.2);
      p.x = c.slideFrom * (1 - e);
      // Se inclina al frenar (inercia) y gira un poco hacia la cámara.
      p.rotZ = c.tilt * Math.sin(Math.PI * u) * (1 - u * 0.5);
      p.rotY = -0.5 * (1 - easeOutCubic(u));
    } else {
      const a = ms - land;
      p.rotZ = c.tilt * 0.3 * Math.sin((a / 1000) * Math.PI * 2 * 3) * Math.exp(-a / 240);
    }
  } else if (c.entry === "float") {
    if (ms < land) {
      const u = segment(ms, 0, land);
      const e = easeOutCubic(u);
      p.y = c.dropHeight * (1 - e);
      p.rotY = 0.5 * (1 - e);
      p.rotZ = c.tilt * Math.sin(Math.PI * u);
    }
  } else if (ms < land) {
    // Caída con gravedad: acelera y se estira en la dirección del movimiento.
    const u = segment(ms, 0, land);
    p.y = c.dropHeight * (1 - easeInQuad(u));
    p.sy = 1 + c.stretch * u;
    p.sx = p.sz = 1 / Math.sqrt(p.sy);
    p.rotZ = c.tilt * (1 - u);
    p.rotY = 0.3 * (1 - u);
  }

  if (ms >= land) {
    const a = ms - land;
    // Aplastón al tocar el piso: lo que vende el peso.
    if (a < 160 && c.squash > 0) {
      const k = Math.sin(Math.PI * (a / 160));
      p.sy = 1 - c.squash * k;
      p.sx = p.sz = 1 + c.squash * 0.5 * k;
    }
    for (const hop of hops(c)) {
      const u = (a - hop.start) / hop.duration;
      if (u >= 0 && u <= 1) p.y = hop.height * 4 * u * (1 - u);
    }
    if (c.shake > 0 && a < c.shakeMs) {
      const decay = (1 - a / c.shakeMs) ** 2;
      p.x += c.shake * Math.sin((a / 1000) * Math.PI * 2 * 13) * decay;
      p.rotZ += c.shake * 0.4 * Math.sin((a / 1000) * Math.PI * 2 * 11 + 1.2) * decay;
    }
    // El motor hace vibrar la carcasa mientras imprime.
    if (c.printJitter > 0 && isFeeding(ms, tl)) {
      p.x += c.printJitter * Math.sin((ms / 1000) * Math.PI * 2 * 31);
      p.y += c.printJitter * 0.5 * Math.abs(Math.sin((ms / 1000) * Math.PI * 2 * 23));
    }
  }

  // Después del pase al DOM: se hunde y se desvanece.
  if (ms > tl.fly) {
    const u = segment(ms, tl.fly, tl.sinkEnd - tl.fly);
    const s = easeInCubic(u);
    p.y -= 0.9 * s;
    p.sx *= 1 - 0.1 * s;
    p.sy *= 1 - 0.1 * s;
    p.sz *= 1 - 0.1 * s;
    p.opacity = (1 - u) ** 2;
  }
  return p;
}

/** Brillo del LED de estado (0–1): en espera tenue; al llegar, según la prioridad. */
export function ledLevel(ms: number, c: PrinterChoreo, tl: PrintTimeline): number {
  if (ms < tl.land) return 0.25;
  const t = (ms - tl.land) / 1000;
  // Un "parpadeo" corto en cada corte (la impresora avisa que terminó).
  const cutBlink = tl.tickets.some((s) => ms >= s.cut && ms < s.cut + 90) ? 0.25 : 1;
  if (c.led === "blink") return (Math.sin(t * Math.PI * 2 * c.ledHz) > -0.2 ? 1 : 0.12) * cutBlink;
  if (c.led === "breathe") return (0.6 - 0.4 * Math.cos(t * Math.PI * 2 * c.ledHz)) * cutBlink;
  return cutBlink;
}

/**
 * Cuchilla de la guillotina: 0 = guardada a la izquierda, 1 = cruzó el papel.
 * Cruza en `BLADE_MS` terminando justo en el corte y vuelve más despacio.
 */
export function bladeTravel(ms: number, slot: TicketSlot): number {
  const go = easeInCubic(segment(ms, slot.cut - BLADE_MS, BLADE_MS));
  const back = easeInOutSine(segment(ms, slot.cut + 50, 170));
  return go * (1 - back);
}

/** Destello del corte: sube en 40 ms y se apaga en ~0.3 s. */
export function cutFlash(ms: number, slot: TicketSlot): number {
  const a = ms - slot.cut;
  if (a < 0) return 0;
  if (a < 40) return a / 40;
  return Math.exp(-(a - 40) / 160);
}

// --- Ticket ------------------------------------------------------------------

export interface TicketMotion {
  /** Fracción del ticket que ya salió de la ranura (0–1, a pasos de motor). */
  fed: number;
  /** Ya cortado. */
  cut: boolean;
  /** Saltito al soltarse de la guillotina (fracción del alto del ticket). */
  pop: number;
  /** Posición: 0 = en la ranura, 1 = frente a la cámara (pasa de largo un poco). */
  lift: number;
  /** Giro: 0 = como sale de la impresora, 1 = mirando a la cámara. */
  turn: number;
  /** Giro extra en el plano (aletea al soltarse y se asienta). */
  twist: number;
  /** Curvatura actual del papel (se aplana al llegar frente a la cámara). */
  curl: number;
  /** Visible (empieza a salir hasta el pase al DOM). */
  visible: boolean;
}

/** Movimiento del ticket `index` (en lote: uno detrás de otro). */
export function ticketMotion(ms: number, c: PrinterChoreo, tl: PrintTimeline, index = 0): TicketMotion {
  const slot = tl.tickets[Math.min(index, tl.tickets.length - 1)];
  const fed = steppedFeed(segment(ms, slot.feedStart, slot.feedEnd - slot.feedStart), c.feedSteps);
  const cut = ms >= slot.cut;
  const a = ms - slot.cut;
  const pop = cut ? 0.08 * Math.sin(Math.PI * clamp01(a / 160)) : 0;
  const u = segment(ms, slot.riseStart, Math.max(1, slot.riseEnd - slot.riseStart));
  const turn = easeInOutCubic(clamp01(u * 1.15));
  return {
    fed,
    cut,
    pop,
    lift: easeOutBack(u, 1.1),
    turn,
    twist: 0.35 * Math.sin(Math.PI * u) * (1 - u),
    curl: c.curl * (1 - turn),
    visible: ms >= slot.feedStart && ms < tl.fly,
  };
}

/**
 * Desplazamiento hacia atrás (z local) de un punto del papel a `d` unidades
 * de la ranura: el papel recién impreso se curva como el rollo del que sale.
 */
export function paperCurlOffset(d: number, curl: number): number {
  return d <= 0 ? 0 : -curl * d * d;
}

/** Acercamiento de cámara: arranca `dolly` más lejos y llega cuando el último ticket está frente a ella. */
export function cameraDolly(ms: number, c: PrinterChoreo, tl: PrintTimeline): number {
  const end = tl.tickets[tl.tickets.length - 1].riseEnd;
  return c.dolly * (1 - easeInOutSine(segment(ms, 0, end)));
}

/** Temblor vertical de cámara al aterrizar (sólo lo pesado). */
export function cameraShake(ms: number, c: PrinterChoreo, tl: PrintTimeline): number {
  const a = ms - tl.land;
  if (c.camShake <= 0 || a < 0 || a > 380) return 0;
  return c.camShake * Math.sin((a / 1000) * Math.PI * 2 * 17) * (1 - a / 380) ** 2;
}

/** Latido de alarma 0–1 (vencido); 0 si la prioridad no late. */
export function alarmPulse(ms: number, c: PrinterChoreo): number {
  return c.pulseHz > 0 ? 0.5 + 0.5 * Math.sin((ms / 1000) * Math.PI * 2 * c.pulseHz) : 0;
}

// --- Ticket impreso (contenido) ------------------------------------------------

/**
 * Barras del "código de barras" del ticket: anchos (px) alternando barra /
 * espacio, deterministas según el pedido, que llenan `width` px.
 */
export function barcodeBars(seed: number, width: number): number[] {
  let s = (Math.abs(Math.trunc(seed)) * 2654435761) % 4294967296 || 1;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const out: number[] = [];
  let used = 0;
  while (used < width) {
    const w = Math.min(width - used, 1 + Math.floor(rand() * 4));
    out.push(w);
    used += w;
  }
  return out;
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

/** Dónde quedó el ticket en pantalla: centro, tamaño y giro (grados). */
export interface ScreenSheet {
  cx: number;
  cy: number;
  width: number;
  height: number;
  angle: number;
}

/**
 * De las cuatro esquinas proyectadas (arriba-izq, arriba-der, abajo-der,
 * abajo-izq) al rectángulo girado que mejor las cubre. El ticket mira a la
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
 * El vuelo DOM del ticket: arranca exactamente donde quedó la 3D (escala y
 * giro) y termina con su borde de arriba sobre el de la tarjeta, del mismo
 * ancho. `natural` es el tamaño sin transformar del ticket DOM; el elemento
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

/** Ancho objetivo (px) del ticket 3D: legible desde lejos sin tapar todo. */
export function sheetPixelWidth(viewportWidth: number, batch: boolean, count: number): number {
  if (!batch) return Math.round(Math.min(380, Math.max(240, viewportWidth * 0.3)));
  // Lado a lado sin taparse (con un respiro de 4 % entre tickets).
  const each = (viewportWidth * 0.82) / (Math.max(1, count) * 1.04);
  return Math.round(Math.min(240, Math.max(150, each)));
}

/**
 * Dónde termina el ticket: `y` es la fracción de la altura de pantalla (desde
 * arriba) de su centro y `distance` la distancia a la cámara (entre la
 * cámara y la impresora). En lote, más abajo para que el abanico no se corte.
 */
export function sheetScreenTarget(batch: boolean): { y: number; distance: number } {
  return batch ? { y: 0.4, distance: 5.6 } : { y: 0.36, distance: 5 };
}

/** Abanico de `count` tickets: desplazamiento (en anchos de ticket) y giro (rad) de cada una. */
export function fanLayout(count: number): { offset: number; angle: number; depth: number }[] {
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => {
    const k = i - mid;
    return { offset: k * 1.04, angle: -k * 0.06, depth: -Math.abs(k) * 0.08 };
  });
}
