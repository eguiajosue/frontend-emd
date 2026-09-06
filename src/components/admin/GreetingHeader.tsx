"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface GreetingHeaderProps {
  firstName?: string | null;
}

/** Encabezado con saludo + reloj/fecha en vivo (se actualiza cada minuto). */
export function GreetingHeader({ firstName }: GreetingHeaderProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const timeLabel = now
    ? now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const dateLabel = now
    ? now.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
    : "";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Hola{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Vista global de todos los pedidos, detección de estancamiento y rendimiento por área.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start sm:items-end">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">{timeLabel}</span>
          <span className="text-xs capitalize text-muted-foreground">{dateLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
