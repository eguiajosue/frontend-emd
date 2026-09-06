"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications, useUnreadNotificationsCount } from "@/hooks/useNotifications";
import { useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";
import { NotificationTypeBadge } from "@/components/notifications/NotificationTypeBadge";

/** Cuántas notificaciones se muestran en el dropdown de la campanita. */
const PREVIEW_LIMIT = 8;

function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

/**
 * Campanita de notificaciones (header del dashboard).
 *
 * Muestra el conteo de no leídas (poll cada 30s + invalidación en vivo desde
 * `useSocket` cuando llega un evento de pedido) y, al hacer click, un preview
 * de las últimas notificaciones con acceso a la página completa.
 */
export function NotificationBell() {
  const router = useRouter();
  const { reduced } = useMotionPreset();
  const { count } = useUnreadNotificationsCount();
  const { notifications, markAsRead, markAllAsRead, isMarkingAll } =
    useNotifications(1, PREVIEW_LIMIT);
  const [open, setOpen] = useState(false);
  const [justBumped, setJustBumped] = useState(false);
  const prevCount = useRef(count);

  // Animación de "llegada" sutil (pop) cada vez que el conteo sube, en vez de
  // que el badge simplemente cambie de número sin feedback.
  useEffect(() => {
    if (count > prevCount.current) {
      setJustBumped(true);
      const t = setTimeout(() => setJustBumped(false), 420);
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  const handleSelect = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id);
    setOpen(false);
    if (notification.orderId) {
      router.push(`/dashboard/orders/${notification.orderId}`);
    }
  };

  const preview = notifications.slice(0, PREVIEW_LIMIT);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label={count > 0 ? `Notificaciones (${count} sin leer)` : "Notificaciones"}
        >
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {count > 0 && (
              <motion.span
                key="badge"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                animate={{
                  opacity: 1,
                  scale: justBumped && !reduced ? [1, 1.35, 1] : 1,
                }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                transition={
                  reduced
                    ? { duration: 0.15 }
                    : { type: "spring", bounce: 0.5, duration: 0.35 }
                }
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
              >
                {count > 99 ? "99+" : count}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Notificaciones</p>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 px-2 py-1 text-xs"
              disabled={isMarkingAll}
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {preview.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Todo tranquilo por acá. Sin notificaciones nuevas.
            </p>
          ) : (
            <ul>
              {preview.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(notification)}
                    className={cn(
                      "flex w-full items-start gap-2 border-b px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/60",
                      !notification.read && "bg-primary/5"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        notification.read ? "bg-transparent" : "bg-primary"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 flex">
                        <NotificationTypeBadge type={notification.type} />
                      </span>
                      <span className="block truncate font-medium">
                        {notification.title}
                      </span>
                      {notification.body && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {notification.body}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/notificaciones");
            }}
          >
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
