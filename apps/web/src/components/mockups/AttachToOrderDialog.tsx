"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { useMyBranch } from "@/hooks/useBranches";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockupErrorMessage, useCreateOrderMockup } from "@/hooks/useOrderMockups";
import { getOrderClientName } from "@/lib/format";
import { BranchBadge } from "@/components/orders/BranchBadge";
import { buildMockupPayload, type MockupStudioResult } from "@/lib/mockups/studio";
import { isFinishedStatus } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

const MAX_RESULTS = 30;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Busca por número de pedido (con o sin "#") o por nombre del cliente. */
export function filterOrdersForAttach(orders: Order[], query: string): Order[] {
  const q = normalize(query.trim().replace(/^#/, ""));
  const matches = q
    ? orders.filter((o) => String(o.id).includes(q) || normalize(getOrderClientName(o)).includes(q))
    : orders;
  // Los pedidos en curso primero; dentro de cada grupo, los más nuevos.
  return [...matches]
    .sort((a, b) => {
      const fa = isFinishedStatus(a.statusId) ? 1 : 0;
      const fb = isFinishedStatus(b.statusId) ? 1 : 0;
      return fa - fb || b.id - a.id;
    })
    .slice(0, MAX_RESULTS);
}

/**
 * "Adjuntar a pedido" desde la pantalla de Mockups: elige el pedido (por
 * número o cliente) y guarda ahí la lámina con su configuración.
 */
export function AttachToOrderDialog({
  open,
  onOpenChange,
  result,
  onAttached,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: MockupStudioResult | null;
  onAttached?: (orderId: number) => void;
}) {
  const router = useRouter();
  const { data: orders = [], isPending, isError, refetch } = useOrders({ enabled: open });
  const createMockup = useCreateOrderMockup();
  // Cuenta de sucursal: puede indicar (opcional) qué empleado armó el mockup.
  const { isBranch } = usePermissions();
  const { branch } = useMyBranch(open && isBranch);
  const [employeeId, setEmployeeId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setError(null);
      setSavingId(null);
      setEmployeeId(undefined);
    }
  }, [open]);

  const results = useMemo(() => filterOrdersForAttach(orders, query), [orders, query]);

  const attach = async (order: Order) => {
    if (!result || savingId !== null) return;
    setSavingId(order.id);
    setError(null);
    try {
      await createMockup.mutateAsync({
        orderId: order.id,
        payload: { ...buildMockupPayload(result), branchEmployeeId: isBranch ? employeeId : undefined },
      });
      toast.success(`Mockup adjuntado al pedido #${order.id}`, {
        action: {
          label: "Ver pedido",
          onClick: () => router.push(`/dashboard/orders/${order.id}`),
        },
      });
      onAttached?.(order.id);
      onOpenChange(false);
    } catch (err) {
      setError(mockupErrorMessage(err, "No se pudo adjuntar el mockup al pedido."));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => savingId === null && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjuntar a pedido</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isBranch && branch && branch.employees.length > 0 && (
            <Select
              value={employeeId ? String(employeeId) : ""}
              onValueChange={(v) => setEmployeeId(v ? Number(v) : undefined)}
            >
              <SelectTrigger aria-label="Empleado que armó el mockup" className="h-11 rounded-full">
                <SelectValue placeholder="¿Quién lo armó? (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {branch.employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Número de pedido o cliente…"
              aria-label="Buscar pedido"
              className="h-11 rounded-full pl-10"
              autoFocus
            />
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 px-1 py-6 text-center text-sm text-muted-foreground">
              <p>No se pudieron cargar los pedidos.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          ) : results.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {query.trim() ? "Ningún pedido coincide con la búsqueda." : "No hay pedidos para elegir."}
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-1 overflow-y-auto sm:max-h-80" aria-label="Pedidos">
              {results.map((order) => {
                const saving = savingId === order.id;
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => attach(order)}
                      disabled={savingId !== null}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60",
                        saving && "bg-muted"
                      )}
                    >
                      <span className="w-14 shrink-0 font-heading text-sm font-semibold tabular-nums">
                        #{order.id}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{getOrderClientName(order)}</span>
                        {(order.description || order.status?.name) && (
                          <span className="block truncate text-meta">
                            {[order.status?.name, order.description].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <BranchBadge order={order} size="sm" />
                      {saving && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-label="Adjuntando" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
