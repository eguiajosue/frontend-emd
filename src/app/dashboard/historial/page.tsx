"use client";

import { useState } from "react";
import { toast } from "sonner";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { CardsSkeleton, ErrorState } from "@/components/feedback/states";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderDetailDialog } from "@/components/orders/OrderDetailDialog";
import { useOrderHistoryList, downloadOrdersExport } from "@/hooks/useOrders";
import { useAuthToken } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { motion } from "framer-motion";
import { staggerContainerVariants } from "@/lib/motion";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";

const PAGE_SIZE = 20;

/**
 * Historial completo de pedidos: TODOS los pedidos de la empresa, sin la
 * ventana de retención que oculta los entregados viejos del tablero en vivo
 * (`/dashboard/orders`). Reutiliza `OrderCard`/`OrderDetailDialog` para que
 * se vea consistente con esa pantalla.
 */
const HistorialPage = () => {
  const [page, setPage] = useState(1);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const { orders, meta, isPending, isError, refetch, isFetching } = useOrderHistoryList(
    page,
    PAGE_SIZE
  );
  const { canManageOperations } = usePermissions();
  const token = useAuthToken();

  const totalPages = meta?.totalPages ?? 1;

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      await downloadOrdersExport(token, {});
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo exportar el CSV."
      );
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Title title="Historial de Pedidos" />
          <p className="text-muted-foreground">
            Todos los pedidos de la empresa, incluidos los entregados hace tiempo
            que ya no aparecen en el tablero.
          </p>
        </div>
        {canManageOperations && (
          <Button variant="outline" onClick={handleExportCsv} disabled={isExportingCsv}>
            <FileDown className="mr-2 h-4 w-4" />
            {isExportingCsv ? "Exportando..." : "Exportar CSV"}
          </Button>
        )}
      </div>

      {isPending ? (
        <CardsSkeleton count={8} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : orders.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <p>Todavía no hay pedidos registrados.</p>
        </div>
      ) : (
        <>
          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            variants={staggerContainerVariants}
            initial="hidden"
            animate="show"
          >
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onOpen={setOpenOrderId} />
            ))}
          </motion.div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <p className="text-xs text-muted-foreground">
              {meta ? `Página ${meta.page} de ${meta.totalPages} · ${meta.total} pedidos` : null}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <OrderDetailDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
};

export default HistorialPage;
