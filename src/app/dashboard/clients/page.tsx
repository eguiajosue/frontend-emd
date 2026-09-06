import { redirect } from "next/navigation";

// Reemplazada por la pantalla unificada de Clientes (pestañas Clientes/Empresas).
export default function ClientsRedirect() {
  redirect("/dashboard/clientes?tab=clientes");
}
