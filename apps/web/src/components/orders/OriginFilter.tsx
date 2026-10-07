"use client";

import { Store } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { parseOrigin, type OrderOrigin } from "@/lib/orderOrigin";
import { cn } from "@/lib/utils";

const ALL = "all";

/**
 * Filtro "Origen": Todos / Matriz / Todas las sucursales / cada sucursal.
 * Sólo para roles de matriz: la cuenta de sucursal ya ve únicamente lo suyo,
 * así que ahí no se dibuja (ni se piden las sucursales).
 */
export function OriginFilter({
  value,
  onChange,
  className,
}: {
  value: OrderOrigin | undefined;
  onChange: (origin: OrderOrigin | undefined) => void;
  className?: string;
}) {
  const { isBranch, isSessionLoading } = usePermissions();
  const visible = !isBranch && !isSessionLoading;
  const { data: branches } = useBranches(visible);
  if (!visible) return null;

  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : parseOrigin(v))}>
      <SelectTrigger
        aria-label="Origen"
        className={cn("h-10 w-auto min-w-[10.5rem] gap-2 rounded-full px-4", value && "border-foreground/25", className)}
      >
        <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">Origen:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todos</SelectItem>
        <SelectItem value="matriz">Matriz</SelectItem>
        <SelectItem value="sucursal">Todas las sucursales</SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={String(b.id)}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
