"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { usePermissions } from "@/hooks/usePermissions";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import { CalendarEventDialog } from "@/components/calendar/CalendarEventDialog";
import type { CalendarEvent } from "@/types";

/**
 * Calendario de equipo de Recepción: instalaciones, juntas, visitas a
 * clientes — reemplaza la lista que hoy se coordina a mano por WhatsApp.
 * Compartido entre recepcion/admin/superuser: cualquiera ve y edita
 * cualquier evento.
 */
export default function CalendarioPage() {
  const { canManageOperations, isSessionLoading } = usePermissions();
  const { data: events, isPending, isError, refetch } = useCalendarEvents({
    enabled: canManageOperations,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  const openCreate = (dateKey?: string) => {
    setEditingEvent(null);
    setDefaultDate(dateKey);
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setDefaultDate(undefined);
    setDialogOpen(true);
  };

  if (!isSessionLoading && !canManageOperations) {
    return (
      <div className="mt-10 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        No tenés permiso para ver esta página.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Title title="Calendario" />
          <p className="text-muted-foreground">
            Instalaciones, juntas y visitas a clientes: compartido por todo el equipo.
          </p>
        </div>
        <Button onClick={() => openCreate()} className="w-full gap-1.5 sm:w-auto">
          <Plus className="h-4 w-4" />
          Nuevo evento
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending || isSessionLoading ? (
        <Skeleton className="h-[32rem] w-full" />
      ) : (
        <TeamCalendar events={events} onAddForDay={openCreate} onEdit={openEdit} />
      )}

      <CalendarEventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        event={editingEvent}
        defaultDate={defaultDate}
      />
    </div>
  );
}
