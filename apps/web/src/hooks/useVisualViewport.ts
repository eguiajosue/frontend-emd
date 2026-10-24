import { useEffect, useState } from "react";

export interface VisualViewportBox {
  height: number;
  offsetTop: number;
}

/**
 * Alto y desplazamiento del área realmente visible (`window.visualViewport`).
 *
 * En iOS el teclado no achica `100dvh`: tapa el fondo de la pantalla y además
 * desplaza la página. Una capa `fixed` que use este alto y este `offsetTop`
 * queda siempre entre la parte de arriba y el teclado (el compositor del chat
 * no se esconde detrás). `null` mientras no hay `visualViewport` (SSR o
 * navegadores viejos): quien lo use cae a `100dvh`.
 */
export function useVisualViewport(enabled = true): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!enabled || !vv) {
      setBox(null);
      return;
    }
    const update = () => setBox({ height: vv.height, offsetTop: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return box;
}
