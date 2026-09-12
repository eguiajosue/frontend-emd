"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ListChecks, ListTodo, Plus, X } from "lucide-react";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/feedback/states";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useCalendarPrefs } from "@/hooks/useCalendarPrefs";
import { useOrders } from "@/hooks/useOrders";
import { TeamCalendar } from "@/components/calendar/TeamCalendar";
import { TimeGridCalendar } from "@/components/calendar/TimeGridCalendar";
import { MobileMonthList } from "@/components/calendar/mobile/MobileMonthList";
import { MobileDayWeekView } from "@/components/calendar/mobile/MobileDayWeekView";
import { UpcomingEventsSheet } from "@/components/calendar/UpcomingEventsSheet";
import { CalendarEventDialog } from "@/components/calendar/CalendarEventDialog";
import { CategoryFilterBar } from "@/components/calendar/CategoryFilterBar";
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
  const { categoryFilter, setCategoryFilter, tasksPanelOpen, setTasksPanelOpen } =
    useCalendarPrefs();
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

  const ordersWithDelivery = orders.filter((o) => Boolean(o.deliveryDate));
  const filteredEvents = useMemo(
    () =>
      categoryFilter === "todos" ? events : events.filter((e) => e.category === categoryFilter),
    [events, categoryFilter]
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
          <CategoryFilterBar value={categoryFilter} onChange={setCategoryFilter} compact />

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
              <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
                <TabsList>
                  <TabsTrigger value="dia">Día</TabsTrigger>
                  <TabsTrigger value="semana">Semana</TabsTrigger>
                  <TabsTrigger value="mes">Mes</TabsTrigger>
                </TabsList>
              </Tabs>
              <CategoryFilterBar value={categoryFilter} onChange={setCategoryFilter} />
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
              <div className="rounded-xl border bg-card p-2 shadow-soft sm:p-4">
                <TimeGridCalendar
                  view={view === "semana" ? "timeGridWeek" : "timeGridDay"}
                  events={filteredEvents}
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
          </div>

          {tasksPanelOpen && (
            <aside className="w-full shrink-0 xl:w-80">
              <div className="flex h-96 flex-col rounded-xl border bg-card p-3 shadow-soft xl:sticky xl:top-4 xl:h-[32rem]">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Tareas pendientes</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setTasksPanelOpen(false)}
                    aria-label="Ocultar tareas"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <CalendarTasksList />
              </div>
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
