import { ArrowLeft } from "lucide-react";
import { NotFoundScreen } from "@/components/feedback/ErrorScreen";

export default function OrderNotFound() {
  return (
    <NotFoundScreen
      title="No encontramos este pedido"
      description="Puede que el número esté mal, que lo hayan eliminado o que no esté asignado a tu área."
      primary={{ label: "Ver pedidos", href: "/dashboard/orders", icon: ArrowLeft }}
      secondary={{ label: "Volver al inicio", href: "/dashboard" }}
    />
  );
}
