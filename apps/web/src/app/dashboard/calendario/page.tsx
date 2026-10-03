"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ListChecks, ListTodo, Plus, X } from "lucide-react";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/feedback/states";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useCalendarPrefs } from "@/hooks/useCalendarPrefs";
import { useOrders } from "@/hooks/useOrders";
import { isCancelledStatus } from "@/lib/orderStatus";
import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import { TimeGridCalendar } from "@/components/calendar/TimeGridCalendar";
import { MobileMonthList } from "@/components/calendar/mobile/MobileMonthList";
import { MobileDayWeekView } from "@/components/calendar/mobile/MobileDayWeekView";
import { UpcomingEventsSheet } from "@/components/calendar/UpcomingEventsSheet";
import { CalendarEventDialog } from "@/components/calendar/CalendarEventDialog";
import { CategoryFilterBar } from "@/components/calendar/CategoryFilterBar";
import { AreaFilterBar } from "@/components/calendar/AreaFilterBar";
import { CalendarTasksList } from "@/components/calendar/CalendarTasksList";
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
type MobileView = "mes" | "diaSemana";

export default function CalendarioPage() {
  const { canManageOperations, isSessionLoading } = usePermissions();
  const isMobile = useIsMobile();
  const { data: events, isPending, isError, refetch } = useCalendarEvents({
    enabled: canManageOperations,
  });
  const { data: orders, isPending: isOrdersPending } = useOrders({
    enabled: canManageOperations,
  });
  const { data: tasks } = useCalendarTasks({ enabled: canManageOperations });
  const {
    categoryFilter,
    setCategoryFilter,
    areaFilter,
    setAreaFilter,
    tasksPanelOpen,
    setTasksPanelOpen,
  } = useCalendarPrefs();
  const [view, setView] = useState<CalendarView>("mes");
  const [mobileView, setMobileView] = useState<MobileView>("mes");
  const [mobileSelectedDate, setMobileSelectedDate] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultTime, setDefaultTime] = useState<string | undefined>();
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [mobileTasksOpen, setMobileTasksOpen] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          (categoryFilter === "todos" || e.category === categoryFilter) &&
          (areaFilter === "todas" || e.area === areaFilter)
      ),
    [events, categoryFilter, areaFilter]
  );
  // El filtro de área sólo se aplicaba a `events`: los pedidos (siempre
  // pintados como píldora gris con ícono de paquete, ver `CalendarPill`, sin
  // participar del sistema de colores por categoría) se mostraban igual sin
  // importar qué área estuviera elegida en `AreaFilterBar`.
  const ordersWithDelivery = useMemo(
    () =>
      orders
        // Los cancelados están archivados: no ocupan el calendario.
        .filter((o) => Boolean(o.deliveryDate) && !isCancelledStatus(o.statusId))
        .filter((o) => areaFilter === "todas" || o.area === areaFilter),
    [orders, areaFilter]
  );
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;

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

  const openMobileDay = (date: Date) => {
    setMobileSelectedDate(date);
    setMobileView("diaSemana");
  };

  if (!isSessionLoading && !canManageOperations) {
    return (
      <Card className="mt-10 border-dashed p-10 text-center text-sm text-muted-foreground">
        No tenés permiso para ver esta página.
      </Card>
    );
  }

  const loading = isPending || isOrdersPending || isSessionLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Title
          title="Calendario"
          description="Instalaciones, juntas, visitas a clientes y pedidos con entrega: compartido por todo el equipo."
        />
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setUpcomingOpen(true)}
            className="gap-1.5"
          >
            <ListTodo className="h-4 w-4" />
            Próximos
          </Button>
          <Button
            variant={tasksPanelOpen ? "default" : "outline"}
            onClick={() =>
              isMobile ? setMobileTasksOpen(true) : setTasksPanelOpen(!tasksPanelOpen)
            }
            className="gap-1.5"
          >
            <ListChecks className="h-4 w-4" />
            Tareas
            {pendingTasksCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1.5 py-0">
                {pendingTasksCount}
              </Badge>
            )}
          </Button>
          <Button onClick={() => openCreate()} className="flex-1 gap-1.5 sm:flex-none">
            <Plus className="h-4 w-4" />
            Nuevo evento
          </Button>
        </div>
      </div>

      {isMobile ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <CategoryFilterBar value={categoryFilter} onChange={setCategoryFilter} compact />
            <AreaFilterBar value={areaFilter} onChange={setAreaFilter} compact />
          </div>

          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : loading ? (
            <Skeleton className="h-[32rem] w-full" />
          ) : mobileView === "mes" ? (
            <MobileMonthList
              events={filteredEvents}
              orders={ordersWithDelivery}
              onSelectDay={openMobileDay}
            />
          ) : (
            <MobileDayWeekView
              events={filteredEvents}
              orders={ordersWithDelivery}
              initialDate={mobileSelectedDate}
              onBack={() => setMobileView("mes")}
              onAddAt={openCreateAt}
              onEdit={openEdit}
              onSelectOrder={setOpenOrderId}
            />
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4 xl:flex-row">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <ToggleGroup
                type="single"
                variant="segmented"
                size="sm"
                value={view}
                onValueChange={(v) => v && setView(v as CalendarView)}
                aria-label="Vista"
                className="shrink-0 self-start rounded-full border bg-card p-1"
              >
                <ToggleGroupItem value="dia">Día</ToggleGroupItem>
                <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
                <ToggleGroupItem value="mes">Mes</ToggleGroupItem>
              </ToggleGroup>
              <div className="flex flex-wrap items-center gap-2">
                <CategoryFilterBar value={categoryFilter} onChange={setCategoryFilter} />
                <AreaFilterBar value={areaFilter} onChange={setAreaFilter} />
              </div>
            </div>

            {isError ? (
              <ErrorState onRetry={() => refetch()} />
            ) : loading ? (
              <Skeleton className="h-[32rem] w-full" />
            ) : view === "mes" ? (
              <TeamCalendar
                events={filteredEvents}
                orders={ordersWithDelivery}
                onAddForDay={openCreate}
                onEdit={openEdit}
                onSelectOrder={setOpenOrderId}
              />
            ) : (
              <Card className="p-2 sm:p-4">
                <TimeGridCalendar
                  view={view === "semana" ? "timeGridWeek" : "timeGridDay"}
                  events={filteredEvents}
                  orders={ordersWithDelivery}
                  onAddAt={openCreateAt}
                  onEdit={openEdit}
                  onSelectOrder={setOpenOrderId}
                />
              </Card>
            )}

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              Los pedidos se marcan con <span className="font-medium">un ícono de paquete</span> — se
              editan desde &quot;Pedidos&quot;, acá sólo se consultan.
            </p>
          </div>

          {tasksPanelOpen && (
            <aside className="w-full shrink-0 xl:w-80">
              <Card className="flex h-96 flex-col xl:sticky xl:top-4 xl:h-[32rem]">
                <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle>Tareas pendientes</CardTitle>
                  <SimpleTooltip label="Ocultar tareas">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setTasksPanelOpen(false)}
                      aria-label="Ocultar tareas"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </SimpleTooltip>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col p-4 pt-2">
                  <CalendarTasksList />
                </CardContent>
              </Card>
            </aside>
          )}
        </div>
      )}

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
        events={filteredEvents}
        orders={ordersWithDelivery}
        onEdit={openEdit}
        onSelectOrder={setOpenOrderId}
      />

      <Sheet open={mobileTasksOpen} onOpenChange={setMobileTasksOpen}>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col">
          <SheetHeader className="text-left">
            <SheetTitle>Tareas pendientes</SheetTitle>
          </SheetHeader>
          <div className="mt-2 flex h-[65dvh] flex-col">
            <CalendarTasksList />
          </div>
        </SheetContent>
      </Sheet>

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}
