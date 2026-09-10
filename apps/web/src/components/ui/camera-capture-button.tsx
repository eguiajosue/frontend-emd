"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botón "Tomar foto": abre la cámara directo en celulares/tablets (el
 * atributo `capture` en un `<input type="file">` es soportado nativamente
 * por Safari/Chrome en iOS y Android, sin ninguna librería ni permiso de
 * plataforma) — pensado para la PWA en iPhone/iPad, que no tiene acceso a
 * cámara nativa sin esto. En desktop, sin cámara disponible, el navegador
 * simplemente abre el selector de archivos normal.
 *
 * Reusa el mismo handler `onChange` que ya usa el input de "elegir archivo"
 * de al lado: ambos disparan un `<input type="file">` normal, sólo cambia
 * de dónde sale el archivo.
 */
export function CameraCaptureButton({
  onChange,
  className,
}: {
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onChange(e);
          // Sin esto, tomar la misma foto dos veces seguidas no dispara
          // `onChange` la segunda vez (el input cree que el valor no cambió).
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        className={cn("gap-1.5", className)}
      >
        <Camera className="h-4 w-4" />
        Tomar foto
      </Button>
    </>
  );
}
