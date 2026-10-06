"use client";

import { useEffect, useRef } from "react";
import { createBurstDetector, type BurstOptions } from "@/lib/barcode/scannerBurst";
import { isTypingTarget } from "@/lib/shortcuts";

/** Marca el campo propio del modo Escanear: lo que se teclee ahí lo maneja ese campo. */
export const SCAN_INPUT_ATTR = "data-scan-input";

/**
 * Quita del campo donde estaba el foco el código que el lector "tecleó" ahí
 * (p. ej. el buscador): el escaneo se registra, pero el texto no se queda.
 * Usa el setter nativo + `input` para que React se entere del cambio.
 */
function stripScannedText(target: EventTarget | null, code: string) {
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
  const value = target.value;
  if (!value.endsWith(code)) return;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), "value")?.set;
  setter?.call(target, value.slice(0, -code.length));
  target.dispatchEvent(new Event("input", { bubbles: true }));
}

interface UseBarcodeScannerOptions {
  enabled: boolean;
  onScan: (code: string) => void;
  burst?: Partial<BurstOptions>;
}

/**
 * Escucha un lector USB/Bluetooth "modo teclado" en toda la página mientras
 * `enabled`: una ráfaga de teclas rápidas que termina en Enter es un escaneo
 * (ver `scannerBurst.ts`), aunque el foco esté en un botón o en otro campo.
 * Lo que una persona escribe a velocidad normal en otros campos no se toca.
 *
 * Se pausa con un diálogo abierto (el del código desconocido, el alta de
 * artículo) y no interviene en el campo propio del modo (`SCAN_INPUT_ATTR`),
 * que maneja su Enter por su cuenta.
 */
export function useBarcodeScanner({ enabled, onScan, burst }: UseBarcodeScannerOptions) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const burstRef = useRef(burst);

  useEffect(() => {
    if (!enabled) return;
    const detector = createBurstDetector(burstRef.current);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(`[${SCAN_INPUT_ATTR}]`)) {
        detector.reset();
        return;
      }
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        detector.reset();
        return;
      }

      const typing = isTypingTarget(target);
      const result = detector.push(e.key, e.timeStamp || performance.now());

      // Fuera de un campo, una letra no debe "presionar" el botón con foco
      // (la barra espaciadora) ni hacer scroll: en modo Escanear es del lector.
      if (!typing && e.key.length === 1) e.preventDefault();

      if (result.kind === "scan") {
        e.preventDefault();
        e.stopPropagation();
        if (typing) stripScannedText(target, result.code);
        onScanRef.current(result.code);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
