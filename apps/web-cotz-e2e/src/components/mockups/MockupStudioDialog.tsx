"use client";

import { useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MockupStudio } from "@/components/mockups/MockupStudio";
import type { MockupStudioResult } from "@/lib/mockups/studio";

/**
 * El estudio de mockups dentro de un diálogo (pantalla completa en celular,
 * grande en escritorio). Lo usan "Nuevo pedido" (agrega el mockup a la lista
 * pendiente) y el detalle del pedido (lo guarda directo en el pedido).
 *
 * `onAttach` decide qué pasa con el resultado; si resuelve sin error, el
 * diálogo se cierra. Si lanza, queda abierto para reintentar.
 */
export function MockupStudioDialog({
  open,
  onOpenChange,
  title = "Crear mockup",
  attachLabel = "Agregar al pedido",
  onAttach,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  attachLabel?: string;
  onAttach: (result: MockupStudioResult) => void | Promise<void>;
}) {
  const selectedRef = useRef<string | null>(null);
  const onSelectionChange = useCallback((id: string | null) => {
    selectedRef.current = id;
  }, []);

  const handleAttach = async (result: MockupStudioResult) => {
    try {
      await onAttach(result);
    } catch {
      // Quien llama ya mostró el error; el estudio queda abierto.
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!bg-background sm:max-w-6xl xl:max-w-7xl"
        // Con un diseño elegido, Esc sólo lo deselecciona (lo maneja el estudio).
        onEscapeKeyDown={(event) => {
          if (selectedRef.current) event.preventDefault();
        }}
        // Soltar un archivo fuera del estudio no debe cerrar el diálogo.
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {open && (
          <MockupStudio
            variant="dialog"
            attachLabel={attachLabel}
            onAttach={handleAttach}
            onSelectionChange={onSelectionChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
