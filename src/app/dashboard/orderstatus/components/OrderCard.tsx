import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDateTime, getClientName, getUserName } from "@/lib/format";
import type { Order } from "@/types";

const CARD_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
};

/** Porcentaje de tiempo transcurrido entre creación y entrega (verde -> rojo). */
function calculateProgress(
  creationDate: string,
  deliveryDate?: string | null
): { progress: number; color: string } {
  if (!deliveryDate) return { progress: 0, color: "hsl(120, 100%, 50%)" };
  const now = Date.now();
  const create = new Date(creationDate).getTime();
  const deliver = new Date(deliveryDate).getTime();
  const total = deliver - create;
  if (!Number.isFinite(total) || total <= 0) {
    return { progress: 100, color: "hsl(0, 100%, 50%)" };
  }
  const progress = Math.min(Math.max(((now - create) / total) * 100, 0), 100);
  const hue = ((1 - progress / 100) * 120).toString(10);
  return { progress, color: `hsl(${hue}, 100%, 50%)` };
}

const OrderCard = ({ order }: { order: Order }) => {
  const { progress, color } = calculateProgress(
    order.creationDate,
    order.deliveryDate
  );

  return (
    <Card
      className="mb-4 shadow-sm rounded-xl border transition-transform duration-300 hover:scale-105"
      role="article"
    >
      <CardHeader>
        <CardTitle
          className="text-md font-bold text-pink-600"
          aria-label="Nombre del Cliente"
        >
          {getClientName(order.client)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-1" aria-label="Creado por">
          <b>Creado por: </b>
          {getUserName(order.user)}
        </p>
        <p className="text-sm mb-2 truncate">{order.description}</p>
        <div className="flex justify-between text-xs text-muted-foreground mb-2 flex-col md:flex-row">
          <span aria-label="Fecha de Creación">
            <b>Creación:</b>{" "}
            {formatDateTime(order.creationDate, CARD_DATE_FORMAT)}
          </span>
          <span aria-label="Fecha de Entrega">
            <b>Entrega:</b> {formatDateTime(order.deliveryDate, CARD_DATE_FORMAT)}
          </span>
        </div>
        <Progress value={progress} color={color} />
      </CardContent>
    </Card>
  );
};

export default OrderCard;
