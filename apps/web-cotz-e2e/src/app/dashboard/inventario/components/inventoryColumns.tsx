"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  History,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Scale,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { itemBarcode } from "@/lib/barcode/codes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrencyMXN } from "@/lib/format";
import {
  STOCK_STATUS_META,
  formatQuantity,
  inventoryAreaIcon,
  inventoryAreaLabel,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { InventoryItem, InventoryMovementType } from "@/types";

export interface InventoryColumnsArgs {
  /** Muestra la columna Departamento (vista "Todos"). */
  showArea: boolean;
  /** Admin/superuser/recepción: crear, editar, borrar y mover stock. Las áreas sólo consultan. */
  canManage: boolean;
  onMove: (item: InventoryItem, type: InventoryMovementType) => void;
  onHistory: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onPrintLabel: (item: InventoryItem) => void;
  /** Selección para imprimir etiquetas en lote. */
  selection: {
    isSelected: (id: number) => boolean;
    toggle: (item: InventoryItem) => void;
    /** "all" | "some" | "none" de las filas visibles. */
    state: "all" | "some" | "none";
    toggleAll: () => void;
  };
}

const ROW_ACTION = "h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";

/** Barra fina de existencia contra el mínimo (el doble del mínimo = barra llena). */
function StockBar({ item }: { item: InventoryItem }) {
  if (item.minStock == null || item.minStock <= 0) return null;
  const pct = Math.min(100, (item.quantity / (item.minStock * 2)) * 100);
  return (
    <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className={cn(
          "h-full rounded-full",
          item.stockStatus === "ok" && "bg-emerald-500/70",
          item.stockStatus === "low" && "bg-amber-500/80",
          item.stockStatus === "out" && "bg-rose-500/80"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function getInventoryColumns({
  showArea,
  canManage,
  onMove,
  onHistory,
  onEdit,
  onDelete,
  onPrintLabel,
  selection,
}: InventoryColumnsArgs): ColumnDef<InventoryItem>[] {
  const columns: ColumnDef<InventoryItem>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={selection.state === "all" ? true : selection.state === "some" ? "indeterminate" : false}
          onCheckedChange={selection.toggleAll}
          aria-label="Seleccionar todos para imprimir etiquetas"
          className="translate-y-[1px]"
        />
      ),
      cell: ({ row }) => (
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={selection.isSelected(row.original.id)}
            onCheckedChange={() => selection.toggle(row.original)}
            aria-label={`Seleccionar ${row.original.name}`}
            className="translate-y-[1px]"
          />
          {/* En móvil cada fila es una tarjeta: el checkbox solo no se entiende. */}
          <span className="text-meta md:hidden" aria-hidden>
            Seleccionar para etiqueta
          </span>
        </label>
      ),
    },
    {
      id: "name",
      header: "Artículo",
      cell: ({ row }) => {
        const item = row.original;
        const details = [item.sku, item.color, item.brand].filter(Boolean).join(" · ");
        return (
          <div className="min-w-[12rem]">
            <p className="font-medium leading-snug">{item.name}</p>
            <p className="mt-0.5 font-mono text-[11px] tracking-wide text-muted-foreground">{itemBarcode(item)}</p>
            {(details || item.material) && (
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-meta">
                {details}
                {item.material && (
                  <SimpleTooltip label={`Vinculado al material "${item.material.name}" del catálogo`}>
                    <Badge variant="muted" className="px-2 py-0 text-[11px]">
                      En catálogo
                    </Badge>
                  </SimpleTooltip>
                )}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  if (showArea) {
    columns.push({
      id: "area",
      header: "Departamento",
      cell: ({ row }) => {
        const Icon = inventoryAreaIcon(row.original.area);
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {inventoryAreaLabel(row.original.area)}
          </span>
        );
      },
    });
  }

  columns.push(
    {
      id: "category",
      header: "Categoría",
      cell: ({ row }) => row.original.category ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "quantity",
      header: "Existencia",
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <span className="font-semibold">{formatQuantity(row.original.quantity, row.original.unit)}</span>
          {row.original.minStock != null && (
            <span className="text-meta"> · mín. {formatQuantity(row.original.minStock)}</span>
          )}
          <StockBar item={row.original} />
        </div>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row }) => {
        const meta = STOCK_STATUS_META[row.original.stockStatus];
        return <Badge className={meta.className}>{meta.label}</Badge>;
      },
    },
    {
      id: "value",
      header: "Valor",
      cell: ({ row }) =>
        row.original.totalValue != null ? (
          <SimpleTooltip label={`${formatCurrencyMXN(row.original.unitCost)} c/u`}>
            <span className="whitespace-nowrap">{formatCurrencyMXN(row.original.totalValue)}</span>
          </SimpleTooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "location",
      header: "Ubicación",
      cell: ({ row }) => row.original.location ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const item = row.original;
        if (!canManage) {
          return (
            <div className="flex items-center justify-end gap-1">
              <SimpleTooltip label="Imprimir etiqueta">
                <Button
                  size="icon"
                  variant="ghost"
                  className={ROW_ACTION}
                  aria-label={`Imprimir etiqueta de ${item.name}`}
                  onClick={() => onPrintLabel(item)}
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip label="Ver movimientos">
                <Button
                  size="icon"
                  variant="ghost"
                  className={ROW_ACTION}
                  aria-label={`Ver movimientos de ${item.name}`}
                  onClick={() => onHistory(item)}
                >
                  <History className="h-4 w-4" />
                </Button>
              </SimpleTooltip>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-end gap-1">
            <SimpleTooltip label="Registrar entrada">
              <Button
                size="icon"
                variant="ghost"
                className={ROW_ACTION}
                aria-label={`Registrar entrada de ${item.name}`}
                onClick={() => onMove(item, "ENTRADA")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip label="Registrar salida">
              <Button
                size="icon"
                variant="ghost"
                className={ROW_ACTION}
                aria-label={`Registrar salida de ${item.name}`}
                onClick={() => onMove(item, "SALIDA")}
                disabled={item.quantity <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className={ROW_ACTION} aria-label={`Más acciones de ${item.name}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onMove(item, "AJUSTE")}>
                  <Scale className="h-4 w-4" /> Ajustar por conteo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onHistory(item)}>
                  <History className="h-4 w-4" /> Ver movimientos
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onPrintLabel(item)}>
                  <Printer className="h-4 w-4" /> Imprimir etiqueta
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(item)}>
                  <Pencil className="h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onDelete(item)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    }
  );

  return columns;
}
