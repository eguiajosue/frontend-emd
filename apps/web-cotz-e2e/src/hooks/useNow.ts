"use client";

import { useEffect, useState } from "react";

/**
 * Hora actual que se refresca cada `intervalMs`, alineada al borde del
 * intervalo (con 60s, cambia justo al cambiar el minuto del reloj).
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), intervalMs);
    }, intervalMs - (Date.now() % intervalMs));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
}
