"use client";

import { useState } from "react";
import { CalendarClock, ListTodo, Plus } from "lucide-react";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/feedback/states";
import { usePermissions } from "@/hooks/usePermissions";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useOrders } from "@/hooks/useOrders";
import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import { TimeGridCalendar } from "@/components/calendar/TimeGridCalendar";
import { UpcomingEventsSheet } from "@/components/calendar/UpcomingEventsSheet";
import { CalendarEventDialog } from "@/components/calendar/CalendarEventDialog";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import type { CalendarEvent } from "@/types";

type CalendarView = "mes" | "semana" | "dia";

/**
 * Calendario de equipo de Recepción: instalaciones, juntas, visitas a
 * clientes — reemplaza la lista que hoy se coordina a mano por WhatsApp.
 * Compartido entre recepcion/admin/superuser: cualquiera ve y edita
 * cualquier evento. Mezcla, además, los pedidos con fecha de entrega (sólo
 * lectura acá — se editan desde "Pedidos").
 */
export default function CalendarioPage() {
  const { canManageOperations, isSessionLoading } = usePermissions();
  const { data: events, isPending, isError, refetch } = useCalendarEvents({
    enabled: canManageOperations,
  });
  const { data: orders, isPending: isOrdersPending } = useOrders({
    enabled: canManageOperations,
  });
  const [view, setView] = useState<CalendarView>("mes");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultTime, setDefaultTime] = useState<string | undefined>();
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const ordersWithDelivery = orders.filter((o) => Boolean(o.deliveryDate));

  const openCreate = (dateKey?: string) => {
    setEditingEvent(null);
    setDefaultDate(dateKey);
    setDefaultTime(undefined);
    setDialogOpen(true);
  };

  const openCreateAt = (isoDateTime: string) => {
    setEditingEvent(null);
    setDefaultDate(isoDateTime.slice(0, 10));
    setDefaultTime(isoDateTime.length > 10 ? isoDateTime.slice(11, 16) : undefined);
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setDefaultDate(undefined);
    setDefaultTime(undefined);
    setDialogOpen(true);
  };

  if (!isSessionLoading && !canManageOperations) {
    return (
      <div className="mt-10 rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        No tenés permiso para ver esta página.
      </div>
    );
  }

  const loading = isPending || isOrdersPending || isSessionLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Title title="Calendario" />
          <p className="text-muted-foreground">
            Instalaciones, juntas, visitas a clientes y pedidos con entrega: compartido por todo el
            equipo.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setUpcomingOpen(true)}
            className="gap-1.5"
          >
            <ListTodo className="h-4 w-4" />
            Próximos
          </Button>
          <Button onClick={() => openCreate()} className="flex-1 gap-1.5 sm:flex-none">
            <Plus className="h-4 w-4" />
            Nuevo evento
          </Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
        <TabsList>
          <TabsTrigger value="dia">Día</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mes</TabsTrigger>
        </TabsList>
      </Tabs>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : loading ? (
        <Skeleton className="h-[32rem] w-full" />
      ) : view === "mes" ? (
        <TeamCalendar
          events={events}
          orders={ordersWithDelivery}
          onAddForDay={openCreate}
          onEdit={openEdit}
          onSelectOrder={setOpenOrderId}
        />
      ) : (
        <div className="rounded-xl border bg-card p-2 shadow-soft sm:p-4">
          <TimeGridCalendar
            view={view === "semana" ? "timeGridWeek" : "timeGridDay"}
            events={events}
            orders={ordersWithDelivery}
            onAddAt={openCreateAt}
            onEdit={openEdit}
            onSelectOrder={setOpenOrderId}
          />
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
        Los pedidos se marcan con <span className="font-medium">un ícono de paquete</span> — se
        editan desde &quot;Pedidos&quot;, acá sólo se consultan.
      </p>

      <CalendarEventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        event={editingEvent}
        defaultDate={defaultDate}
        defaultTime={defaultTime}
      />

      <UpcomingEventsSheet
        open={upcomingOpen}
        onOpenChange={setUpcomingOpen}
        events={events}
        orders={ordersWithDelivery}
        onEdit={openEdit}
        onSelectOrder={setOpenOrderId}
      />

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}
