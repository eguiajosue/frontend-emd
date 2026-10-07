import { Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { orderBranchName } from "@/lib/branch";
import type { Order } from "@/types";

/** Insignia "Punto Madero" de los pedidos que levantó una sucursal (nada si es de la matriz). */
export function BranchBadge({
  order,
  className,
}: {
  order: Pick<Order, "branch">;
  className?: string;
}) {
  const name = orderBranchName(order);
  if (!name) return null;
  return (
    <span
      data-testid="branch-badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-xs font-medium text-foreground",
        className
      )}
    >
      <Store className="h-3 w-3 text-muted-foreground" aria-hidden />
      {name}
    </span>
  );
}
