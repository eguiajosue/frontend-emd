import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { notificationTag, type NotificationType } from "@/lib/notifications";

/**
 * Etiqueta ("tag") del tipo de notificación, para el panel de
 * notificaciones: cada tipo tiene su propio texto y color (ej. "Cambio de
 * estado" para `order_status_changed`), así se distinguen de un vistazo.
 */
export function NotificationTypeBadge({
  type,
  className,
}: {
  type: NotificationType;
  className?: string;
}) {
  const tag = notificationTag(type);
  return (
    <Badge variant="outline" className={cn(tag.className, className)}>
      {tag.label}
    </Badge>
  );
}

export default NotificationTypeBadge;
