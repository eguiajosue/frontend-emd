"use client";

import { useEffect, useState } from "react";

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

/**
 * Mantiene la pantalla encendida mientras `active` (Screen Wake Lock API).
 * El navegador suelta el bloqueo al ocultar la pestaña, así que se vuelve a
 * pedir al volver. Sin soporte (Firefox viejo, http sin TLS) o sin permiso,
 * no pasa nada: la tele depende de su propio ajuste de reposo.
 *
 * Devuelve `true` mientras el bloqueo está tomado.
 */
export function useWakeLock(active: boolean): boolean {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!active) return;
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const next = await wakeLock.request("screen");
        if (cancelled) {
          void next.release().catch(() => {});
          return;
        }
        sentinel = next;
        setLocked(true);
        next.addEventListener("release", () => setLocked(false));
      } catch {
        // Sin permiso o batería baja: se reintenta al volver a la pestaña.
        setLocked(false);
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
      setLocked(false);
    };
  }, [active]);

  return locked;
}
