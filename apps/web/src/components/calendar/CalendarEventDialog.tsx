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
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { useEntityList } from "@/hooks/useEntity";
import { useCalendarEventMutations } from "@/hooks/useCalendarEvents";
import { getErrorMessage } from "@/lib/api";
import type { CalendarEvent, Client } from "@/types";
import { CalendarClock, Loader2, Type, UserRound } from "lucide-react";

function clientLabel(client: Client): string {
  return [client.first_name, client.last_name].filter(Boolean).join(" ");
}

type ReminderUnit = "minutos" | "horas" | "dias" | "semanas";

const MINUTES_PER_UNIT: Record<ReminderUnit, number> = {
  minutos: 1,
  horas: 60,
  dias: 60 * 24,
  semanas: 60 * 24 * 7,
};

/** Convierte minutos guardados de vuelta a la unidad más grande sin resto, para mostrarlo tal cual se cargó. */
function splitReminderMinutes(minutes: number): { value: number; unit: ReminderUnit } {
  const units: ReminderUnit[] = ["semanas", "dias", "horas", "minutos"];
  for (const unit of units) {
    const perUnit = MINUTES_PER_UNIT[unit];
    if (minutes % perUnit === 0) {
      return { value: minutes / perUnit, unit };
    }
  }
  return { value: minutes, unit: "minutos" };
}

interface CalendarEventDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (event: CalendarEvent) => void;
  /** Presente en modo edición; ausente = alta. */
  event?: CalendarEvent | null;
  /** Precarga la fecha al crear desde un día puntual del calendario (yyyy-MM-dd). */
  defaultDate?: string;
}

/**
 * Alta/edición de un evento del calendario de equipo de Recepción
 * (instalaciones, juntas, visitas a clientes). Formulario simple de un solo
 * paso: a diferencia del wizard de pedidos, acá no hay pasos que dependan
 * unos de otros.
 */
export function CalendarEventDialog({
  open,
  onClose,
  onSaved,
  event,
  defaultDate,
}: CalendarEventDialogProps) {
  const { data: clients } = useEntityList<Client>("clients", { enabled: open });
  const { create, update } = useCalendarEventMutations();
  const isEditing = Boolean(event);

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [clientNameOverride, setClientNameOverride] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  // String (no number): clampear en cada tecla hacía que borrar el campo
  // "rebotara" a 1 de inmediato, y la siguiente tecla tipeada quedaba
  // pegada a ese 1 (ej. borrar + escribir "3" terminaba en "13"). Se
  // normaliza recién al armar el payload.
  const [reminderValue, setReminderValue] = useState("1");
  const [reminderUnit, setReminderUnit] = useState<ReminderUnit>("dias");
  const [titleError, setTitleError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  // El diálogo queda montado entre aperturas: sin este reset explícito por
  // `open`/`event`, reabrirlo para OTRO evento (o para crear uno nuevo
  // después de editar) mostraría los datos del anterior.
  useEffect(() => {
    if (!open) return;
    if (event) {
      const eventDate = new Date(event.eventDate);
      setTitle(event.title);
      setClientId(event.clientId ?? undefined);
      setClientNameOverride(event.clientId ? "" : event.clientName ?? "");
      setDate(eventDate.toISOString().slice(0, 10));
      setTime(event.hasTime ? eventDate.toISOString().slice(11, 16) : "");
      setAllDay(!event.hasTime);
      if (event.reminderMinutesBefore) {
        const { value, unit } = splitReminderMinutes(event.reminderMinutesBefore);
        setReminderEnabled(true);
        setReminderValue(String(value));
        setReminderUnit(unit);
      } else {
        setReminderEnabled(false);
        setReminderValue("1");
        setReminderUnit("dias");
      }
    } else {
      setTitle("");
      setClientId(undefined);
      setClientNameOverride("");
      setDate(defaultDate ?? "");
      setTime("");
      setAllDay(false);
      setReminderEnabled(false);
      setReminderValue("1");
      setReminderUnit("dias");
    }
    setTitleError(undefined);
  }, [open, event, defaultDate]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setTitleError("El título es obligatorio");
      return;
    }
    if (!date) {
      toast.error("Elegí una fecha para el evento");
      return;
    }
    setTitleError(undefined);

    const eventDate = new Date(`${date}T${allDay ? "00:00" : time || "00:00"}:00`);
    const reminderAmount = Math.max(1, parseInt(reminderValue, 10) || 1);
    const reminderMinutesBefore = reminderEnabled
      ? reminderAmount * MINUTES_PER_UNIT[reminderUnit]
      : undefined;

    const payload = {
      title: title.trim(),
      clientId,
      clientName: clientId ? undefined : clientNameOverride || undefined,
      eventDate: eventDate.toISOString(),
      hasTime: !allDay,
      reminderMinutesBefore,
    };

    setSubmitting(true);
    try {
      const saved = isEditing
        ? await update(event!.id, payload)
        : await create(payload);
      toast.success(isEditing ? "Evento actualizado" : "Evento creado");
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el evento."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar evento" : "Nuevo evento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <FormField label="Qué hay que hacer" htmlFor="ce-title" icon={Type} required error={titleError}>
            <Input
              id="ce-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(undefined);
              }}
              placeholder='Ej. "Instalar anuncio", "Visita a planta"'
              autoFocus
              aria-required
              aria-invalid={Boolean(titleError)}
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>

          <FormField label="Cliente (opcional)" htmlFor="ce-client" icon={UserRound}>
            <CreatableCombobox
              id="ce-client"
              items={clients.map((c) => ({ id: c.id, label: clientLabel(c) }))}
              selectedId={clientId ?? null}
              customValue={clientNameOverride}
              placeholder="Buscar cliente o escribir nombre libre..."
              createLabel={(value) => `Usar "${value}" como nombre de cliente`}
              emptyLabel="No hay clientes registrados. Escribí un nombre para usarlo directamente."
              onSelectItem={(item) => {
                setClientId(Number(item.id));
                setClientNameOverride("");
              }}
              onUseCustom={(text) => {
                setClientId(undefined);
                setClientNameOverride(text);
              }}
            />
          </FormField>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="ce-all-day" className="text-sm font-medium">
                Todo el día
              </Label>
              <p className="text-xs text-muted-foreground">Sin horario puntual.</p>
            </div>
            <Switch id="ce-all-day" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Fecha" htmlFor="ce-date" icon={CalendarClock} required>
              <Input
                id="ce-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-required
                className="h-11 focus-visible:ring-0 focus-visible:border-primary transition-colors sm:h-9"
              />
            </FormField>
            {!allDay && (
              <FormField label="Hora" htmlFor="ce-time" icon={CalendarClock}>
                <Input
                  id="ce-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-11 focus-visible:ring-0 focus-visible:border-primary transition-colors sm:h-9"
                />
              </FormField>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ce-reminder" className="text-sm font-medium">
                  Recordatorio adicional
                </Label>
                <p className="text-xs text-muted-foreground">
                  Siempre avisamos 1 hora antes; acá podés pedir uno con más anticipación.
                </p>
              </div>
              <Switch id="ce-reminder" checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
            </div>
            {reminderEnabled && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-sm text-muted-foreground">Avisar</span>
                <Input
                  type="number"
                  min={1}
                  value={reminderValue}
                  onChange={(e) => setReminderValue(e.target.value)}
                  className="h-9 w-20"
                  aria-label="Cantidad de anticipación del recordatorio"
                />
                <Select value={reminderUnit} onValueChange={(v) => setReminderUnit(v as ReminderUnit)}>
                  <SelectTrigger className="h-9 flex-1" aria-label="Unidad de anticipación del recordatorio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutos">Minutos antes</SelectItem>
                    <SelectItem value="horas">Horas antes</SelectItem>
                    <SelectItem value="dias">Días antes</SelectItem>
                    <SelectItem value="semanas">Semanas antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
