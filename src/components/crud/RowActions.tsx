"use client";

import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

interface RowActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
}

export function RowActions({ onEdit, onDelete, canEdit = true }: RowActionsProps) {
  if (!canEdit) return null;
  return (
    <div className="flex gap-2">
      {onEdit && (
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Eliminar">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
