"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { MockupCanvasHandle, MockupCanvasProps } from "@/lib/mockups/types";
import { cn } from "@/lib/utils";
import { MockupScene, type SceneStatus } from "./mockupScene";
import { WebGLFallback } from "./WebGLFallback";

/**
 * Lienzo 3D del creador de mockups. Se carga sólo en el cliente vía
 * `MockupCanvasLazy` (next/dynamic, ssr:false).
 *
 * Interacción:
 * - Arrastrar el fondo o la prenda gira la cámara (sin paneo, zoom acotado);
 *   al girar a mano avisa `onViewChange(null)`.
 * - Clic sobre un diseño lo selecciona y arrastrarlo lo mueve sobre la tela
 *   (`onPlacementChange`, como mucho una vez por frame).
 * - Clic en el fondo (sin arrastrar) deselecciona.
 *
 * El ref expone `exportSheet()`, `exportThumbnail()` y `setView(view)`
 * (`MockupCanvasHandle`).
 */
const MockupCanvas = forwardRef<MockupCanvasHandle, MockupCanvasProps>(function MockupCanvas(props, ref) {
  const { config, selectedLayerId, view, className } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MockupScene | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [status, setStatus] = useState<SceneStatus>("loading");
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let scene: MockupScene;
    try {
      scene = new MockupScene(container, () => ({
        onSelectLayer: (id) => propsRef.current.onSelectLayer(id),
        onPlacementChange: (id, placement) => propsRef.current.onPlacementChange(id, placement),
        onViewChange: (v) => propsRef.current.onViewChange?.(v),
        onStatus: setStatus,
      }));
    } catch (err) {
      // El navegador dijo tener WebGL pero no pudo crear el contexto.
      console.error("[mockups] no se pudo iniciar WebGL", err);
      setUnsupported(true);
      return;
    }
    sceneRef.current = scene;
    const initial = propsRef.current;
    scene.setView(initial.view, true);
    scene.setSelected(initial.selectedLayerId);
    scene.setConfig(initial.config);
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setConfig(config);
  }, [config]);

  useEffect(() => {
    sceneRef.current?.setSelected(selectedLayerId);
  }, [selectedLayerId]);

  useEffect(() => {
    sceneRef.current?.setView(view);
  }, [view]);

  useImperativeHandle(
    ref,
    () => ({
      exportSheet: (sizes, only) => {
        const scene = sceneRef.current;
        if (!scene) return Promise.reject(new Error("El lienzo 3D no está disponible"));
        return scene.exportSheet(sizes, only);
      },
      exportThumbnail: () => {
        const scene = sceneRef.current;
        if (!scene) return Promise.reject(new Error("El lienzo 3D no está disponible"));
        return scene.exportThumbnail();
      },
      setView: (v) => sceneRef.current?.setView(v),
    }),
    [],
  );

  if (unsupported) return <WebGLFallback className={className} />;

  return (
    <div
      role="img"
      aria-label="Vista 3D de la prenda con los diseños"
      className={cn(
        "relative h-full min-h-[320px] w-full touch-none select-none overflow-hidden rounded-2xl",
        // Fondo de estudio claro (igual que la lámina exportada).
        "bg-[radial-gradient(ellipse_at_50%_38%,#ffffff_0%,#f4f4f5_58%,#e4e4e7_100%)]",
        className,
      )}
    >
      {/* Host exclusivo del <canvas>: React no pone otros hijos aquí. */}
      <div ref={containerRef} className="absolute inset-0" />
      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {status === "loading" ? (
            <span className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm text-zinc-600 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cargando prenda…
            </span>
          ) : (
            <span className="max-w-xs rounded-xl bg-white/90 px-4 py-3 text-center text-sm text-zinc-700 shadow-sm">
              No se pudo cargar el modelo 3D. Recarga la página para intentarlo de nuevo.
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default MockupCanvas;
