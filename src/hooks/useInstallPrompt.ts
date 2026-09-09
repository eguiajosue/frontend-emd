"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Evento no estándar (todavía no en el DOM lib de TS) que dispara Chrome/Edge
 * cuando la PWA es instalable. Interceptarlo con `preventDefault` evita el
 * mini-infobar nativo del navegador y guarda el evento para dispararlo
 * nosotros, desde un botón propio, cuando el usuario lo pida.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Expone si la PWA se puede instalar ahora mismo (`canInstall`) y una
 * función para disparar el diálogo nativo de instalación
 * (`promptInstall`). No existe forma de "revisar" si es instalable sin
 * escuchar `beforeinstallprompt`: el navegador decide cuándo lo dispara según
 * sus propios criterios (manifest válido, service worker registrado, etc.).
 *
 * Una vez que el usuario instala la app (o descarta/acepta el prompt), el
 * evento guardado ya no sirve — `canInstall` vuelve a `false`.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // Sin esto el navegador muestra su propio banner/infobar de
      // instalación de inmediato; lo queremos controlar nosotros.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(() => {
    if (!deferredPrompt) return;
    void deferredPrompt.prompt().then(() => {
      // El evento sólo se puede usar una vez; se descarta haya sido
      // aceptado o no.
      setDeferredPrompt(null);
    });
  }, [deferredPrompt]);

  return {
    canInstall: !installed && deferredPrompt !== null,
    promptInstall,
  };
}
