"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Download, ImageOff, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PreviewImage } from "@/components/ui/preview-image";
import { ConfirmDeleteDialog } from "@/components/crud/ConfirmDeleteDialog";
import { MockupStudioDialog } from "@/components/mockups/MockupStudioDialog";
import { DetailSection } from "@/components/orders/detail/DetailSection";
import {
  mockupErrorMessage,
  useCreateOrderMockup,
  useDeleteOrderMockup,
  useOrderMockupDetail,
  useOrderMockups,
} from "@/hooks/useOrderMockups";
import { downloadFromUrl } from "@/lib/download";
import { buildMockupPayload, mockupFilename, type MockupStudioResult } from "@/lib/mockups/studio";
import { GARMENT_LABELS, type OrderMockupSummary } from "@/lib/mockups/types";
import type { Order } from "@/types";

/** Se vuelve `true` la primera vez que el elemento entra (o está por entrar) en pantalla. */
function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);
  return [ref, inView] as const;
}

function mockupMeta(mockup: OrderMockupSummary): string {
  const date = new Date(mockup.createdAt);
  const when = Number.isNaN(date.getTime()) ? "" : format(date, "d MMM, HH:mm", { locale: es });
  return [when, mockup.createdBy?.name].filter(Boolean).join(" · ");
}

/** Miniatura: la imagen (detalle) se pide sólo cuando la tarjeta se ve. */
function MockupThumb({
  orderId,
  mockup,
  onOpen,
}: {
  orderId: number;
  mockup: OrderMockupSummary;
  onOpen: () => void;
}) {
  const [ref, inView] = useInView<HTMLLIElement>();
  const { data, isError } = useOrderMockupDetail(orderId, mockup.id, { enabled: inView });
  const label = GARMENT_LABELS[mockup.garment] ?? "Mockup";

  return (
    <li ref={ref}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver mockup de ${label.toLowerCase()}`}
        className="group block w-full overflow-hidden rounded-xl bg-muted/50 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="flex aspect-[2/1] items-center justify-center overflow-hidden bg-white">
          {data ? (
            <PreviewImage
              src={data.dataUrl}
              alt=""
              className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : isError ? (
            <ImageOff className="h-5 w-5 text-muted-foreground" aria-hidden />
          ) : (
            <Skeleton className="h-full w-full rounded-none" />
          )}
        </span>
        <span className="block px-3 py-2">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block truncate text-meta">{mockupMeta(mockup)}</span>
        </span>
      </button>
    </li>
  );
}

function MockupPreviewDialog({
  orderId,
  mockup,
  canManage,
  onClose,
  onDelete,
}: {
  orderId: number;
  mockup: OrderMockupSummary | null;
  canManage: boolean;
  onClose: () => void;
  onDelete: (mockup: OrderMockupSummary) => void;
}) {
  const { data, isPending, isError } = useOrderMockupDetail(orderId, mockup?.id ?? 0, {
    enabled: mockup !== null,
  });
  const [downloading, setDownloading] = useState(false);
  const label = mockup ? GARMENT_LABELS[mockup.garment] ?? "Mockup" : "Mockup";

  const download = async () => {
    if (!data || !mockup) return;
    setDownloading(true);
    try {
      await downloadFromUrl(data.dataUrl, mockupFilename(mockup.garment, new Date(mockup.createdAt)));
    } catch {
      toast.error("No se pudo descargar el mockup.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={mockup !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Mockup · {label}</DialogTitle>
          {mockup && <p className="text-meta">{mockupMeta(mockup)}</p>}
        </DialogHeader>
        <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-white">
          {data ? (
            <PreviewImage src={data.dataUrl} alt={`Mockup de ${label.toLowerCase()}`} className="max-h-[70vh] w-full object-contain" />
          ) : isError ? (
            <p className="p-6 text-sm text-muted-foreground">No se pudo cargar la imagen.</p>
          ) : isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando" />
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          {canManage && mockup && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive sm:mr-auto"
              onClick={() => onDelete(mockup)}
            >
              <Trash2 /> Eliminar
            </Button>
          )}
          <Button type="button" onClick={download} disabled={!data || downloading}>
            {downloading ? <Loader2 className="animate-spin" /> : <Download />}
            Descargar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mockups guardados en el pedido: miniaturas, ver en grande y descargar.
 * Recepción y admin además crean (abre el estudio y guarda directo aquí) y
 * eliminan. Para los demás roles la sección no aparece si no hay mockups.
 */
export function OrderMockupsSection({ order, canManage }: { order: Order; canManage: boolean }) {
  const { mockups, isLoading } = useOrderMockups(order.id);
  const createMockup = useCreateOrderMockup();
  const deleteMockup = useDeleteOrderMockup();
  const [studioOpen, setStudioOpen] = useState(false);
  const [previewing, setPreviewing] = useState<OrderMockupSummary | null>(null);
  const [deleting, setDeleting] = useState<OrderMockupSummary | null>(null);

  if (!canManage && mockups.length === 0) return null;

  const saveMockup = async (result: MockupStudioResult) => {
    try {
      await createMockup.mutateAsync({ orderId: order.id, payload: buildMockupPayload(result) });
      toast.success(`Mockup agregado al pedido #${order.id}`);
    } catch (error) {
      toast.error(mockupErrorMessage(error));
      throw error;
    }
  };

  const confirmDelete = async () => {
    const target = deleting;
    if (!target) return;
    setDeleting(null);
    try {
      await deleteMockup.mutateAsync({ orderId: order.id, mockupId: target.id });
      setPreviewing(null);
      toast.success("Mockup eliminado");
    } catch {
      // El aviso de error lo muestra el manejo global de mutaciones.
    }
  };

  return (
    <>
      <DetailSection
        id="order-section-mockups"
        title="Mockups"
        action={
          canManage ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setStudioOpen(true)}>
              <Plus /> Crear mockup
            </Button>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="aspect-[2/1] w-full rounded-xl" />
          </div>
        ) : mockups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin mockups todavía.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Mockups del pedido">
            {mockups.map((mockup) => (
              <MockupThumb
                key={mockup.id}
                orderId={order.id}
                mockup={mockup}
                onOpen={() => setPreviewing(mockup)}
              />
            ))}
          </ul>
        )}
      </DetailSection>

      <MockupPreviewDialog
        orderId={order.id}
        mockup={previewing}
        canManage={canManage}
        onClose={() => setPreviewing(null)}
        onDelete={setDeleting}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar este mockup?"
        description="Se quita del pedido. Esta acción no se puede deshacer."
      />

      {canManage && (
        <MockupStudioDialog
          open={studioOpen}
          onOpenChange={setStudioOpen}
          title={`Crear mockup · Pedido #${order.id}`}
          attachLabel="Guardar en el pedido"
          onAttach={saveMockup}
        />
      )}
    </>
  );
}
