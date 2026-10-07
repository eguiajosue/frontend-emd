"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, TableSkeleton } from "@/components/feedback/states";
import { EmptyState } from "@/components/ui/empty-state";
import { useRestockMutations, useRestockRequests } from "@/hooks/useInventory";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { getErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { RESTOCK_STATUS_META, RESTOCK_STATUSES, inventoryAreaLabel } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { RestockRequest, RestockRequestStatus } from "@/types";

const WHEN: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const NEXT_ACTIONS: Record<RestockRequestStatus, RestockRequestStatus[]> = {
  PENDIENTE: ["EN_CAMINO", "COMPRADO", "RESUELTO"],
  EN_CAMINO: ["COMPRADO", "RESUELTO"],
  COMPRADO: ["RESUELTO"],
  RESUELTO: ["PENDIENTE"],
};

const ACTION_LABEL: Record<RestockRequestStatus, string> = {
  PENDIENTE: "Reabrir",
  EN_CAMINO: "Marcar en camino",
  COMPRADO: "Marcar comprado",
  RESUELTO: "Marcar resuelto",
};

function RequestRow({ request, canManage }: { request: RestockRequest; canManage: boolean }) {
  const { timeFormat } = useTimeFormat();
  const { updateStatus } = useRestockMutations();
  const [note, setNote] = useState("");
  const meta = RESTOCK_STATUS_META[request.status];
  const who = [request.requestedBy.firstName, request.requestedBy.lastName].filter(Boolean).join(" ");

  const move = async (status: RestockRequestStatus) => {
    try {
      await updateStatus.mutateAsync({ id: request.id, payload: { status, note: note.trim() || undefined } });
      setNote("");
      toast.success(`Solicitud: ${RESTOCK_STATUS_META[status].label.toLowerCase()}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo actualizar la solicitud."));
    }
  };

  return (
    <li className="space-y-2 py-4" data-testid="restock-row">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">
            {request.itemName}
            {request.quantity != null && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {request.quantity}
                {request.unit ? ` ${request.unit}` : ""}
              </span>
            )}
          </p>
          <p className="text-meta">
            {inventoryAreaLabel(request.area)} · {who} · {formatDateTime(request.createdAt, WHEN, timeFormat)}
          </p>
          {request.comment && <p className="text-sm text-muted-foreground">{request.comment}</p>}
          {request.statusNote && <p className="text-sm">Recepción: {request.statusNote}</p>}
        </div>
        {request.urgency === "URGENTE" && (
          <Badge className="border-transparent bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300">
            Urgente
          </Badge>
        )}
        <Badge className={cn(meta.className)}>{meta.label}</Badge>
      </div>
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional): llega el jueves…"
            aria-label={`Nota para ${request.itemName}`}
            className="h-9 w-full rounded-full text-sm sm:w-64"
          />
          {NEXT_ACTIONS[request.status].map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === "RESUELTO" ? "default" : "secondary"}
              className="h-9 rounded-full px-4"
              disabled={updateStatus.isPending}
              onClick={() => move(status)}
            >
              {ACTION_LABEL[status]}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * Bandeja "Solicitudes de reabasto". Recepción/admin cambian el estado
 * (pendiente → en camino/comprado → resuelto); quien pidió sólo ve el avance.
 */
export function RestockRequestsPanel({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<RestockRequestStatus | "open" | "all">("open");
  const { data, isPending, isError, refetch } = useRestockRequests(
    status === "open" ? { open: true } : status === "all" ? {} : { status }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar solicitudes">
        {([["open", "Abiertas"], ...RESTOCK_STATUSES.map((s) => [s, RESTOCK_STATUS_META[s].label]), ["all", "Todas"]] as [
          string,
          string,
        ][]).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "secondary"}
            className="h-9 rounded-full px-4"
            aria-pressed={status === value}
            onClick={() => setStatus(value as typeof status)}
          >
            {label}
          </Button>
        ))}
      </div>
      {isPending ? (
        <TableSkeleton rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Sin solicitudes"
          description={
            canManage
              ? "Cuando un área avise que algo se acabó, aparecerá aquí."
              : "Usa “Avisar reabasto” cuando algo se acabe y aquí verás cómo avanza."
          }
        />
      ) : (
        <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card px-4 shadow-soft sm:px-5">
          {(data ?? []).map((request) => (
            <RequestRow key={request.id} request={request} canManage={canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}
