"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Link2, Loader2, PackagePlus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInventoryItems, useInventoryMutations } from "@/hooks/useInventory";
import { getErrorMessage } from "@/lib/api";
import { isDefaultBarcode, isBarcodeError } from "@/lib/barcode/codes";
import { formatQuantity, inventoryAreaLabel } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { ScanMovementType } from "@/lib/barcode/scanSession";
import type { InventoryItem } from "@/types";

const MAX_RESULTS = 8;

export interface PendingScan {
  code: string;
  type: ScanMovementType;
  quantity: number;
}

interface UnknownBarcodeDialogProps {
  scan: PendingScan | null;
  onClose: () => void;
  /** El código ya quedó ligado a `item`: registrar el movimiento pendiente. */
  onLinked: (item: InventoryItem, scan: PendingScan) => void;
  /** Abrir el alta de artículo con el código ya cargado. */
  onCreate: (code: string) => void;
}

function matches(item: InventoryItem, q: string): boolean {
  return [item.name, item.sku, item.barcode, item.category, item.color, item.brand]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q));
}

/**
 * Se escaneó un código que no tiene ningún artículo: se liga a uno existente
 * (típico: el EAN de fábrica de un producto que ya está en el inventario) o
 * se da de alta un artículo nuevo con ese código.
 */
export function UnknownBarcodeDialog({ scan, onClose, onLinked, onCreate }: UnknownBarcodeDialogProps) {
  const open = scan !== null;
  const { data: items = [] } = useInventoryItems();
  const { update } = useInventoryMutations();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(null);
    setError(null);
  }, [open, scan?.code]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? items.filter((i) => matches(i, q)) : items;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "es")).slice(0, MAX_RESULTS);
  }, [items, query]);

  if (!scan) return null;

  const verb = scan.type === "ENTRADA" ? "entrada" : "salida";
  const replacing = selected && !isDefaultBarcode(selected.barcode, selected.id) ? selected.barcode : null;

  const handleLink = async () => {
    if (!selected) return;
    setError(null);
    try {
      const item = await update.mutateAsync({ id: selected.id, payload: { barcode: scan.code } });
      onLinked(item ?? { ...selected, barcode: scan.code }, scan);
    } catch (err) {
      setError(isBarcodeError(err) ? err.message : getErrorMessage(err, "No se pudo ligar el código."));
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !update.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Código sin artículo</DialogTitle>
          <DialogDescription>
            Ningún artículo tiene el código{" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{scan.code}</span>. Lígalo a
            uno existente o crea uno nuevo.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 pt-1" aria-labelledby="link-heading">
          <h3 id="link-heading" className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden /> Ligar a un artículo
          </h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              placeholder="Buscar por nombre, SKU, color…"
              aria-label="Buscar artículo para ligar"
              className="pl-9"
              autoFocus
            />
          </div>
          <ul className="max-h-60 space-y-1 overflow-y-auto" role="listbox" aria-label="Artículos">
            {results.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nada coincide con la búsqueda.</li>
            )}
            {results.map((item) => {
              const isSelected = selected?.id === item.id;
              return (
                <li key={item.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(item);
                      setError(null);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted",
                      isSelected && "bg-muted ring-2 ring-ink/70"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block truncate text-meta">
                        {inventoryAreaLabel(item.area)} · {formatQuantity(item.quantity, item.unit)}
                        {item.barcode && ` · ${item.barcode}`}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          {replacing && (
            <p className="text-meta">
              {selected!.name} ya tiene el código <span className="font-mono">{replacing}</span>; se reemplaza por{" "}
              <span className="font-mono">{scan.code}</span>.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" onClick={handleLink} disabled={!selected || update.isPending}>
            {update.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
            {selected ? `Ligar y registrar ${verb} de ${scan.quantity}` : "Elige un artículo"}
          </Button>
        </section>

        <div className="relative py-1 text-center text-meta">
          <span className="relative z-10 bg-popover px-3">o</span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
        </div>

        <Button variant="secondary" className="w-full" onClick={() => onCreate(scan.code)}>
          <PackagePlus /> Crear artículo nuevo con este código
        </Button>
      </DialogContent>
    </Dialog>
  );
}
