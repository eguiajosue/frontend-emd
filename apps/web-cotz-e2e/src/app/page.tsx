import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { homePathForRoles } from "@/lib/navMenu";

export default async function Home() {
  const session = await getServerSession(authOptions);
  redirect(session ? homePathForRoles(session.user?.roles ?? []) : "/login");
}
