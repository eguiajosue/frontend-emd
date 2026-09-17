import { redirect } from "next/navigation";

/**
 * "Estatus de Pedidos" se fusionó con la pantalla de Pedidos: la misma
 * pantalla en `/dashboard/orders` ahora filtra por rol y trae el toggle
 * lista/cuadrícula para todos. Esta ruta se mantiene sólo para no romper
 * links guardados (favoritos, historial) y redirige a la nueva.
 *
 * Redirect en el servidor (como clients/companies/roles/users) en vez de un
 * useEffect + router.replace del lado del cliente: evita enviar JS y montar
 * un componente sólo para redirigir.
 */
const EstatusPedidosRedirect = () => {
  redirect("/dashboard/orders");
};

export default EstatusPedidosRedirect;
