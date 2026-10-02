"use client";

import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { Pencil, Trash2 } from "lucide-react";

interface RowActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
}

export function RowActions({ onEdit, onDelete, canEdit = true }: RowActionsProps) {
  if (!canEdit) return null;
  return (
    <div className="flex gap-1">
      {onEdit && (
        <SimpleTooltip label="Editar">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Editar">
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
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </SimpleTooltip>
      )}
    </div>
  );
}
