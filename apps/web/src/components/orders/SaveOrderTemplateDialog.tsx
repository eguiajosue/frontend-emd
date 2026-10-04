"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/api";
import { MAX_TEMPLATE_NAME_LENGTH } from "@/lib/createOrderForm";

interface SaveOrderTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientLabel: string;
  defaultName: string;
  /** "1 producto, descripción, ruta y 1 material": lo que se va a guardar. */
  contentSummary: string;
  /** Mensaje que bloquea el guardado (ej. sin diseño y sin áreas). */
  blocker?: string;
  onSave: (name: string) => Promise<void>;
}

/**
 * Nombre de la plantilla nueva del cliente. Guarda el pedido tal como está
 * en pantalla; la fecha, el archivo del cliente y el asignado no se guardan.
 */
export function SaveOrderTemplateDialog({
  open,
  onOpenChange,
  clientLabel,
  defaultName,
  contentSummary,
  blocker,
  onSave,
}: SaveOrderTemplateDialogProps) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pon un nombre a la plantilla");
      return;
    }
    if (blocker || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onOpenChange(false);
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo guardar la plantilla."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Guardar como plantilla</DialogTitle>
            <DialogDescription>
              Para la próxima vez que {clientLabel || "este cliente"} pida lo mismo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="order-template-name" className="text-sm font-medium">
              Nombre
            </label>
            <Input
              id="order-template-name"
              autoFocus
              value={name}
              maxLength={MAX_TEMPLATE_NAME_LENGTH}
              placeholder="Ej. Figuras de coroplast"
              aria-invalid={Boolean(error)}
              aria-describedby="order-template-name-hint"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="h-11 sm:h-9"
            />
            <p id="order-template-name-hint" className="text-meta">
              Guarda {contentSummary}. La fecha, el archivo del cliente y el asignado se eligen en cada pedido.
            </p>
            {(error || blocker) && (
              <p role="alert" className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
                <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                {error ?? blocker}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || Boolean(blocker)} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Guardar plantilla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
