"use client";

import { MonitorX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/**
 * Aviso cuando el navegador no puede dibujar 3D (sin WebGL 2, aceleración por
 * hardware apagada o GPU bloqueada). El resto de la pantalla sigue funcionando.
 */
export function WebGLFallback({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={MonitorX}
      title="Tu navegador no puede mostrar 3D"
      description="Activa la aceleración por hardware en la configuración del navegador o abre esta pantalla en una versión reciente de Chrome, Edge, Firefox o Safari. El resto de la app sigue funcionando normalmente."
      className={cn("mt-0 h-full min-h-[320px] justify-center", className)}
    />
  );
}

export default WebGLFallback;
