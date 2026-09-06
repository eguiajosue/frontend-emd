"use client";

/**
 * Panel "Proceso de diseño" del detalle de un pedido (`order.requiresDesign`).
 *
 * Flujo: Recepción → Diseño arma montaje → Recepción → cliente autoriza (o
 * pide cambios, vuelve a Diseño) → autorizado → producción. Cada envío de
 * montaje es una `DesignRevision` ("ronda"); el feedback y la aprobación
 * viajan sobre la ronda vigente (la última).
 */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useMotionPreset, staggerContainerVariants } from "@/lib/motion";
import { useDesignRevisions, useDesignRevisionFile } from "@/hooks/useDesignRevisions";
import { useEntityMutations } from "@/hooks/useEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { PRODUCTION_AREA_OPTIONS, getAreaLabel } from "@/lib/areas";
import { DESIGN_FLOW_STATUS_NAMES } from "@/lib/orderStatus";
import { formatDateTime } from "@/lib/format";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  UPLOAD_FILE_MAX_BYTES,
  isAllowedUploadMime,
  readFileAsUploadInput,
} from "@/lib/fileInput";
import {
  CheckCircle2,
  FileText,
  Loader2,
  MessagesSquare,
  Palette,
  Paperclip,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import type { Order, UpdateOrderPayload } from "@/types";

const ImageLightbox = dynamic(() => import("./ImageLightbox"), { ssr: false });

interface DesignFlowSectionProps {
  order: Order;
}

export function DesignFlowSection({ order }: DesignFlowSectionProps) {
  const { roles, isAdmin } = usePermissions();
  const {
    revisions,
    isLoading,
    isUnavailable,
    sendMontage,
    isSendingMontage,
    submitFeedback,
    isSubmittingFeedback,
    approveRevision,
    isApproving,
  } = useDesignRevisions(order.id);
  const { update: updateOrder, isMutating: isSavingArea } = useEntityMutations<
    Order,
    UpdateOrderPayload
  >("orders");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (!order.requiresDesign) return null;

  const canDesign = isAdmin || roles.includes("diseno");
  const canReception = isAdmin || roles.includes("recepcion");
  const canEditProductionArea = canDesign || canReception;

  const currentStatus = (order.status?.name ?? "").toLowerCase();
  const isDesignTurn =
    currentStatus === DESIGN_FLOW_STATUS_NAMES.EN_DISENO ||
    currentStatus === DESIGN_FLOW_STATUS_NAMES.CAMBIOS_SOLICITADOS;
  const isWaitingAuthorization = currentStatus === DESIGN_FLOW_STATUS_NAMES.ESPERANDO_AUTORIZACION;
  const isAuthorized = currentStatus === DESIGN_FLOW_STATUS_NAMES.AUTORIZADO;

  const latestRevision = revisions[revisions.length - 1] ?? null;

  const handleMontageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedUploadMime(file.type)) {
      toast.error("El montaje debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (file.size > UPLOAD_FILE_MAX_BYTES) {
      toast.error("El montaje no puede pesar más de 5MB.");
      e.target.value = "";
      return;
    }
    try {
      const parsedFile = await readFileAsUploadInput(file);
      await sendMontage(parsedFile);
    } catch {
      toast.error("No se pudo leer el archivo. Intentá de nuevo.");
    } finally {
      e.target.value = "";
    }
  };

  const handleProductionAreaChange = async (value: string) => {
    try {
      await updateOrder(order.id, { productionArea: value || null });
      toast.success("Área de producción actualizada");
    } catch {
      // El toast de error lo dispara el manejo global de mutaciones.
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h4 className="font-semibold">Proceso de diseño</h4>
      </div>

      {/* Área de producción destino: distinta del área ACTUAL (order.area, arriba). */}
      <FormField
        label="Área de producción (destino)"
        hint={
          canEditProductionArea
            ? "A dónde va el pedido cuando el cliente autorice. Distinta del área actual, que hoy es Diseño."
            : undefined
        }
      >
        {canEditProductionArea ? (
          <select
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none disabled:opacity-60"
            value={order.productionArea ?? ""}
            disabled={isSavingArea}
            onChange={(e) => handleProductionAreaChange(e.target.value)}
          >
            <option value="">Sin definir todavía</option>
            {PRODUCTION_AREA_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-muted-foreground">
            {order.productionArea ? getAreaLabel(order.productionArea) : "Todavía sin definir"}
          </p>
        )}
      </FormField>

      {/* Timeline de rondas */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isUnavailable ? (
        <EmptyState
          icon={Palette}
          title="El flujo de diseño todavía no está disponible"
          description="El servidor no tiene desplegado este endpoint todavía. Probá de nuevo más tarde."
          className="mt-0 p-6"
        />
      ) : revisions.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="Todavía no hay rondas de diseño"
          description={
            canDesign
              ? "Subí el primer montaje para que Recepción lo mande al cliente."
              : "Diseño todavía no subió el primer montaje."
          }
          className="mt-0 p-6"
        />
      ) : (
        <motion.ol
          className="space-y-3"
          variants={staggerContainerVariants}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence initial={false}>
            {revisions.map((revision) => (
              <RevisionTimelineItem
                key={revision.id}
                orderId={order.id}
                revision={revision}
                onZoom={setLightboxSrc}
              />
            ))}
          </AnimatePresence>
        </motion.ol>
      )}

      {/* Acciones contextuales por rol + estado */}
      {canDesign && isDesignTurn && (
        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_UPLOAD_MIME_TYPES.join(",")}
            className="hidden"
            onChange={handleMontageFileChange}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSendingMontage}
            className="gap-1.5"
          >
            {isSendingMontage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isSendingMontage ? "Enviando..." : "Enviar montaje a Recepción"}
          </Button>
          <p className="text-xs text-muted-foreground">PNG, JPG o PDF. Máximo 5MB.</p>
        </div>
      )}

      {canReception && isWaitingAuthorization && latestRevision && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFeedbackOpen(true)}
            className="gap-1.5"
          >
            <MessagesSquare className="h-4 w-4" />
            Registrar cambios del cliente
          </Button>
          <Button size="sm" onClick={() => setApproveOpen(true)} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Cliente autorizó
          </Button>
        </div>
      )}

      {isAuthorized && (
        <p className="flex items-center gap-1.5 border-t border-border pt-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          El cliente autorizó el diseño — el pedido pasa a producción.
        </p>
      )}

      {latestRevision && (
        <FeedbackDialog
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          isSubmitting={isSubmittingFeedback}
          onSubmit={async (feedbackText, feedbackFile) => {
            const result = await submitFeedback({
              revisionId: latestRevision.id,
              feedbackText,
              feedbackFile,
            });
            if (result !== undefined) setFeedbackOpen(false);
          }}
        />
      )}

      {latestRevision && (
        <ApproveDialog
          open={approveOpen}
          onClose={() => setApproveOpen(false)}
          isSubmitting={isApproving}
          needsProductionArea={!order.productionArea}
          onSubmit={async (productionArea) => {
            const result = await approveRevision({
              revisionId: latestRevision.id,
              productionArea,
            });
            if (result !== undefined) setApproveOpen(false);
          }}
        />
      )}

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt="Montaje de diseño" onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Timeline                                                                    */
/* -------------------------------------------------------------------------- */

function RevisionTimelineItem({
  orderId,
  revision,
  onZoom,
}: {
  orderId: number;
  revision: import("@/types").DesignRevision;
  onZoom: (src: string) => void;
}) {
  const { staggerItemVariants } = useMotionPreset();
  const isImageMontage = (revision.montageFileMime ?? "").startsWith("image/");
  const montageQuery = useDesignRevisionFile(
    orderId,
    revision.id,
    "montage",
    revision.hasMontageFile && isImageMontage
  );

  const state: { label: string; classes: string } = revision.approved
    ? { label: "Aprobada", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" }
    : revision.feedbackText
    ? { label: "Con cambios", classes: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" }
    : { label: "Enviada", classes: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" };

  return (
    <motion.li
      variants={staggerItemVariants}
      exit={{ opacity: 0 }}
      className="relative space-y-2 rounded-xl border border-border bg-background/60 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">Ronda {revision.round}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${state.classes}`}>
          {state.label}
        </span>
      </div>
      {revision.sentAt && (
        <p className="text-xs text-muted-foreground">Montaje enviado {formatDateTime(revision.sentAt)}</p>
      )}

      {revision.hasMontageFile &&
        (isImageMontage ? (
          montageQuery.data ? (
            <button
              type="button"
              className="group relative inline-block overflow-hidden rounded-md border"
              onClick={() => onZoom(montageQuery.data!.url)}
            >
              <img
                src={montageQuery.data.url}
                alt={revision.montageFileName ?? `Montaje ronda ${revision.round}`}
                loading="lazy"
                className="max-h-48 max-w-full object-contain"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                <ZoomIn className="h-5 w-5" />
              </span>
            </button>
          ) : (
            <Skeleton className="h-32 w-full max-w-xs" />
          )
        ) : (
          <RevisionFileButton
            orderId={orderId}
            revisionId={revision.id}
            kind="montage"
            label={`Ver montaje (${revision.montageFileName ?? "PDF"})`}
          />
        ))}

      {revision.feedbackText && (
        <div className="rounded-lg border bg-muted/30 p-2.5 text-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Feedback del cliente
            {revision.feedbackAt ? ` · ${formatDateTime(revision.feedbackAt)}` : ""}
          </p>
          <p className="whitespace-pre-wrap">{revision.feedbackText}</p>
          {revision.hasFeedbackFile && (
            <div className="mt-2">
              <RevisionFileButton
                orderId={orderId}
                revisionId={revision.id}
                kind="feedback-file"
                label={`Ver adjunto${revision.feedbackFileName ? ` (${revision.feedbackFileName})` : ""}`}
              />
            </div>
          )}
        </div>
      )}

      {revision.approved && (
        <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Aprobada{revision.approvedAt ? ` · ${formatDateTime(revision.approvedAt)}` : ""}
        </p>
      )}
    </motion.li>
  );
}

/** Botón que trae el archivo (blob URL) recién al hacer click, y lo abre en pestaña nueva. */
function RevisionFileButton({
  orderId,
  revisionId,
  kind,
  label,
}: {
  orderId: number;
  revisionId: number;
  kind: "montage" | "feedback-file";
  label: string;
}) {
  const [requested, setRequested] = useState(false);
  const query = useDesignRevisionFile(orderId, revisionId, kind, requested);

  useEffect(() => {
    if (requested && query.data?.url) {
      window.open(query.data.url, "_blank", "noopener,noreferrer");
    }
  }, [requested, query.data]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setRequested(true)}
      disabled={requested && query.isLoading}
      className="gap-1.5"
    >
      {requested && query.isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileText className="h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog: registrar cambios del cliente (Recepción)                          */
/* -------------------------------------------------------------------------- */

function FeedbackDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    feedbackText: string,
    feedbackFile?: import("@/lib/fileInput").UploadFileInput
  ) => Promise<void>;
  isSubmitting: boolean;
}) {
  const { formButtonMotion } = useMotionPreset();
  const [text, setText] = useState("");
  const [file, setFile] = useState<import("@/lib/fileInput").UploadFileInput | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reset = () => {
    setText("");
    setFile(null);
    setFileLabel(null);
    setError("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isAllowedUploadMime(f.type)) {
      toast.error("El adjunto debe ser PNG, JPG o PDF.");
      e.target.value = "";
      return;
    }
    if (f.size > UPLOAD_FILE_MAX_BYTES) {
      toast.error("El adjunto no puede pesar más de 5MB.");
      e.target.value = "";
      return;
    }
    const parsed = await readFileAsUploadInput(f);
    setFile(parsed);
    setFileLabel(f.name);
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError("Contá qué cambios pidió el cliente");
      return;
    }
    setError("");
    await onSubmit(text.trim(), file ?? undefined);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && (onClose(), reset())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambios solicitados por el cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="¿Qué pidió cambiar el cliente?" required error={error}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Ej: agrandar el logo, cambiar el color a azul..."
              className="focus-visible:ring-0 focus-visible:border-primary transition-colors"
            />
          </FormField>
          <FormField label="Adjunto (opcional)">
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{fileLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFile(null);
                    setFileLabel(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <input
                type="file"
                accept={ALLOWED_UPLOAD_MIME_TYPES.join(",")}
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
              />
            )}
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => (onClose(), reset())} disabled={isSubmitting}>
            Cancelar
          </Button>
          <motion.div {...(isSubmitting ? {} : formButtonMotion)}>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-1.5">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Enviando..." : "Enviar a Diseño"}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog: cliente autorizó (Recepción)                                       */
/* -------------------------------------------------------------------------- */

function ApproveDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  needsProductionArea,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (productionArea?: string) => Promise<void>;
  isSubmitting: boolean;
  needsProductionArea: boolean;
}) {
  const { formButtonMotion } = useMotionPreset();
  const [productionArea, setProductionArea] = useState<string>("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (needsProductionArea && !productionArea) {
      setError("Elegí el área de producción antes de confirmar");
      return;
    }
    setError("");
    await onSubmit(productionArea || undefined);
    setProductionArea("");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar autorización del cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El pedido pasa a producción con este montaje. Esta acción no se puede deshacer.
          </p>
          {needsProductionArea && (
            <FormField label="Área de producción" required error={error}>
              <select
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none"
                value={productionArea}
                onChange={(e) => setProductionArea(e.target.value)}
              >
                <option value="">Selecciona un área...</option>
                {PRODUCTION_AREA_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <motion.div {...(isSubmitting ? {} : formButtonMotion)}>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-1.5">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Confirmando..." : "Confirmar autorización"}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
