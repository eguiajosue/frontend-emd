import type { Metadata } from "next";
import { ClientPortalPage } from "@/components/portal/ClientPortalPage";

/**
 * Portal del cliente: `/p/<token>`. Público (sin sesión): el token del enlace
 * es la llave. No se indexa ni se comparte el token por Referer.
 */
export const metadata: Metadata = {
  title: "Tu pedido · EMD marketing & design",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClientPortalPage token={token} />;
}
