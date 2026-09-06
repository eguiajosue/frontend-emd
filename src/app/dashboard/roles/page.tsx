import { redirect } from "next/navigation";

// Reemplazada por la pantalla unificada de Usuarios (pestañas Usuarios/Roles).
export default function RolesRedirect() {
  redirect("/dashboard/usuarios?tab=roles");
}
