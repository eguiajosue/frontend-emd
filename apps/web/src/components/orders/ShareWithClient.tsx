"use client";

import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { BellRing, Check, Copy, Eye, EyeOff, Link2Off, Loader2, MessageCircle, QrCode, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useShareLinkActions, useShareState } from "@/hooks/useClientPortal";
import { portalUrl, readyMessage, shareMessage, whatsappUrl } from "@/lib/clientPortal";
import { isFinishedStatus } from "@/lib/orderStatus";
import { getOrderClientName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

/** "Visto hace 2 horas · 3 veces" o "Todavía no lo abre". */
export function viewedLabel(link: { lastViewedAt: string | null; viewCount: number } | null | undefined): string | null {
  if (!link) return null;
  if (!link.lastViewedAt) return "Todavía no lo abre";
  const ago = formatDistanceToNow(new Date(link.lastViewedAt), { locale: es, addSuffix: true });
  return `Visto ${ago}${link.viewCount > 1 ? ` · ${link.viewCount} veces` : ""}`;
}

/** Estado del aviso automático de "pedido listo" (lo manda el backend). */
export function readyNoticeLabel(
  link: { readyNotifiedAt?: string | null; pushSubscribers?: number } | null | undefined
): string | null {
  if (!link) return null;
  if (link.readyNotifiedAt) {
    return `Aviso de "pedido listo" enviado ${formatDistanceToNow(new Date(link.readyNotifiedAt), { locale: es, addSuffix: true })}`;
  }
  const n = link.pushSubscribers ?? 0;
  if (n === 0) return null;
  return n === 1
    ? 'El cliente pidió aviso: le llegará solo al quedar "Listo para entregar"'
    : `El cliente pidió aviso en ${n} dispositivos: le llegará solo al quedar "Listo para entregar"`;
}

/** Código QR del enlace, dibujado en SVG (sin imágenes ni servicios externos). */
function QrSvg({ value, size = 184 }: { value: string; size?: number }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { path: d, count: n };
  }, [value]);
  const margin = 2;
  return (
    <svg
      role="img"
      aria-label="Código QR del enlace del pedido"
      width={size}
      height={size}
      viewBox={`${-margin} ${-margin} ${count + margin * 2} ${count + margin * 2}`}
      className="rounded-xl bg-white"
      shapeRendering="crispEdges"
    >
      <path d={path} fill="#111827" />
    </svg>
  );
}

/**
 * Compartir el pedido con el cliente: enlace privado a su portal (estado,
 * productos y diseño para aprobar), por WhatsApp, copiado o con QR.
 */
export function ShareWithClientDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const state = useShareState(order.id, open);
  const { create, regenerate, revoke } = useShareLinkActions(order.id);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const link = state.data?.link ?? null;

  // La primera vez que se abre se crea el enlace (Recepción lo pidió al abrir).
  useEffect(() => {
    if (open && state.isSuccess && !link && !create.isPending && !create.isError) create.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, state.isSuccess, link]);
  useEffect(() => {
    if (!open) {
      setCopied(false);
      setShowQr(false);
      create.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const url = link ? portalUrl(link.token) : "";
  const clientName = getOrderClientName(order);
  const ready = isFinishedStatus(order.statusId);
  const message = link ? (ready ? readyMessage : shareMessage)(order.id, url, clientName) : "";
  const notice = readyNoticeLabel(link);
  const phone = order.client?.phone ?? null;
  const busy = state.isPending || create.isPending || regenerate.isPending || revoke.isPending;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar: selecciona el enlace y cópialo a mano.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir con el cliente</DialogTitle>
          <DialogDescription>
            Con este enlace {clientName ? <span className="font-medium text-foreground">{clientName}</span> : "el cliente"} ve
            en qué va su pedido, lo que pidió y el diseño para aprobarlo. Su respuesta te llega para que la confirmes.
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            {create.isError ? (
              <>
                No se pudo crear el enlace.
                <Button variant="link" className="h-auto p-0" onClick={() => create.mutate()}>
                  Reintentar
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Preparando el enlace…
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input readOnly value={url} aria-label="Enlace del pedido" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
              <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={() => void copy()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild className="gap-2 bg-[#25D366] text-white hover:bg-[#1fb457]">
                <a href={whatsappUrl(message, phone)} target="_blank" rel="noreferrer noopener">
                  <MessageCircle className="h-4 w-4" />
                  {ready ? "Avisar que está listo" : phone ? "Enviar por WhatsApp" : "Abrir WhatsApp"}
                </a>
              </Button>
              <Button type="button" variant="outline" className="gap-2" aria-pressed={showQr} onClick={() => setShowQr((v) => !v)}>
                <QrCode className="h-4 w-4" />
                {showQr ? "Ocultar QR" : "Código QR"}
              </Button>
            </div>
            {!phone && (
              <p className="text-xs text-muted-foreground">El cliente no tiene teléfono registrado: WhatsApp te dejará elegir el contacto.</p>
            )}

            {showQr && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 p-4">
                <QrSvg value={url} />
                <p className="text-xs text-muted-foreground">Para escanear en mostrador o imprimir en la nota.</p>
              </div>
            )}

            <p className={cn("flex items-center gap-1.5 text-sm", link.lastViewedAt ? "text-foreground" : "text-muted-foreground")}>
              {link.lastViewedAt ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
              {viewedLabel(link)}
            </p>
            {notice && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <BellRing className="h-4 w-4" aria-hidden />
                {notice}
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={() => regenerate.mutate()}>
                <RefreshCw className="h-4 w-4" />
                Generar enlace nuevo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => {
                  revoke.mutate();
                  onOpenChange(false);
                }}
              >
                <Link2Off className="h-4 w-4" />
                Desactivar enlace
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">El enlace deja de funcionar 30 días después de entregar el pedido.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botón del encabezado del pedido (sólo Recepción/admin). */
export function ShareWithClientButton({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="h-10 shrink-0 gap-2" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Compartir</span>
        <span className="sr-only sm:hidden">Compartir con el cliente</span>
      </Button>
      <ShareWithClientDialog order={order} open={open} onOpenChange={setOpen} />
    </>
  );
}
