"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useInventoryItems } from "@/hooks/useInventory";
import { getAreaLabel } from "@/lib/areas";
import type { SupplyDraft, SupplyDrafts } from "@/lib/areaSupply";
import { formatSupplyQuantity } from "@/lib/areaSupply";
import type { InventoryItem } from "@/types";

interface AreaSuppliesFormProps {
  areas: string[];
  value: SupplyDrafts;
  onChange: (next: SupplyDrafts) => void;
}

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

/**
 * Hoja de materiales: una sección por área de producción. Por área se elige
 * el ORIGEN del insumo: lo trae el cliente (descripción + cantidad) o lo
 * ponemos nosotros (artículos de inventario + cantidad, o texto libre).
 */
export function AreaSuppliesForm({ areas, value, onChange }: AreaSuppliesFormProps) {
  const setDraft = (area: string, draft: SupplyDraft) => onChange({ ...value, [area]: draft });

  return (
    <div className="space-y-4" role="group" aria-label="Hoja de materiales">
      {areas.map((area) => (
        <AreaSection key={area} area={area} draft={value[area] ?? { source: null, lines: [] }} onChange={(d) => setDraft(area, d)} />
      ))}
    </div>
  );
}

function AreaSection({ area, draft, onChange }: { area: string; draft: SupplyDraft; onChange: (d: SupplyDraft) => void }) {
  const label = getAreaLabel(area);
  const labelId = `supply-${area}-label`;

  const setSource = (source: string) => {
    if (source !== "cliente" && source !== "nosotros") return;
    if (source === draft.source) return;
    // Al cambiar de origen se limpian las líneas: no se mezclan inventario y cliente.
    onChange({
      source,
      lines: source === "cliente" ? [{ key: newKey(), description: "", quantity: "" }] : [],
    });
  };
  const updateLine = (key: string, patch: Partial<SupplyDraft["lines"][number]>) =>
    onChange({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const removeLine = (key: string) => onChange({ ...draft, lines: draft.lines.filter((l) => l.key !== key) });

  return (
    <section className="space-y-3 rounded-xl border border-border/60 p-3" aria-labelledby={labelId}>
      <h3 id={labelId} className="text-sm font-semibold">
        {label}
      </h3>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground" id={`${labelId}-origen`}>
          Origen del insumo
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={draft.source ?? ""}
          onValueChange={setSource}
          aria-labelledby={`${labelId}-origen`}
          className="flex-wrap justify-start"
        >
          <ToggleGroupItem value="cliente" className="rounded-full px-3" aria-label={`${label}: lo trae el cliente`}>
            Lo trae el cliente
          </ToggleGroupItem>
          <ToggleGroupItem value="nosotros" className="rounded-full px-3" aria-label={`${label}: lo ponemos nosotros`}>
            Lo ponemos nosotros
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {draft.source === "cliente" && (
        <div className="space-y-2">
          {draft.lines.map((line) => (
            <div key={line.key} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  value={line.description}
                  onChange={(e) => updateLine(line.key, { description: e.target.value })}
                  placeholder="Ej. playeras negras del cliente"
                  aria-label={`${label}: descripción del insumo del cliente`}
                  maxLength={300}
                />
              </div>
              <Input
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                inputMode="decimal"
                placeholder="Cant."
                aria-label={`${label}: cantidad del insumo del cliente`}
                className="w-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(line.key)}
                aria-label={`${label}: quitar insumo del cliente`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {draft.lines.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onChange({ ...draft, lines: [{ key: newKey(), description: "", quantity: "" }] })}
            >
              <Plus className="h-4 w-4" />
              Agregar detalle
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Opcional. No descuenta inventario.</p>
        </div>
      )}

      {draft.source === "nosotros" && (
        <div className="space-y-2">
          {draft.lines.map((line) => (
            <div key={line.key} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm" title={line.description}>
                {line.description}
                {line.inventoryItemId === undefined && <span className="text-xs text-muted-foreground"> · fuera de inventario</span>}
              </span>
              <Input
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                inputMode="decimal"
                placeholder="Cant."
                aria-label={`${label}: cantidad de ${line.description}`}
                className="w-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLine(line.key)}
                aria-label={`Quitar ${line.description}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <InventoryPicker
            area={area}
            label={label}
            onPick={(item) =>
              onChange({
                ...draft,
                lines: [
                  ...draft.lines,
                  { key: newKey(), inventoryItemId: item.id, description: item.name, quantity: "1" },
                ],
              })
            }
            onFreeText={(text) =>
              onChange({ ...draft, lines: [...draft.lines, { key: newKey(), description: text, quantity: "1" }] })
            }
          />
        </div>
      )}
    </section>
  );
}

/** Búsqueda por nombre, SKU o código de barras; si no está, se agrega como texto libre. */
function InventoryPicker({
  area,
  label,
  onPick,
  onFreeText,
}: {
  area: string;
  label: string;
  onPick: (item: InventoryItem) => void;
  onFreeText: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const { data: items = [], isLoading } = useInventoryItems();
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return [];
    return items
      .filter((i) => [i.name, i.sku, i.barcode].some((f) => f?.toLowerCase().includes(q)))
      // Primero el inventario del propio departamento.
      .sort((a, b) => Number(b.area === area) - Number(a.area === area))
      .slice(0, 6);
  }, [items, q, area]);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en inventario por nombre o código"
          aria-label={`${label}: buscar insumo en inventario`}
          className="pl-8"
        />
      </div>
      {q && (
        <ul className="space-y-1" aria-label={`Resultados para ${label}`}>
          {isLoading && <li className="text-xs text-muted-foreground">Buscando…</li>}
          {matches.map((item) => {
            const available = item.available ?? item.quantity;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(item);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatSupplyQuantity(available)} {item.unit} disp.
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onFreeText(query.trim());
                setQuery("");
              }}
            >
              <Plus className="h-4 w-4" />
              Agregar “{query.trim()}” sin inventario
            </Button>
          </li>
        </ul>
      )}
    </div>
  );
}
