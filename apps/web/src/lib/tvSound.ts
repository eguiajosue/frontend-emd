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
