"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Se vuelve `true` la primera vez que el elemento entra (o está por entrar,
 * `rootMargin`) en pantalla, y se queda así. Sirve para pedir imágenes sólo
 * de las tarjetas visibles (mockups del pedido, logos de la biblioteca).
 * Sin IntersectionObserver (tests, navegadores viejos) vale `true` de una.
 */
export function useInView<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);
  return [ref, inView] as const;
}
