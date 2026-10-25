import type { Metadata } from "next";
import { UnauthorizedScreen } from "@/components/feedback/ErrorScreen";

export const metadata: Metadata = {
  title: "Sesión expirada · EMD marketing & design",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <UnauthorizedScreen layout="page" plainLinks />;
}
