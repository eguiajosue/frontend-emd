import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/feedback/ErrorScreen";

export const metadata: Metadata = {
  title: "Página no encontrada · EMD marketing & design",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundScreen layout="page" />;
}
