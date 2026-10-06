"use client";

/**
 * Fondo decorativo de partículas ambientales, implementado en Three.js
 * "vanilla" (sin @react-three/fiber). El intento anterior con
 * @react-three/fiber crasheaba en producción porque su chunk
 * dynamic-import(ssr:false) traía un segundo reconciliador de React que
 * chocaba con el bundling de react-dom de Next.js 15
 * ("Cannot read properties of undefined (reading 'ReactCurrentBatchConfig')").
 *
 * Este componente evita esa clase de bug por completo: no hay ningún
 * reconciliador de React involucrado, sólo un <canvas> que Three.js dibuja
 * directamente vía un loop manual de requestAnimationFrame dentro de un
 * useEffect. `three` se importa dinámicamente (`await import("three")`)
 * dentro del propio efecto de montaje, así que nunca forma parte del bundle
 * inicial de la ruta.
 *
 * Mismas protecciones que la versión anterior (AmbientCanvas):
 * - No se inicializa si el usuario prefiere reduced-motion.
 * - No se inicializa si el navegador no soporta WebGL.
 * - Pausa el loop de render cuando el canvas sale del viewport
 *   (IntersectionObserver) o la pestaña queda oculta (visibilitychange).
 * - Cap de pixel ratio a 2.
 * - Limpieza completa (dispose de renderer/geometría/material) al
 *   desmontar, para no filtrar memoria de GPU entre navegaciones client-side.
 */
import { useEffect, useRef } from "react";

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

export function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = (() => {
      try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        return false;
      }
    })();

    if (reduced || !supportsWebGL()) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let disposed = false;
    let cleanupFns: Array<() => void> = [];

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 6);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const PARTICLE_COUNT = 320;
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 10;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      // Color de marca (brand-400 aprox.: hsl(330, 84%, 64%)).
      const color = new THREE.Color();
      color.setHSL(330 / 360, 0.84, 0.64);

      const material = new THREE.PointsMaterial({
        color,
        size: 0.045,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      const resize = () => {
        const { clientWidth, clientHeight } = container;
        if (clientWidth === 0 || clientHeight === 0) return;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight, false);
      };
      resize();

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      let inView = true;
      let tabVisible = document.visibilityState === "visible";
      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          inView = entry.isIntersecting;
        },
        { threshold: 0.05 },
      );
      intersectionObserver.observe(container);

      const onVisibility = () => {
        tabVisible = document.visibilityState === "visible";
      };
      document.addEventListener("visibilitychange", onVisibility);

      let rafId = 0;
      const animate = () => {
        rafId = requestAnimationFrame(animate);
        if (!inView || !tabVisible) return;
        points.rotation.y += 0.0006;
        points.rotation.x += 0.0002;
        renderer.render(scene, camera);
      };
      rafId = requestAnimationFrame(animate);

      cleanupFns.push(() => {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      });
    })();

    return () => {
      disposed = true;
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];
    };
  }, []);

  return (
    <div ref={containerRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
