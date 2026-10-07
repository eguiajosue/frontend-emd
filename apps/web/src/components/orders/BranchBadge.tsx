import { BranchLogo, type BranchLogoSize, type BranchLogoSurface } from "@/components/orders/BranchLogo";
import type { Order } from "@/types";

/**
 * Identificador de los pedidos que levantó una sucursal: su LOGO (versión que
 * contrasta con el fondo) o, si todavía no tiene logo cargado, el badge con el
 * nombre ("Punto Madero"). Nada si el pedido es de la matriz.
 */
export function BranchBadge({
  order,
  className,
  surface,
  size,
  loading,
}: {
  order: Pick<Order, "branch">;
  className?: string;
  surface?: BranchLogoSurface;
  size?: BranchLogoSize;
  loading?: "lazy" | "eager";
}) {
  return (
    <BranchLogo
      branchId={order.branch?.id}
      name={order.branch?.name}
      surface={surface}
      size={size}
      loading={loading}
      className={className}
    />
  );
}
