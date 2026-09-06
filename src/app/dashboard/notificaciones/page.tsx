"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCheck, MailCheck } from "lucide-react";
import { motion } from "framer-motion";
import Title from "@/components/Title";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/feedback/states";
import { ErrorState } from "@/components/feedback/states";
import { useNotifications } from "@/hooks/useNotifications";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";
import { NotificationTypeBadge } from "@/components/notifications/NotificationTypeBadge";

type Filter = "all" | "unread" | "read";

function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

export default function NotificacionesPage() {
  const router = useRouter();
  const { reduced, staggerItemVariants } = useMotionPreset();
  const [filter, setFilter] = useState<Filter>("all");

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
    if (filter === "unread") return notifications.filter((n) => !n.read);
    if (filter === "read") return notifications.filter((n) => n.read);
    return notifications;
  }, [notifications, filter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

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

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="unread">
            No leídas{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="read">Leídas</TabsTrigger>
        </TabsList>
      </Tabs>

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
              : "Acá vas a ver tus notificaciones"
          }
          description={
            isUnavailable
              ? "Esta función se está desplegando del lado del servidor. Volvé a intentar en un rato."
              : filter === "all"
              ? "Cuando recepción te asigne un pedido o algo cambie, te va a avisar acá."
              : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((notification, i) => (
            <motion.li
              key={notification.id}
              variants={staggerItemVariants}
              initial="hidden"
              animate="show"
              transition={
                reduced ? undefined : { ...staggerItemVariants.show.transition, delay: i * 0.02 }
              }
            >
              <button
                type="button"
                onClick={() => handleSelect(notification)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/60",
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
                      <span className={cn("font-medium", !notification.read && "text-foreground")}>
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
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
