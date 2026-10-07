import type { ArrivalPriority } from "@/lib/packageArrivals";

/**
 * Sonido del Modo TV de Tareas: una campanita sintetizada con Web Audio (sin
 * archivos), más insistente si el pedido llega vencido. Sólo suena dentro del
 * Modo TV y tiene su propio silencio, guardado en este navegador: la tele del
 * taller se silencia sin apagar los avisos del resto de la app.
 *
 * Autoplay: el navegador no deja sonar nada hasta el primer toque/tecla en la
 * página. `unlockTvAudio()` se llama en ese primer gesto; antes, la pantalla
 * muestra "Activar sonido".
 */

export const TV_MUTED_KEY = "emd-tv-sound-muted";

export function isTvSoundMuted(): boolean {
  try {
    return localStorage.getItem(TV_MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setTvSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(TV_MUTED_KEY, String(muted));
  } catch {
    // Sin localStorage (modo privado estricto): vale para esta sesión nada más.
  }
}

/** Una nota de la campanita: frecuencia (Hz), inicio y duración (s), forma. */
export interface ChimeNote {
  freq: number;
  at: number;
  dur: number;
  type: OscillatorType;
  gain: number;
}

/**
 * Patrones por prioridad. Calma: dos notas suaves ascendentes. Urgente: tres
 * notas. Vencido: el arpegio dos veces, más fuerte y con timbre más áspero.
 * Cambios: dos notas descendentes ("ojo, volvió").
 */
export function chimePattern(priority: ArrivalPriority): ChimeNote[] {
  switch (priority) {
    case "overdue": {
      const run = (start: number): ChimeNote[] =>
        [880, 1109, 1319].map((freq, i) => ({ freq, at: start + i * 0.11, dur: 0.16, type: "triangle", gain: 0.28 }));
      return [...run(0), ...run(0.42)];
    }
    case "at_risk":
      return [659, 831, 988].map((freq, i) => ({ freq, at: i * 0.13, dur: 0.22, type: "triangle", gain: 0.2 }));
    case "changes":
      return [
        { freq: 988, at: 0, dur: 0.22, type: "sine", gain: 0.18 },
        { freq: 740, at: 0.16, dur: 0.3, type: "sine", gain: 0.18 },
      ];
    default:
      return [
        { freq: 784, at: 0, dur: 0.25, type: "sine", gain: 0.14 },
        { freq: 1047, at: 0.15, dur: 0.35, type: "sine", gain: 0.14 },
      ];
  }
}

let ctx: AudioContext | null = null;

function audioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/** `true` si ya se puede sonar sin un gesto del usuario. */
export function isTvAudioUnlocked(): boolean {
  return ctx?.state === "running";
}

/** Crea/reanuda el contexto de audio. Llamar dentro de un gesto del usuario. */
export async function unlockTvAudio(): Promise<boolean> {
  try {
    const Ctor = audioContextCtor();
    if (!Ctor) return false;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

/** Suelta el contexto al salir del Modo TV. */
export function closeTvAudio(): void {
  const current = ctx;
  ctx = null;
  current?.close().catch(() => undefined);
}

/** Toca la campanita de una llegada. Silencio, sin desbloquear o sin Web Audio: no hace nada. */
export function playArrivalChime(priority: ArrivalPriority): boolean {
  if (isTvSoundMuted() || !ctx || ctx.state !== "running") return false;
  try {
    const start = ctx.currentTime + 0.02;
    for (const note of chimePattern(priority)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = start + note.at;
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(note.gain, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + note.dur + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

// --- Impresora de tickets ------------------------------------------------------

/** Timbre del motor de avance por prioridad: vencido más agudo y fuerte (urgencia). */
export function printerMotorParams(priority: ArrivalPriority): { motorHz: number; noiseHz: number; gain: number } {
  switch (priority) {
    case "overdue":
      return { motorHz: 150, noiseHz: 2600, gain: 0.16 };
    case "at_risk":
      return { motorHz: 125, noiseHz: 2200, gain: 0.12 };
    case "changes":
      return { motorHz: 115, noiseHz: 2000, gain: 0.11 };
    default:
      return { motorHz: 100, noiseHz: 1800, gain: 0.09 };
  }
}

/**
 * Envolvente del motor a pasos: en cada paso suena el 60 % del tiempo (el
 * papel avanza) y calla el resto, igual que `steppedFeed` de la animación.
 * Devuelve [inicio, fin] (s, relativos) de cada pulso.
 */
export function motorSteps(durationS: number, steps: number): [number, number][] {
  const n = Math.max(1, Math.round(steps));
  const step = durationS / n;
  return Array.from({ length: n }, (_, i) => [i * step, i * step + step * 0.6] as [number, number]);
}

let noise: AudioBuffer | null = null;
function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ac.sampleRate) return noise;
  const buf = ac.createBuffer(1, Math.round(ac.sampleRate * 0.5), ac.sampleRate);
  const data = buf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < data.length; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    data[i] = (s / 1073741824 - 1) * 0.8;
  }
  noise = buf;
  return buf;
}

function canPlay(): AudioContext | null {
  if (isTvSoundMuted() || !ctx || ctx.state !== "running") return null;
  return ctx;
}

/** Zumbido del motor mientras sale el ticket (sincronizado con los pasos del papel). */
export function playPrinterFeed(priority: ArrivalPriority, durationMs: number, steps: number): boolean {
  const ac = canPlay();
  if (!ac) return false;
  try {
    const p = printerMotorParams(priority);
    const start = ac.currentTime + 0.01;
    const dur = durationMs / 1000;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, start);
    for (const [a, b] of motorSteps(dur, steps)) {
      env.gain.setValueAtTime(0.0001, start + a);
      env.gain.linearRampToValueAtTime(p.gain, start + a + 0.008);
      env.gain.linearRampToValueAtTime(p.gain * 0.7, start + b - 0.01);
      env.gain.linearRampToValueAtTime(0.0001, start + b);
    }
    env.connect(ac.destination);
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(p.motorHz, start);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const oscGain = ac.createGain();
    oscGain.gain.value = 0.35;
    osc.connect(lp).connect(oscGain).connect(env);
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = p.noiseHz;
    bp.Q.value = 1.2;
    src.connect(bp).connect(env);
    osc.start(start);
    src.start(start);
    osc.stop(start + dur + 0.05);
    src.stop(start + dur + 0.05);
    return true;
  } catch {
    return false;
  }
}

/** "Clic" seco de la guillotina al cortar. */
export function playCutterSnip(): boolean {
  const ac = canPlay();
  if (!ac) return false;
  try {
    const t = ac.currentTime + 0.005;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3500;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(hp).connect(g).connect(ac.destination);
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.03);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.connect(og).connect(ac.destination);
    src.start(t);
    src.stop(t + 0.06);
    osc.start(t);
    osc.stop(t + 0.05);
    return true;
  } catch {
    return false;
  }
}
