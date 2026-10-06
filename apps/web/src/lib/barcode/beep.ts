/**
 * Pitidos del modo Escanear (Web Audio, sin archivos): uno agudo y corto
 * cuando el movimiento quedó registrado, uno grave y doble cuando algo falló,
 * para no tener que mirar la pantalla en cada escaneo.
 */
export type BeepKind = "ok" | "error";

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  // Un solo contexto para toda la sesión de escaneo: crear uno por pitido
  // agota el límite del navegador si se escanea rápido.
  ctx ??= new Ctor();
  if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(ac: AudioContext, frequency: number, start: number, duration: number, type: OscillatorType) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.18, start + 0.008);
  gain.gain.setValueAtTime(0.18, start + duration - 0.02);
  gain.gain.linearRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.01);
}

export function playScanBeep(kind: BeepKind): void {
  try {
    const ac = audioContext();
    if (!ac) return;
    const now = ac.currentTime;
    if (kind === "ok") {
      tone(ac, 1760, now, 0.09, "square");
    } else {
      tone(ac, 220, now, 0.14, "sawtooth");
      tone(ac, 180, now + 0.18, 0.2, "sawtooth");
    }
  } catch {
    // Sin audio (autoplay bloqueado, navegador viejo): el aviso en pantalla basta.
  }
}
