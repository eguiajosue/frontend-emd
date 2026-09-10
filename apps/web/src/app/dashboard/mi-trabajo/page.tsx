"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * "Mi trabajo" se fusionó con la pantalla de Pedidos.
 *
 * Para un rol operativo las dos mostraban el mismo trabajo con otra forma: una
 * como tarjetas de tarea, la otra como lista y tablero. Ahora hay una sola, que
 * se llama "Pedidos" para quien administra y "Tareas asignadas" para quien
 * ejecuta (ver `ordersScreenTitle`). Esta ruta queda sólo para no romper links
 * guardados y redirige a la nueva.
 */
const MiTrabajoRedirect = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/orders");
  }, [router]);

  return null;
};

export default MiTrabajoRedirect;
