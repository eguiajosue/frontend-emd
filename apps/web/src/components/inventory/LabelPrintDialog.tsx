"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Minus, Plus, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { itemBarcode } from "@/lib/barcode/codes";
import { loadCode128 } from "@/lib/barcode/code128";
import {
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  computeLabelLayout,
  fitBarcodeModules,
  mmToPx,
} from "@/lib/barcode/label";
import {
  MAX_COPIES,
  buildLabelPrintDocument,
  clampCopies,
  renderLabelHtml,
} from "@/lib/barcode/labelMarkup";
import { printHtmlDocument } from "@/lib/barcode/printFrame";
import { inventoryAreaLabel } from "@/lib/inventory";
import type { InventoryItem } from "@/types";

const LABEL_PX = mmToPx(LABEL_WIDTH_MM);
const LABEL_PX_H = mmToPx(LABEL_HEIGHT_MM);

interface PreparedLabel {
  item: InventoryItem;
  code: string;
  html: string;
  readable: boolean;
}

/** Etiqueta a escala, dibujada con el mismo HTML que va a la impresora. */
function LabelPreview({ html, maxScale, label }: { html: string; maxScale: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(maxScale);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(Math.min(maxScale, width / LABEL_PX));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxScale]);

  return (
    <div ref={ref} className="w-full min-w-0">
      <div
        role="img"
        aria-label={label}
        data-testid="label-preview"
        className="mx-auto overflow-hidden rounded-[6px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12),0_6px_20px_-6px_rgba(0,0,0,0.25)] ring-1 ring-black/10"
        style={{ width: LABEL_PX * scale, height: LABEL_PX_H * scale }}
      >
        <div
          style={{ width: LABEL_PX, height: LABEL_PX_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

interface LabelPrintDialogProps {
  /** Artículos a imprimir; `null` = cerrado. */
  items: InventoryItem[] | null;
  onClose: () => void;
}

/**
 * Vista previa e impresión de etiquetas 80 × 35 mm: una o varias (lote),
 * N copias de cada una. Imprime desde un iframe oculto con `@page` del
 * tamaño exacto de la etiqueta.
 */
export function LabelPrintDialog({ items, onClose }: LabelPrintDialogProps) {
  const open = items !== null && items.length > 0;
  const [copies, setCopies] = useState("1");
  const [encoder, setEncoder] = useState<Awaited<ReturnType<typeof loadCode128>> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopies("1");
    let alive = true;
    loadCode128().then(
      (enc) => alive && setEncoder(() => enc),
      () => alive && setLoadError(true)
    );
    return () => {
      alive = false;
    };
  }, [open]);

  const layout = useMemo(() => computeLabelLayout(), []);

  const labels = useMemo<PreparedLabel[]>(() => {
    if (!encoder || !items) return [];
    return items.flatMap((item) => {
      const code = itemBarcode(item);
      try {
        const { bits, modules } = encoder(code);
        return [
          {
            item,
            code,
            html: renderLabelHtml({ name: item.name, areaLabel: inventoryAreaLabel(item.area), code, bits }, layout),
            readable: fitBarcodeModules(modules, layout.barcode.width).readable,
          },
        ];
      } catch {
        return [];
      }
    });
  }, [encoder, items, layout]);

  const copiesN = clampCopies(Number(copies));
  const sheets = labels.length * copiesN;
  const unreadable = labels.filter((l) => !l.readable);
  const isBatch = (items?.length ?? 0) > 1;

  const handlePrint = async () => {
    if (labels.length === 0) return;
    setPrinting(true);
    try {
      const html = buildLabelPrintDocument(
        labels.map((l) => l.html),
        { copies: copiesN, title: isBatch ? `Etiquetas (${labels.length})` : `Etiqueta ${labels[0].code}` }
      );
      await printHtmlDocument(html);
    } catch {
      toast.error("No se pudo abrir la impresión. Vuelve a intentar.");
    } finally {
      setPrinting(false);
    }
  };

  const stepCopies = (delta: number) => setCopies(String(clampCopies(copiesN + delta)));

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isBatch ? `Imprimir ${items!.length} etiquetas` : "Imprimir etiqueta"}</DialogTitle>
          <DialogDescription>
            Etiqueta de 80 × 35 mm para impresora térmica, una por hoja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="rounded-2xl bg-muted/60 p-4 sm:p-6">
            {loadError ? (
              <p className="text-center text-sm text-muted-foreground">
                No se pudo preparar la vista previa. Revisa tu conexión y vuelve a abrir.
              </p>
            ) : labels.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-label="Preparando etiquetas" />
              </div>
            ) : isBatch ? (
              <ul className="grid max-h-[46vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2" aria-label="Etiquetas a imprimir">
                {labels.map((l) => (
                  <li key={l.item.id} className="min-w-0">
                    <LabelPreview html={l.html} maxScale={1} label={`Etiqueta de ${l.item.name}, código ${l.code}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <LabelPreview
                html={labels[0].html}
                maxScale={1.6}
                label={`Etiqueta de ${labels[0].item.name}, código ${labels[0].code}`}
              />
            )}
          </div>

          {unreadable.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {unreadable.length === 1
                ? `El código ${unreadable[0].code} es muy largo para esta etiqueta: las barras salen muy finas y puede costar leerlo.`
                : `${unreadable.length} códigos son muy largos para esta etiqueta y puede costar leerlos.`}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="label-copies" className="text-sm font-medium">
                Copias {isBatch && <span className="font-normal text-muted-foreground">de cada una</span>}
              </label>
              <div className="flex items-center rounded-full border border-border bg-card p-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => stepCopies(-1)}
                  disabled={copiesN <= 1}
                  aria-label="Una copia menos"
                >
                  <Minus />
                </Button>
                <Input
                  id="label-copies"
                  inputMode="numeric"
                  value={copies}
                  onChange={(e) => setCopies(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  onBlur={() => setCopies(String(copiesN))}
                  className="h-8 w-12 border-0 bg-transparent px-0 text-center tabular-nums shadow-none focus-visible:ring-0"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => stepCopies(1)}
                  disabled={copiesN >= MAX_COPIES}
                  aria-label="Una copia más"
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <p className="text-meta tabular-nums" aria-live="polite">
              {sheets === 1 ? "1 etiqueta" : `${sheets} etiquetas`} en total
            </p>
          </div>

          <p className="text-meta">
            En el diálogo de impresión elige la impresora de etiquetas, tamaño de papel 80 × 35 mm, márgenes
            “Ninguno” y escala 100 %.
          </p>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handlePrint} disabled={labels.length === 0 || printing}>
            {printing ? <Loader2 className="animate-spin" /> : <Printer />}
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
