"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Preferencia de sonido de notificaciones, guardada en localStorage (no en el
 * backend: es puramente un ajuste de este navegador/dispositivo, igual que
 * bajar el volumen de una app). Por defecto está activado.
 *
 * Se expone también `isSoundEnabled()` (fuera de React) para que `sound.ts`
 * pueda consultarla antes de sintetizar cualquier tono, sin depender del ciclo
 * de vida de un componente.
 */
const SOUND_PREFERENCE_KEY = "emd-sound-enabled";
const SOUND_PREFERENCE_EVENT = "emd-sound-preference-change";

export function isSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_PREFERENCE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    // Sin acceso a localStorage: se asume activado (comportamiento previo).
    return true;
  }
}

function setSoundEnabledStorage(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent(SOUND_PREFERENCE_EVENT, { detail: enabled }));
  } catch {
    // No se pudo persistir: no rompe nada, sólo no se recuerda la próxima vez.
  }
}

export function useSoundPreference() {
  const [enabled, setEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEnabled(isSoundEnabled());

    const onChange = (e: Event) => {
      setEnabled(Boolean((e as CustomEvent<boolean>).detail));
    };
    window.addEventListener(SOUND_PREFERENCE_EVENT, onChange);
    return () => window.removeEventListener(SOUND_PREFERENCE_EVENT, onChange);
  }, []);

  const setSoundEnabled = useCallback((next: boolean) => {
    setEnabled(next);
    setSoundEnabledStorage(next);
  }, []);

  return { soundEnabled: enabled, setSoundEnabled, mounted };
}
