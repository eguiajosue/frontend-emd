import { redirect } from "next/navigation";

/**
 * "Mi trabajo" se fusionó con la pantalla de Pedidos.
 *
 * Para un rol operativo las dos mostraban el mismo trabajo con otra forma: una
 * como tarjetas de tarea, la otra como lista y tablero. Ahora hay una sola, que
 * se llama "Pedidos" para quien administra y "Tareas asignadas" para quien
 * ejecuta (ver `ordersScreenTitle`). Esta ruta queda sólo para no romper links
 * guardados y redirige a la nueva.
 *
 * Redirect en el servidor (como clients/companies/roles/users) en vez de un
 * useEffect + router.replace del lado del cliente: evita enviar JS y montar
 * un componente sólo para redirigir.
 */
const MiTrabajoRedirect = () => {
  redirect("/dashboard/orders");
};

export default MiTrabajoRedirect;
