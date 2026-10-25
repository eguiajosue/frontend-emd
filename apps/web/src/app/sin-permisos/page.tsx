import type { Metadata } from "next";
import { ForbiddenScreen } from "@/components/feedback/ErrorScreen";

export const metadata: Metadata = {
  title: "Sin permisos · EMD marketing & design",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ForbiddenScreen layout="page" />;
}
