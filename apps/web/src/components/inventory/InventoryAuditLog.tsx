"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ErrorState, TableSkeleton } from "@/components/feedback/states";
import { EmptyState } from "@/components/ui/empty-state";
import { useInventoryMovements } from "@/hooks/useInventory";
import { INVENTORY_AREA_OPTIONS } from "@/lib/inventory";
import type { InventoryArea, InventoryMovementType } from "@/types";
import { InventoryMovementsList } from "./InventoryMovementsList";

const SELECT = "h-10 rounded-full border border-border/60 bg-background px-4 text-sm shadow-soft";

/**
 * Bitácora global (Recepción/admin): cada entrada, consumo o ajuste con
 * quién, antes → después, motivo, fecha y hora; filtrable por área, usuario,
 * tipo y fechas.
 */
export function InventoryAuditLog({ areas }: { areas: InventoryArea[] }) {
  const [area, setArea] = useState<InventoryArea | "">("");
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<InventoryMovementType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filter = {
    area: area || undefined,
    userId: userId ? Number(userId) : undefined,
    type: type || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: 200,
  };
  const { data = [], isPending, isError, refetch } = useInventoryMovements(filter);

  // Los usuarios disponibles se arman con lo que ya trae la bitácora.
  const [seen, setSeen] = useState<Map<number, string>>(() => new Map());
  useEffect(() => {
    setSeen((prev) => {
      const next = new Map(prev);
      for (const m of data) {
        if (m.createdBy) {
          next.set(m.createdBy.id, [m.createdBy.firstName, m.createdBy.lastName].filter(Boolean).join(" "));
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [data]);
  const users = [...seen.entries()];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Departamento" className={SELECT} value={area} onChange={(e) => setArea(e.target.value as InventoryArea | "")}>
          <option value="">Todos los departamentos</option>
          {INVENTORY_AREA_OPTIONS.filter((o) => areas.includes(o.value)).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Usuario" className={SELECT} value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {users.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Tipo" className={SELECT} value={type} onChange={(e) => setType(e.target.value as InventoryMovementType | "")}>
          <option value="">Todos los tipos</option>
          <option value="ENTRADA">Entradas</option>
          <option value="SALIDA">Salidas / consumo</option>
          <option value="AJUSTE">Ajustes</option>
        </select>
        <Input type="date" aria-label="Desde" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-auto rounded-full" />
        <Input type="date" aria-label="Hasta" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-auto rounded-full" />
      </div>
      {isPending ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin movimientos"
          description="Cada entrada, consumo o ajuste queda registrado aquí con quién lo hizo y cuándo."
        />
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card px-4 shadow-soft sm:px-5">
          <InventoryMovementsList movements={data} showItem />
        </div>
      )}
    </div>
  );
}
