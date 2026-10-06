import { isSoundEnabled } from "@/hooks/useSoundPreference";

/**
 * Sonidos de notificación sintetizados con Web Audio API (sin archivos externos
 * que alojar).
 *
 * Los navegadores bloquean audio antes de interacción del usuario; como estas
 * notificaciones sólo suenan cuando el usuario ya está logueado e interactuando
 * con la app, debería funcionar sin problema. Si el navegador lo bloquea de
 * todas formas (o no soporta AudioContext), falla en silencio: no debe romper
 * nada, sólo no sonar esa vez.
 *
 * Ambos sonidos respetan el toggle de "Sonido de notificaciones" en
 * Configuración (ver useSoundPreference) — nunca se fuerzan.
 */
function getAudioContextCtor() {
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/** Dos tonos ascendentes tipo "ding", para eventos que requieren atención (nueva orden). */
export function playNotificationSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();

    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(660, now, 0.15); // primer tono
    playTone(880, now + 0.14, 0.22); // segundo tono, más agudo ("ding")

    // Cerrar el contexto después de sonar para no dejar handles abiertos.
    window.setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 500);
  } catch {
    // Autoplay bloqueado / AudioContext no soportado: no rompe nada.
  }
}

/**
 * Tono único, corto y grave, para confirmar que una acción del propio usuario
 * se guardó con éxito (ej. un cambio de configuración). Deliberadamente más
 * discreto que el "ding" de notificación: no compite por atención, sólo
 * confirma causalidad inmediata con lo que el usuario acaba de hacer.
 */
export function playSuccessSound(): void {
  if (!isSoundEnabled()) return;
  try {
    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(520, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);

    window.setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 300);
  } catch {
    // Autoplay bloqueado / AudioContext no soportado: no rompe nada.
  }
}
