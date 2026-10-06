"use client";

import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RowActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
}

/** Botón icono circular de fila: discreto en reposo, gris suave al pasar. */
const ROW_ACTION =
  "h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";

export function RowActions({ onEdit, onDelete, canEdit = true }: RowActionsProps) {
  if (!canEdit) return null;
  return (
    <div className="flex items-center gap-1">
      {onEdit && (
        <SimpleTooltip label="Editar">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Editar" className={ROW_ACTION}>
            <Pencil className="h-4 w-4" />
          </Button>
        </SimpleTooltip>
      )}
      {onDelete && (
        <SimpleTooltip label="Eliminar">
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            aria-label="Eliminar"
            className={cn(ROW_ACTION, "hover:bg-destructive/10 hover:text-destructive")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </SimpleTooltip>
      )}
    </div>
  );
}
