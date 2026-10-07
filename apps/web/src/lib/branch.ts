import type { Order } from "@/types";

/** Nombre de la sucursal de origen del pedido ("Punto Madero"), o null si es de la matriz. */
export function orderBranchName(order: Pick<Order, "branch">): string | null {
  return order.branch?.name ?? null;
}

/** "Punto Madero · Ana López": quién levantó el pedido desde la sucursal. */
export function branchOriginLabel(order: Pick<Order, "branch" | "branchEmployee">): string | null {
  const branch = orderBranchName(order);
  if (!branch) return null;
  return [branch, order.branchEmployee?.name].filter(Boolean).join(" · ");
}
