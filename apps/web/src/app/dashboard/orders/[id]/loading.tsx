import { Skeleton } from "@/components/ui/skeleton";

export default function OrderDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" role="status" aria-busy="true" aria-label="Cargando pedido">
      <span className="sr-only">Cargando pedido…</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
