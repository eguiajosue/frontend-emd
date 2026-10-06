"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, CloudOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/StatusBadge";
import { DETAIL_BLOCK_CLASS } from "@/components/orders/detail/DetailSection";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { HandoffStages } from "@/components/orders/OrderHandoff";
import { useAreaTasks } from "@/hooks/useAreaTasks";
import { usePendingSync } from "@/hooks/usePendingSync";
import { useForceFinishOrder, useMoveOrderStatus } from "@/hooks/useOrders";
import { PRODUCTION_AREA_OPTIONS, getAreaLabel } from "@/lib/areas";
import { buildOrderHandoff } from "@/lib/orderHandoff";
import {
  getOrderNextAction,
  type OrderDetailPermissions,
  type OrderDetailViewer,
} from "@/lib/orderDetail";
import { isCancelledStatus, statusOptions } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

const CANCELLED_STATUS_ID = statusOptions.find((o) => o.label === "cancelado")?.value ?? 10;
const FINISHED_STATUS_ID = statusOptions.find((o) => o.label === "terminado")?.value ?? 4;

export type OrderDetailSectionTarget = "design" | "areas";

/**
 * "Dónde está y qué sigue": la cadena de etapas, quién tiene el pedido y UN
 * botón con lo que este usuario puede hacer ahora. Reemplaza a la tira de
 * pase + los cinco botones de estado + los campos "Área/Etapa actual", que
 * decían lo mismo de cuatro maneras y a veces se contradecían.
 *
 * El estado formal (pendiente, en proceso…) se ve una sola vez, en el botón
 * "Estado ▾" de quien gestiona; cancelar va aparte y pide confirmación.
 */
export function OrderProgressPanel({
  order,
  permissions,
  viewer,
  onGoToSection,
}: {
  order: Order;
  permissions: OrderDetailPermissions;
  viewer: OrderDetailViewer;
  onGoToSection: (section: OrderDetailSectionTarget) => void;
}) {
  // Misma queryKey que "Producción" (AreaTasksSection): React Query dedupe.
  const { tasks } = useAreaTasks(order.id);
  const pendingSync = usePendingSync(order.id);
  const handoff = buildOrderHandoff(order, tasks);
  const action = getOrderNextAction(order, handoff, permissions, viewer, tasks.length);

  const moveActor = useMemo(
    () => ({
      areas: viewer.roles.filter((r) => PRODUCTION_AREA_OPTIONS.some((a) => a.value === r)),
      isManager: viewer.canManageOperations,
    }),
    [viewer.roles, viewer.canManageOperations]
  );
  const { move, isMoving } = useMoveOrderStatus(moveActor);
  const { forceFinish, isForcing } = useForceFinishOrder();
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmForceOpen, setConfirmForceOpen] = useState(false);
  const busy = isMoving || isForcing;
  // El detalle (`GET /orders/:id`) no trae las tareas de área: sin ellas,
  // mover el estado escribía sólo el pedido y el tablero de producción (que
  // ubica cada pedido por sus tareas) no se enteraba.
  const orderWithTasks = useMemo(() => ({ ...order, areaTasks: tasks }), [order, tasks]);
  const unfinishedTasks = tasks.filter((t) => t.status !== "terminado");

  /**
   * Cambiar el estado. "Terminado" = listo para entregar: si lo pide quien
   * gestiona con áreas todavía trabajando, es FORZARLO y se confirma antes.
   */
  const changeTo = (statusId: number) => {
    if (statusId === FINISHED_STATUS_ID && permissions.canEdit && unfinishedTasks.length > 0) {
      setConfirmForceOpen(true);
      return;
    }
    void move(orderWithTasks, statusId);
  };

  const cancelled = isCancelledStatus(order.statusId);
  const current = handoff.current;
  // "Recepción · Recepción" no informa nada: el responsable sólo se nombra
  // cuando no es la etapa misma.
  const holderRaw =
    handoff.holderLabel && handoff.holderLabel.toLowerCase() !== current.label.toLowerCase()
      ? handoff.holderLabel
      : null;
  const holder = holderRaw === "sin asignar" ? "sin responsable" : holderRaw;

  const canUseStatusMenu = permissions.canEdit && permissions.canChangeStatus;
  const menuOptions = statusOptions.filter(
    (o) =>
      o.value !== order.statusId &&
      o.value !== CANCELLED_STATUS_ID &&
      (!permissions.allowedStatusIds || permissions.allowedStatusIds.includes(o.value))
  );

  const runAction = () => {
    if (!action) return;
    if (action.kind === "status") changeTo(action.statusId);
    else onGoToSection(action.section);
  };

  return (
    <section
      aria-label="Dónde está el pedido"
      className={cn(
        "space-y-5",
        DETAIL_BLOCK_CLASS,
        cancelled && "border-destructive/30 bg-destructive/5"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HandoffStages stages={handoff.stages} />
        {pendingSync && (
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
            title="El último cambio se guardó sin conexión y se va a sincronizar solo apenas vuelva la red."
          >
            <CloudOff className="h-3 w-3 shrink-0" aria-hidden />
            Pendiente de sincronizar
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border/60 pt-5">
        <div className="min-w-0 space-y-1">
          {cancelled ? (
            <p className="font-medium text-destructive">{handoff.nextStep}</p>
          ) : (
            <>
              <p className="font-heading text-lg leading-snug tracking-tight">
                Ahora en <span className="font-semibold">{current.label}</span>
                {holder && <span className="text-muted-foreground"> · {holder}</span>}
              </p>
              {/* Con botón, el botón ya dice qué sigue; sin botón, se dice a
                  quién se espera. */}
              {!action && (
                <p className="text-sm text-muted-foreground">Sigue: {handoff.nextStep}</p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUseStatusMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* El estado ya se ve en la cabecera: aquí sólo el control. */}
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  disabled={busy}
                  aria-label="Cambiar estado"
                >
                  Cambiar estado
                  <ChevronDown className="text-muted-foreground" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>Mover a…</DropdownMenuLabel>
                {menuOptions.map((option) => (
                  <DropdownMenuItem key={option.value} onSelect={() => changeTo(option.value)}>
                    <StatusBadge statusId={option.value} />
                  </DropdownMenuItem>
                ))}
                {!cancelled && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setConfirmCancelOpen(true)}>
                      Cancelar pedido…
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {action && (
            <Button type="button" className="gap-1.5" onClick={runAction} disabled={busy}>
              {busy && action.kind !== "section" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {action.label}
              {action.kind !== "status" && <ArrowRight className="h-4 w-4" aria-hidden />}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        onConfirm={() => {
          setConfirmCancelOpen(false);
          void move(orderWithTasks, CANCELLED_STATUS_ID);
        }}
        title={`¿Cancelar el pedido #${order.id}?`}
        description="Sale del tablero y deja de avisar a las áreas. Se puede volver a activar cambiando el estado."
        confirmLabel="Cancelar pedido"
        cancelLabel="Volver"
      />

      <ConfirmDeleteDialog
        open={confirmForceOpen}
        onOpenChange={setConfirmForceOpen}
        onConfirm={() => {
          setConfirmForceOpen(false);
          void forceFinish(order, tasks);
        }}
        title={`¿Marcar el pedido #${order.id} como listo para entregar?`}
        description={`${
          unfinishedTasks.length === 1
            ? `${getAreaLabel(unfinishedTasks[0].area)} todavía no terminó`
            : `${unfinishedTasks.length} áreas todavía no terminaron (${unfinishedTasks
                .map((t) => getAreaLabel(t.area))
                .join(", ")})`
        }. Se van a marcar como terminadas y el pedido queda listo para entregar.`}
        confirmLabel="Marcar listo"
        cancelLabel="Volver"
      />
    </section>
  );
}
