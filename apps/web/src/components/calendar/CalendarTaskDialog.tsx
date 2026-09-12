"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCalendarTaskMutations } from "@/hooks/useCalendarTasks";
import { useOrders } from "@/hooks/useOrders";
import { getErrorMessage } from "@/lib/api";
import type { CalendarTask } from "@/types";
import { Loader2, Type, AlignLeft, Package } from "lucide-react";

interface CalendarTaskDialogProps {
  open: boolean;
  onClose: () => void;
  /** Presente en modo edición; ausente = alta. */
  task?: CalendarTask | null;
}

/**
 * Alta/edición de una tarea pendiente del calendario de equipo: sin fecha,
 * sólo título y descripción opcional — a propósito mucho más simple que
 * `CalendarEventDialog`, porque una tarea todavía no tiene nada agendado.
 */
export function CalendarTaskDialog({ open, onClose, task }: CalendarTaskDialogProps) {
  const { create, update } = useCalendarTaskMutations();
  const { data: orders } = useOrders({ enabled: open });
  const isEditing = Boolean(task);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [orderId, setOrderId] = useState<number | undefined>(undefined);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // Sólo pedidos activos (no archivados): no tiene sentido vincular una
  // tarea nueva a un pedido que ya salió del circuito.
  const activeOrders = orders
    .filter((o) => !o.archivedAt)
    .sort((a, b) => b.creationDate.localeCompare(a.creationDate));

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setOrderId(task?.orderId ?? undefined);
    setTitleError(undefined);
  }, [open, task]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setTitleError("El título es obligatorio");
      return;
    }
    setTitleError(undefined);

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      orderId,
    };

    setSubmitting(true);
    try {
      if (isEditing) {
        await update(task!.id, payload);
        toast.success("Tarea actualizada");
      } else {
        await create(payload);
        toast.success("Tarea creada");
      }
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar la tarea."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <FormField label="Qué hay que hacer" htmlFor="ct-title" icon={Type} required error={titleError}>
            <Input
              id="ct-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(undefined);
              }}
              placeholder='Ej. "Confirmar medidas con cliente"'
              autoFocus
              aria-required
              aria-invalid={Boolean(titleError)}
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>

          <FormField label="Detalle (opcional)" htmlFor="ct-description" icon={AlignLeft}>
            <Textarea
              id="ct-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas adicionales..."
              rows={3}
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>

          <FormField label="Pedido (opcional)" htmlFor="ct-order" icon={Package}>
            <Select
              value={orderId ? String(orderId) : "ninguno"}
              onValueChange={(v) => setOrderId(v === "ninguno" ? undefined : Number(v))}
            >
              <SelectTrigger id="ct-order" className="h-11 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin pedido</SelectItem>
                {activeOrders.map((order) => (
                  <SelectItem key={order.id} value={String(order.id)}>
                    <span className="truncate">
                      #{order.id} · {order.description}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
