/**
 * Detector de lectores de código de barras "modo teclado" (USB o Bluetooth).
 *
 * Esos lectores no tienen API: escriben el código como si fuera un teclado,
 * carácter por carácter y muy rápido (2–20 ms entre teclas), y terminan con
 * Enter. Una persona, en cambio, rara vez baja de ~60 ms entre teclas. El
 * detector se queda con la racha de teclas rápidas más reciente y, al llegar
 * el Enter, la entrega como un escaneo si tiene el largo mínimo.
 *
 * Es una máquina de estados pura (recibe la tecla y su hora, devuelve el
 * estado nuevo y si hubo escaneo): el hook `useBarcodeScanner` la conecta a
 * `keydown` y los tests la ejercitan sin DOM ni relojes.
 */

export interface BurstOptions {
  /** Máximo entre dos caracteres de una misma ráfaga. */
  maxInterKeyMs: number;
  /** Máximo entre el último carácter y el Enter que la cierra. */
  maxEnterGapMs: number;
  /** Largo mínimo de un código (también el del backend). */
  minLength: number;
  /** Más largo que esto ya no es un código: se descarta. */
  maxLength: number;
}

export const DEFAULT_BURST_OPTIONS: BurstOptions = {
  maxInterKeyMs: 35,
  maxEnterGapMs: 100,
  minLength: 3,
  maxLength: 64,
};

export interface BurstState {
  /** Caracteres de la ráfaga en curso (sólo los que llegaron rápido). */
  buffer: string;
  /** Hora de la última tecla aceptada; `null` = sin ráfaga en curso. */
  lastTime: number | null;
}

export const INITIAL_BURST_STATE: BurstState = { buffer: "", lastTime: null };

export interface BurstKey {
  /** `KeyboardEvent.key`. */
  key: string;
  /** Milisegundos (p. ej. `event.timeStamp` o `performance.now()`). */
  time: number;
}

export type BurstResult =
  /** Nada que hacer con esta tecla (tecleo humano o fuera de ráfaga). */
  | { kind: "none" }
  /** La tecla se sumó a una ráfaga que ya parece un lector (≥ 2 teclas rápidas). */
  | { kind: "burst"; length: number }
  /** Enter que cierra una ráfaga válida: esto es un escaneo. */
  | { kind: "scan"; code: string };

/** Teclas que el lector manda alrededor de los caracteres y no cuentan. */
const IGNORED_KEYS = new Set(["Shift", "CapsLock", "Unidentified", "Dead"]);

export function burstStep(
  state: BurstState,
  { key, time }: BurstKey,
  options: BurstOptions = DEFAULT_BURST_OPTIONS
): { state: BurstState; result: BurstResult } {
  if (IGNORED_KEYS.has(key)) return { state, result: { kind: "none" } };

  const gap = state.lastTime === null ? Infinity : time - state.lastTime;

  if (key === "Enter") {
    const isScan =
      state.buffer.length >= options.minLength &&
      state.buffer.length <= options.maxLength &&
      gap <= options.maxEnterGapMs;
    return {
      state: INITIAL_BURST_STATE,
      result: isScan ? { kind: "scan", code: state.buffer } : { kind: "none" },
    };
  }

  // Cualquier otra tecla especial (Tab, flechas, Backspace...) corta la ráfaga.
  if (key.length !== 1) return { state: INITIAL_BURST_STATE, result: { kind: "none" } };

  // Lenta: arranca una ráfaga nueva con esta tecla (puede ser la primera del lector).
  if (gap > options.maxInterKeyMs) {
    return { state: { buffer: key, lastTime: time }, result: { kind: "none" } };
  }

  const buffer = state.buffer + key;
  if (buffer.length > options.maxLength) {
    return { state: INITIAL_BURST_STATE, result: { kind: "none" } };
  }
  return { state: { buffer, lastTime: time }, result: { kind: "burst", length: buffer.length } };
}

/** Versión con estado interno, para quien prefiere no cargar el estado a mano. */
export function createBurstDetector(options: Partial<BurstOptions> = {}) {
  const opts = { ...DEFAULT_BURST_OPTIONS, ...options };
  let state = INITIAL_BURST_STATE;
  return {
    push(key: string, time: number): BurstResult {
      const next = burstStep(state, { key, time }, opts);
      state = next.state;
      return next.result;
    },
    reset() {
      state = INITIAL_BURST_STATE;
    },
    get buffer() {
      return state.buffer;
    },
  };
}

/**
 * Evita que el mismo código cuente dos veces si el lector (o la cámara, que
 * ve el código en varios cuadros seguidos) lo entrega repetido en menos de
 * `windowMs`. Un código distinto siempre pasa.
 *
 * La ventana se corre con cada repetición: mientras la cámara siga viendo la
 * misma etiqueta no vuelve a contar; hay que quitarla de cuadro un momento.
 */
export function createDuplicateGuard(windowMs = 800) {
  let lastCode: string | null = null;
  let lastTime = -Infinity;
  return {
    accept(code: string, time: number): boolean {
      const duplicate = code === lastCode && time - lastTime < windowMs;
      lastCode = code;
      lastTime = time;
      return !duplicate;
    },
    reset() {
      lastCode = null;
      lastTime = -Infinity;
    },
  };
}
