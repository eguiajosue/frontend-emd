"use client";

import { useEffect, useState } from "react";
import { barsToPath, encodeCode128, type Code128Bars } from "@/lib/barcode/code128";
import { cn } from "@/lib/utils";

/**
 * Barras Code 128 de `code` en pantalla (no para imprimir: eso es
 * `renderLabelHtml`). Carga el codificador la primera vez que se usa.
 */
export function BarcodeSvg({ code, className }: { code: string; className?: string }) {
  const [bars, setBars] = useState<Code128Bars | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    encodeCode128(code).then(
      (b) => alive && setBars(b),
      () => alive && (setBars(null), setFailed(true))
    );
    return () => {
      alive = false;
    };
  }, [code]);

  if (failed) return <p className="text-meta">Este código no se puede dibujar.</p>;
  if (!bars) return <div className={cn("animate-pulse rounded bg-muted", className)} aria-hidden />;
  return (
    <svg
      viewBox={`0 0 ${bars.modules} 100`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Código de barras ${code}`}
      className={cn("bg-white", className)}
    >
      <path fill="#000" d={barsToPath(bars.bits)} />
    </svg>
  );
}
