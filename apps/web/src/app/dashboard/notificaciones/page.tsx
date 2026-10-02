"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCheck, MailCheck } from "lucide-react";
import { motion } from "framer-motion";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/feedback/states";
import { ErrorState } from "@/components/feedback/states";
import { useNotifications } from "@/hooks/useNotifications";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";
import { NotificationTypeBadge } from "@/components/notifications/NotificationTypeBadge";
import {
  NOTIFICATION_GROUP_LABELS,
  notificationGroup,
  type NotificationGroup,
} from "@/lib/notifications";
import { groupByDay } from "@/lib/notificationGrouping";

type Filter = "all" | "unread" | "read";

/** Categorías del selector, en el orden en que se muestran. */
const GROUP_FILTERS: NotificationGroup[] = [
  "pedidos",
  "diseno",
  "produccion",
  "otras",
];

function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

export default function NotificacionesPage() {
  const router = useRouter();
  const { reduced, staggerItemVariants } = useMotionPreset();
  const [filter, setFilter] = useState<Filter>("all");
  // Categoría (pedidos / diseño / producción / otras) además de leídas o no.
  // Con una sola lista plana de todo, encontrar "¿qué pasó con mis diseños?"
  // era leer 100 renglones.
  const [group, setGroup] = useState<NotificationGroup | "all">("all");

  const {
    notifications,
    isLoading,
    isError,
    isUnavailable,
    refetch,
    markAsRead,
    markAllAsRead,
    isMarkingAll,
  } = useNotifications(1, 100);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "unread" && n.read) return false;
      if (filter === "read" && !n.read) return false;
      if (group !== "all" && notificationGroup(n.type) !== group) return false;
      return true;
    });
  }, [notifications, filter, group]);

  /** Cuántas hay en cada categoría, para no ofrecer un filtro que da vacío. */
  const countsByGroup = useMemo(() => {
    const counts = new Map<NotificationGroup, number>();
    notifications.forEach((n) => {
      const key = notificationGroup(n.type);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [notifications]);

  /** Cortes por día ("Hoy", "Ayer", ...) sobre lo que quedó filtrado. */
  const dayGroups = useMemo(() => groupByDay(filtered), [filtered]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const availableGroups = GROUP_FILTERS.filter((key) => (countsByGroup.get(key) ?? 0) > 0);

  const handleSelect = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id);
    if (notification.orderId) {
      router.push(`/dashboard/orders/${notification.orderId}`);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Title title="Notificaciones" />
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={isMarkingAll}
            onClick={() => markAllAsRead()}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          variant="segmented"
          size="sm"
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
          aria-label="Estado de lectura"
          className="self-start rounded-full border bg-card p-1"
        >
          <ToggleGroupItem value="all">Todas</ToggleGroupItem>
          <ToggleGroupItem value="unread" className="gap-1.5">
            No leídas
            {unreadCount > 0 && <span className="text-xs tabular-nums opacity-70">{unreadCount}</span>}
          </ToggleGroupItem>
          <ToggleGroupItem value="read">Leídas</ToggleGroupItem>
        </ToggleGroup>

        {availableGroups.length > 0 && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={group}
            onValueChange={(v) => v && setGroup(v as typeof group)}
            aria-label="Tipo de notificación"
            className="flex-wrap justify-start"
          >
            <ToggleGroupItem value="all" className="rounded-full px-3 text-xs">
              Todo
            </ToggleGroupItem>
            {availableGroups.map((key) => (
              <ToggleGroupItem key={key} value={key} className="gap-1.5 rounded-full px-3 text-xs">
                {NOTIFICATION_GROUP_LABELS[key]}
                <span className="tabular-nums opacity-70">{countsByGroup.get(key)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <ErrorState
          title="No se pudieron cargar las notificaciones"
          description="Ocurrió un problema al comunicarse con el servidor."
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MailCheck}
          title={
            isUnavailable
              ? "Las notificaciones todavía no están disponibles"
              : filter === "unread"
              ? "Ni una notificación pendiente. Buen trabajo."
              : filter === "read"
              ? "Todavía no leíste ninguna notificación"
              : "Acá aparecen las notificaciones"
          }
          description={
            isUnavailable
              ? "Esta función se está desplegando del lado del servidor. Intentar nuevamente en un rato."
              : filter === "all"
              ? "Cuando Recepción asigne un pedido o algo cambie, el aviso aparece acá."
              : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {dayGroups.map((dayGroup) => (
            <section key={dayGroup.key} className="space-y-2">
              <h2 className="sticky top-0 z-10 bg-background/95 py-1 text-label backdrop-blur first-letter:uppercase">
                {dayGroup.label}
              </h2>
              <ul className="space-y-2">
                {dayGroup.notifications.map((notification, i) => (
                  <motion.li
                    key={notification.id}
                    variants={staggerItemVariants}
                    initial="hidden"
                    animate="show"
                    transition={
                      reduced
                        ? undefined
                        : {
                            ...staggerItemVariants.show.transition,
                            delay: i * 0.02,
                          }
                    }
                  >
                    <Button
                      variant="outline"
                      onClick={() => handleSelect(notification)}
                      className={cn(
                        "h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-xl px-4 py-3 text-left font-normal",
                        !notification.read && "border-primary/30 bg-primary/5"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-2 h-2 w-2 shrink-0 rounded-full",
                          notification.read ? "bg-transparent" : "bg-primary"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="flex flex-wrap items-center gap-2">
                            <NotificationTypeBadge type={notification.type} />
                            <span
                              className={cn(
                                "font-medium",
                                !notification.read && "text-foreground"
                              )}
                            >
                              {notification.title}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {relativeTime(notification.createdAt)}
                          </span>
                        </span>
                        {notification.body && (
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {notification.body}
                          </span>
                        )}
                      </span>
                    </Button>
                  </motion.li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
