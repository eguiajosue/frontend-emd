import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { homePathFor } from "@/lib/navMenu";

export default async function Home() {
  const session = await getServerSession(authOptions);
  redirect(session ? homePathFor({ roles: session.user?.roles ?? [], areas: session.user?.areas ?? [] }) : "/login");
}
