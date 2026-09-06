import { redirect } from "next/navigation";

// Reemplazada por la pantalla unificada de Clientes (pestañas Clientes/Empresas).
export default function CompaniesRedirect() {
  redirect("/dashboard/clientes?tab=empresas");
}
