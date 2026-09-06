import { redirect } from "next/navigation";

// Reemplazada por la pantalla unificada de Usuarios (pestañas Usuarios/Roles).
export default function UsersRedirect() {
  redirect("/dashboard/usuarios?tab=usuarios");
}
