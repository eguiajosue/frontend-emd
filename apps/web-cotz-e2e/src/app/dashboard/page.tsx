import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { homePathForRoles } from "@/lib/navMenu";

/**
 * `/dashboard` no es una pantalla: es el "inicio" y depende del rol (admin →
 * Panel General, el resto → su trabajo). Se resuelve en el servidor para no
 * pintar una página y saltar a otra en el cliente.
 */
export default async function DashboardHome() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  redirect(homePathForRoles(session.user?.roles ?? []));
}
