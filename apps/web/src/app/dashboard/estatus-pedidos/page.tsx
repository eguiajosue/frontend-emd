"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * "Estatus de Pedidos" se fusionó con la pantalla de Pedidos: la misma
 * pantalla en `/dashboard/orders` ahora filtra por rol y trae el toggle
 * lista/cuadrícula para todos. Esta ruta se mantiene sólo para no romper
 * links guardados (favoritos, historial) y redirige a la nueva.
 */
const EstatusPedidosRedirect = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/orders");
  }, [router]);

  return null;
};

export default EstatusPedidosRedirect;
