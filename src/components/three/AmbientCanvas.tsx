"use client";

/**
 * Wrapper compartido para escenas ambientales de Three.js (fondo decorativo,
 * nunca interactivo). Se apoya en @react-three/fiber pero maneja todo lo que
 * no es "dibujar la escena":
 *
 * - No renderiza nada si el navegador no soporta WebGL (evita crashes).
 * - No renderiza nada si el usuario prefiere reduced-motion (misma
 *   convención que `useMotionPreset` en `@/lib/motion`, pero este componente
 *   se usa fuera de árboles con framer-motion así que resuelve la media
 *   query directamente).
 * - Pausa el render loop (`frameloop="never"` + demand) cuando el canvas
 *   sale del viewport (IntersectionObserver) o la pestaña queda oculta
 *   (visibilitychange), para no gastar batería/CPU de fondo.
 * - Cap de pixel ratio a 2 para no golpear el GPU en pantallas retina/4K.
 *
 * Los componentes hijos (las escenas concretas) sólo se preocupan por qué
 * dibujar, no por cuándo.
 */
import { Canvas, type CanvasProps, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode } from "react";

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  return reduced;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

/** Detiene el loop de render (invalidate-on-demand) cuando `active` es false. */
function RenderLoopGate({ active }: { active: boolean }) {
  useFrame((state) => {
    if (active) state.invalidate();
  });
  return null;
}

export function AmbientCanvas({
  children,
  className,
  camera,
}: {
  children: ReactNode;
  className?: string;
  camera?: CanvasProps["camera"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const reduced = useReducedMotionPreference();

  useEffect(() => {
    setWebglOk(supportsWebGL());
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Nada de WebGL, o el usuario pidió menos movimiento: no renderizamos el
  // canvas (el fondo estático/gradiente del contenedor padre queda como está).
  if (reduced || webglOk === false) return null;
  // Todavía no sabemos si hay WebGL (primer render en cliente): no mostramos
  // nada para evitar un flash, se resuelve en el próximo tick.
  if (webglOk === null) return null;

  const active = inView && tabVisible;

  return (
    <div ref={containerRef} className={className} aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1}
        camera={camera ?? { position: [0, 0, 6], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <RenderLoopGate active={active} />
        {children}
      </Canvas>
    </div>
  );
}
