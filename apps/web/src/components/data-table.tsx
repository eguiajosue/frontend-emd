"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Opcional: hace la fila clickeable (ej. abrir un detalle rápido). */
  onRowClick?: (row: TData) => void;
  /**
   * Virtualiza el body con @tanstack/react-virtual: sólo se montan las filas
   * visibles + overscan, así listas de cientos/miles de filas siguen
   * renderizando fluido. Pensado para tablas grandes (ej. Pedidos); el resto
   * de las tablas (más chicas) puede dejarlo apagado (default) sin cambios.
   */
  virtualize?: boolean;
  /** Alto estimado de cada fila en px, usado por el virtualizador (default 44). */
  estimateRowHeight?: number;
  /** Alto máximo del viewport con scroll cuando `virtualize` está activo. */
  maxHeight?: number;
}

const MOBILE_PAGE_SIZE = 30;

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  virtualize = false,
  estimateRowHeight = 44,
  maxHeight = 560,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_PAGE_SIZE);
  useEffect(() => {
    // Sólo achica el conteo visible si la data efectivamente se redujo (ej.
    // un filtro sacó filas). Un refetch en tiempo real (useSocket invalida
    // queries en cada evento de pedido) crea una nueva referencia de `data`
    // con el mismo largo o más filas: no debe resetear "Cargar más" en medio
    // del uso normal en mobile.
    setMobileVisibleCount((count) => Math.min(count, Math.max(data.length, MOBILE_PAGE_SIZE)));
  }, [data.length]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 10,
    enabled: virtualize,
  });

  if (!virtualize) {
    return (
      <>
        {/* Escritorio/tablet: tabla con scroll horizontal si hace falta. */}
        <div className="hidden w-full overflow-x-auto rounded-xl border shadow-soft md:block">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-11 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:rounded-tl-xl last:rounded-tr-xl"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(
                      "transition-colors",
                      onRowClick && "cursor-pointer hover:bg-primary/[0.04]"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No hay resultados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Móvil: cada fila como tarjeta, sin scroll horizontal forzado. */}
        <div className="flex flex-col gap-2.5 md:hidden" data-testid="mobile-card-list">
          {rows.length ? (
            rows.map((row) => (
              <div
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "rounded-xl border bg-card p-3.5 shadow-soft transition-colors",
                  onRowClick && "cursor-pointer active:bg-primary/[0.04]"
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const rawHeader = cell.column.columnDef.header;
                  const isLabeled = typeof rawHeader === "string";
                  const headerLabel = isLabeled ? rawHeader : null;
                  return (
                    <div
                      key={cell.id}
                      className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0 last:pb-0 first:pt-0"
                    >
                      {isLabeled && (
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {headerLabel}
                        </span>
                      )}
                      <div className={cn("min-w-0 text-sm", isLabeled ? "text-right" : "w-full")}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
              No hay resultados.
            </div>
          )}
        </div>
      </>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  return (
    <>
      {/* Escritorio/tablet: misma tabla virtualizada de siempre. */}
      <div
        ref={scrollRef}
        className="hidden w-full overflow-auto rounded-xl border shadow-soft md:block"
        style={{ maxHeight }}
      >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-11 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No hay resultados.
              </TableCell>
            </TableRow>
          ) : (
            <>
              {paddingTop > 0 ? (
                <TableRow style={{ height: paddingTop }} aria-hidden="true">
                  <TableCell colSpan={columns.length} className="p-0" />
                </TableRow>
              ) : null}
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <TableRow
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(
                      "transition-colors",
                      onRowClick && "cursor-pointer hover:bg-primary/[0.04]"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {paddingBottom > 0 ? (
                <TableRow style={{ height: paddingBottom }} aria-hidden="true">
                  <TableCell colSpan={columns.length} className="p-0" />
                </TableRow>
              ) : null}
            </>
          )}
        </TableBody>
      </Table>
      </div>

      {/* Móvil: misma lista en tarjetas que la versión no virtualizada, sin
          scroll horizontal. Listas grandes en este modo no se virtualizan en
          móvil (menos filas visibles a la vez que en desktop hace el trade-off
          aceptable); si hiciera falta, se puede virtualizar esta lista aparte. */}
      <div className="flex flex-col gap-2.5 md:hidden" data-testid="mobile-card-list">
        {rows.length ? (
          <>
            {rows.slice(0, mobileVisibleCount).map((row) => (
              <div
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "rounded-xl border bg-card p-3.5 shadow-soft transition-colors",
                  onRowClick && "cursor-pointer active:bg-primary/[0.04]"
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const rawHeader = cell.column.columnDef.header;
                  const isLabeled = typeof rawHeader === "string";
                  const headerLabel = isLabeled ? rawHeader : null;
                  return (
                    <div
                      key={cell.id}
                      className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0 last:pb-0 first:pt-0"
                    >
                      {isLabeled && (
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {headerLabel}
                        </span>
                      )}
                      <div className={cn("min-w-0 text-sm", isLabeled ? "text-right" : "w-full")}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {rows.length > mobileVisibleCount && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setMobileVisibleCount((c) => c + MOBILE_PAGE_SIZE)}
              >
                Cargar más ({rows.length - mobileVisibleCount} restantes)
              </Button>
            )}
          </>
        ) : (
          <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
            No hay resultados.
          </div>
        )}
      </div>
    </>
  );
}
