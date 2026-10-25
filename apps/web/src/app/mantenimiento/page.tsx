import type { Metadata } from "next";
import { ErrorScreen } from "@/components/feedback/ErrorScreen";

export const metadata: Metadata = {
  title: "En mantenimiento · EMD marketing & design",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ErrorScreen
      layout="page"
      variant="503"
      plainLinks
      primary={{ label: "Reintentar", href: "/dashboard" }}
    />;
}
