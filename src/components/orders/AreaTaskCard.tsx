"use client";

import { motion } from "framer-motion";
import { CalendarClock, CheckCircle2, Circle, Play, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMotionPreset } from "@/lib/motion";
import { getAreaIcon, getAreaLabel } from "@/lib/areas";
import { formatDeliveryDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MyAreaTask } from "@/hooks/useMyAreaTasks";
import type { AreaTaskStatus } from "@/types";

const STATUS_META: Record<
  AreaTaskStatus,
  { label: string; classes: string; icon: typeof Circle }
> = {
  pendiente: {
    label: "Pendiente",
    classes:
      "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    icon: Circle,
  },
  en_proceso: {
    label: "En proceso",
    classes:
      "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    icon: Play,
  },
  terminado: {
    label: "Terminado",
    classes:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    icon: CheckCircle2,
  },
};

function clientName(task: MyAreaTask): string {
  const order = task.order;
  if (!order) return "";
  if (order.client) {
    return [order.client.first_name, order.client.last_name].filter(Boolean).join(" ");
  }
  return order.clientNameOverride ?? "";
}

interface AreaTaskCardProps {
  task: MyAreaTask;
  /**
   * En la vista unificada cada tarjeta dice de qué área es; agrupadas por área
   * la etiqueta sobra.
   */
  showAreaLabel?: boolean;
  onOpenOrder: (orderId: number) => void;
}

/** Una tarea de producción en la bandeja "Mi trabajo". */
export function AreaTaskCard({
  task,
  showAreaLabel = true,
  onOpenOrder,
}: AreaTaskCardProps) {
  const { staggerItemVariants, cardHoverMotion, cardTapMotion } = useMotionPreset();
  const meta = STATUS_META[task.status];
  const StatusIcon = meta.icon;
  const AreaIcon = getAreaIcon(task.area);
  const orderId = task.order?.id ?? task.orderId;

  return (
    <motion.div variants={staggerItemVariants}>
      <motion.div
        whileHover={{ ...cardHoverMotion.whileHover, transition: cardHoverMotion.transition }}
        whileTap={{ ...cardTapMotion.whileTap, transition: cardTapMotion.transition }}
      >
        <Card
          role="button"
          tabIndex={0}
          onClick={() => onOpenOrder(orderId)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onOpenOrder(orderId);
          }}
          className="cursor-pointer shadow-soft transition-shadow duration-200 hover:shadow-soft-md"
        >
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">#{orderId}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  meta.classes
                )}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {meta.label.toUpperCase()}
              </span>
            </div>

            {showAreaLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {AreaIcon && <AreaIcon className="h-3 w-3" aria-hidden />}
                {getAreaLabel(task.area)}
              </span>
            )}

            {clientName(task) && (
              <p className="truncate text-sm font-medium">{clientName(task)}</p>
            )}
            {task.order?.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {task.order.description}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {formatDeliveryDate(task.order?.deliveryDate)}
              </span>
              {task.assignedUser && (
                <span className="flex min-w-0 items-center gap-1" title="Responsable">
                  <UserRound className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {task.assignedUser.isSharedAccount
                      ? getAreaLabel(task.area)
                      : [task.assignedUser.firstName, task.assignedUser.lastName]
                          .filter(Boolean)
                          .join(" ") || task.assignedUser.username}
                  </span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
