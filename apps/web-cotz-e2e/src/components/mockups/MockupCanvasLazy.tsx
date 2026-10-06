"use client";

/**
 * Carga diferida del lienzo 3D (three.js sólo baja en la pantalla del estudio).
 *
 * API para el estudio:
 *
 *   const canvasRef = useRef<MockupCanvasHandle>(null);
 *   <MockupCanvasLazy ref={canvasRef} {...mockupCanvasProps} />
 *   await canvasRef.current?.exportSheet();   // lámina PNG Frente/Espalda/Lado
 *   canvasRef.current?.setView("back");       // gira aunque `view` no cambie
 *
 * Mismas props que `MockupCanvasProps`. El `ref` se pasa a mano como prop
 * `canvasRef` al componente dinámico (next/dynamic no reenvía refs de forma
 * fiable), así que aquí sí funciona el `ref` normal. Mientras three.js carga
 * se ve un esqueleto; sin WebGL se muestra `WebGLFallback` (R3) y el ref
 * queda en null.
 */

import dynamic from "next/dynamic";
import { forwardRef, useEffect, useState, type Ref } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { MockupCanvasHandle, MockupCanvasProps } from "@/lib/mockups/types";
import { cn } from "@/lib/utils";
import { isWebGLAvailable } from "./webgl";
import { WebGLFallback } from "./WebGLFallback";

type LoadedProps = MockupCanvasProps & { canvasRef?: Ref<MockupCanvasHandle> };

function CanvasSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      aria-label="Cargando vista 3D"
      className={cn("h-full min-h-[320px] w-full rounded-2xl", className)}
    />
  );
}

const DynamicMockupCanvas = dynamic<LoadedProps>(
  () =>
    import("./MockupCanvas").then((mod) => {
      const MockupCanvas = mod.default;
      function LoadedMockupCanvas({ canvasRef, ...props }: LoadedProps) {
        return <MockupCanvas ref={canvasRef} {...props} />;
      }
      return LoadedMockupCanvas;
    }),
  { ssr: false, loading: () => <CanvasSkeleton /> },
);

const MockupCanvasLazy = forwardRef<MockupCanvasHandle, MockupCanvasProps>(function MockupCanvasLazy(props, ref) {
  // null = todavía no se sabe (primer render / SSR).
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    setWebgl(isWebGLAvailable());
  }, []);

  if (webgl === null) return <CanvasSkeleton className={props.className} />;
  if (!webgl) return <WebGLFallback className={props.className} />;
  return <DynamicMockupCanvas canvasRef={ref} {...props} />;
});

export default MockupCanvasLazy;
export { MockupCanvasLazy };
