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
import { useSession } from "next-auth/react";
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
import { CameraCaptureButton } from "@/components/ui/camera-capture-button";
import { useMotionPreset, staggerContainerVariants } from "@/lib/motion";
import {
  useDesignRevisions,
  useDesignRevisionFile,
  useDesignRevisionFileContent,
} from "@/hooks/useDesignRevisions";
import { useAreaTasks } from "@/hooks/useAreaTasks";
import { useTakeOrderDesign } from "@/hooks/useOrders";
import { usePermissions } from "@/hooks/usePermissions";
import { PRODUCTION_AREA_OPTIONS, getAreaLabel } from "@/lib/areas";
import { DESIGN_FLOW_STATUS_NAMES } from "@/lib/orderStatus";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { downloadFromUrl } from "@/lib/download";
import { DownloadFileButton } from "@/components/ui/download-file-button";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  UPLOAD_FILE_MAX_BYTES,
  isAllowedUploadMime,
  normalizeImageFile,
  readFileAsUploadInput,
} from "@/lib/fileInput";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessagesSquare,
  Palette,
  Paperclip,
  RotateCcw,
  Upload,
  UserRound,
  X,
  ZoomIn,
} from "lucide-react";
import type { DesignRevisionFile, Order } from "@/types";
import type { UploadFileInput } from "@/lib/fileInput";
import { PreviewImage } from "@/components/ui/preview-image";

const ImageLightbox = dynamic(() => import("./ImageLightbox"), { ssr: false });

interface DesignFlowSectionProps {
  order: Order;
}

export function DesignFlowSection({ order }: DesignFlowSectionProps) {
  const { roles, isAdmin } = usePermissions();
  const { data: session } = useSession();
  const { takeDesign, isTakingDesign } = useTakeOrderDesign();
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
  } = useDesignRevisions(order.id, { enabled: order.requiresDesign });
  // A qué áreas va el pedido: las tareas de área son la fuente de verdad
  // (misma queryKey que "Áreas de producción", que vive en el mismo detalle,
  // así que React Query dedupe). Antes esto se preguntaba TRES veces en la
  // misma tarjeta —acá, en "Áreas de producción" y otra vez al confirmar la
  // autorización—, y las dos primeras escribían campos distintos.
  const { tasks: areaTasks } = useAreaTasks(order.id);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [montageDialogOpen, setMontageDialogOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (!order.requiresDesign) return null;

  const canDesign = isAdmin || roles.includes("diseno");
  const canReception = isAdmin || roles.includes("recepcion");

  const currentStatus = (order.status?.name ?? "").toLowerCase();
  const isDesignTurn =
    currentStatus === DESIGN_FLOW_STATUS_NAMES.EN_DISENO ||
    currentStatus === DESIGN_FLOW_STATUS_NAMES.CAMBIOS_SOLICITADOS;
  const isWaitingAuthorization = currentStatus === DESIGN_FLOW_STATUS_NAMES.ESPERANDO_AUTORIZACION;
  const isAuthorized = currentStatus === DESIGN_FLOW_STATUS_NAMES.AUTORIZADO;

  const latestRevision = revisions[revisions.length - 1] ?? null;
  /** Áreas ya planificadas: si las hay, autorizar no vuelve a preguntarlas. */
  const plannedAreas = areaTasks.map((task) => task.area);

  /**
   * "Tomar pedido": cuando Recepción eligió "Cualquier diseñador", el pedido
   * queda a nombre de la cuenta compartida del área (o sin nadie) y no es de
   * ningún diseñador en particular. El dueño lo quiere EXPLÍCITO: abrir el
   * pedido no se lo adjudica a nadie, hay que apretar el botón.
   *
   * Si ya lo tiene una persona real, el botón no aparece (y el backend igual
   * responde 400, cuyo mensaje se muestra tal cual).
   *
   * `roles.includes("diseno")` y no `canDesign`: tomar el pedido es
   * asignárselo, y el backend exige que quien lo toma pertenezca al área
   * Diseño. A un admin que NO es diseñador el endpoint le responde 400 aunque
   * la ruta lo deje pasar — sería un botón que sólo puede fallar (mismo
   * criterio que "Tomar" en `AreaTasksSection`).
   */
  const currentUserId = session?.user?.id ? Number(session.user.id) : null;
  const isInSharedPool =
    order.assignedUserId == null || order.assignedUser?.isSharedAccount === true;
  const canTakeDesign =
    roles.includes("diseno") &&
    currentUserId !== null &&
    isInSharedPool &&
    order.assignedUserId !== currentUserId;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h4 className="font-semibold">Proceso de diseño</h4>
      </div>

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
          description="El servidor no tiene desplegado este endpoint todavía. Intentar nuevamente más tarde."
          className="mt-0 p-6"
        />
      ) : revisions.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="Todavía no hay rondas de diseño"
          description={
            canDesign
              ? "Falta subir el primer montaje para que Recepción lo mande al cliente."
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
            {revisions.map((revision, index) => (
              <RevisionTimelineItem
                key={revision.id}
                orderId={order.id}
                revision={revision}
                // Sólo la ronda vigente (la última) trae sus imágenes sola:
                // las viejas se bajan al verse o al pedirlas.
                isCurrentRound={index === revisions.length - 1}
                onZoom={setLightboxSrc}
              />
            ))}
          </AnimatePresence>
        </motion.ol>
      )}

      {canTakeDesign && (
        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void takeDesign(order.id)}
            disabled={isTakingDesign}
            className="gap-1.5"
          >
            {isTakingDesign ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserRound className="h-4 w-4" />
            )}
            {isTakingDesign ? "Tomando..." : "Tomar pedido"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Está a nombre del área, no de una persona. Tomalo para que quede a
            tu nombre.
          </p>
        </div>
      )}

      {/* Acciones contextuales por rol + estado */}
      {canDesign && isDesignTurn && (
        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
          <Button
            size="sm"
            onClick={() => setMontageDialogOpen(true)}
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
          <p className="text-xs text-muted-foreground">
            Arrastrá, adjuntá o pegá imágenes (Ctrl+V). Pueden ser varias. PNG,
            JPG o PDF, máximo 5MB cada una y 7MB en total.
          </p>
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

      {canDesign && isDesignTurn && (
        <MontageDialog
          open={montageDialogOpen}
          onClose={() => setMontageDialogOpen(false)}
          isSubmitting={isSendingMontage}
          onSubmit={async (montageFiles) => {
            const ok = await sendMontage(montageFiles);
            if (ok) setMontageDialogOpen(false);
            return ok;
          }}
        />
      )}

      {latestRevision && (
        <FeedbackDialog
          open={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          isSubmitting={isSubmittingFeedback}
          onSubmit={async (feedbackText, feedbackFiles) => {
            const ok = await submitFeedback({
              revisionId: latestRevision.id,
              feedbackText,
              feedbackFiles,
            });
            if (ok) setFeedbackOpen(false);
            return ok;
          }}
        />
      )}

      {latestRevision && (
        <ApproveDialog
          open={approveOpen}
          onClose={() => setApproveOpen(false)}
          isSubmitting={isApproving}
          plannedAreas={plannedAreas}
          onSubmit={async (productionArea) => {
            const ok = await approveRevision({
              revisionId: latestRevision.id,
              productionArea,
            });
            if (ok) setApproveOpen(false);
            return ok;
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
  isCurrentRound,
  onZoom,
}: {
  orderId: number;
  revision: import("@/types").DesignRevision;
  /** La ronda vigente precarga sus imágenes; las anteriores, bajo demanda. */
  isCurrentRound: boolean;
  onZoom: (src: string) => void;
}) {
  const { staggerItemVariants } = useMotionPreset();
  // Una hoja de autorización puede ser VARIAS imágenes o un PDF: el backend
  // manda todos en `montageFiles`/`feedbackFiles`. Los campos legacy
  // (`hasMontageFile` y compañía) apuntan al primero y se siguen usando de
  // fallback mientras un servidor viejo no devuelva las listas.
  const montageFiles = revision.montageFiles ?? [];
  const feedbackFiles = revision.feedbackFiles ?? [];
  const useLegacyMontage = montageFiles.length === 0 && revision.hasMontageFile;
  const useLegacyFeedbackFile = feedbackFiles.length === 0 && revision.hasFeedbackFile;

  const isImageMontage = (revision.montageFileMime ?? "").startsWith("image/");
  const montageQuery = useDesignRevisionFile(
    orderId,
    revision.id,
    "montage",
    useLegacyMontage && isImageMontage
  );

  const state: { label: string; classes: string } = revision.approved
    ? { label: "Aprobada", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" }
    : revision.feedbackText
    ? { label: "Con cambios", classes: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" }
    : { label: "Enviada", classes: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" };

  const legacyMontageName = revision.montageFileName ?? `montaje-ronda-${revision.round}`;

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

      {montageFiles.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {montageFiles.map((file) => (
            <RevisionFileCard
              key={file.id}
              orderId={orderId}
              revisionId={revision.id}
              file={file}
              eager={isCurrentRound}
              onZoom={onZoom}
            />
          ))}
        </div>
      )}

      {useLegacyMontage &&
        (isImageMontage ? (
          montageQuery.data ? (
            <div className="space-y-2">
              <button
                type="button"
                className="group relative inline-block overflow-hidden rounded-md border"
                onClick={() => onZoom(montageQuery.data!.url)}
              >
                <PreviewImage
                  src={montageQuery.data.url}
                  alt={legacyMontageName}
                  loading="lazy"
                  className="max-h-48 max-w-full object-contain"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                  <ZoomIn className="h-5 w-5" />
                </span>
              </button>
              <div>
                <DownloadFileButton
                  href={montageQuery.data.url}
                  filename={legacyMontageName}
                />
              </div>
            </div>
          ) : (
            <Skeleton className="h-32 w-full max-w-xs" />
          )
        ) : (
          <RevisionFileButton
            orderId={orderId}
            revisionId={revision.id}
            kind="montage"
            filename={legacyMontageName}
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
          {feedbackFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3">
              {feedbackFiles.map((file) => (
                <RevisionFileCard
                  key={file.id}
                  orderId={orderId}
                  revisionId={revision.id}
                  file={file}
                  eager={isCurrentRound}
                  onZoom={onZoom}
                />
              ))}
            </div>
          )}
          {useLegacyFeedbackFile && (
            <div className="mt-2">
              <RevisionFileButton
                orderId={orderId}
                revisionId={revision.id}
                kind="feedback-file"
                filename={revision.feedbackFileName ?? `adjunto-ronda-${revision.round}`}
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

/**
 * UN archivo de una ronda: las imágenes se muestran (con zoom) y los PDF se
 * traen recién al pedirlos. En los dos casos se puede DESCARGAR, que es lo que
 * necesita Recepción para reenviarle el montaje al cliente por fuera del
 * sistema.
 */
function RevisionFileCard({
  orderId,
  revisionId,
  file,
  eager,
  onZoom,
}: {
  orderId: number;
  revisionId: number;
  file: DesignRevisionFile;
  /** Ronda vigente: sus imágenes se traen sin esperar a que se vean. */
  eager: boolean;
  onZoom: (src: string) => void;
}) {
  const isImage = file.mimeType.startsWith("image/");
  const [requested, setRequested] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  // Antes TODAS las imágenes de TODAS las rondas se bajaban en base64 apenas
  // se abría el detalle (3 rondas x 5 imágenes = 15 GETs de data URLs). Ahora
  // sólo la ronda vigente precarga; las anteriores esperan a entrar en
  // pantalla (o a que se las pida a mano).
  const shouldLoadImage = eager || isVisible || requested;

  useEffect(() => {
    if (!isImage || shouldLoadImage) return;
    const node = placeholderRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isImage, shouldLoadImage]);

  const query = useDesignRevisionFileContent(
    orderId,
    revisionId,
    file.id,
    isImage ? shouldLoadImage : requested
  );

  /** Un error de descarga no puede dejar el skeleton girando para siempre. */
  const retry = (
    <div className="flex w-32 flex-col items-start gap-1.5 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
      <span className="truncate" title={file.filename}>
        No se pudo cargar {file.filename}.
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void query.refetch()}
        disabled={query.isFetching}
        className="gap-1.5"
      >
        {query.isFetching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        Reintentar
      </Button>
    </div>
  );

  if (isImage) {
    if (query.isError) return retry;
    if (!query.data) {
      return (
        <div ref={placeholderRef}>
          {shouldLoadImage ? (
            <Skeleton className="h-32 w-32" />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRequested(true)}
              className="h-32 w-32 flex-col gap-1.5 text-xs"
            >
              <ZoomIn className="h-4 w-4" />
              Ver imagen
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          className="group relative block overflow-hidden rounded-md border"
          onClick={() => onZoom(query.data!.dataUrl)}
        >
          <PreviewImage
            src={query.data.dataUrl}
            alt={file.filename}
            loading="lazy"
            className="max-h-48 max-w-full object-contain"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
            <ZoomIn className="h-5 w-5" />
          </span>
        </button>
        <DownloadFileButton href={query.data.dataUrl} filename={file.filename} />
      </div>
    );
  }

  if (query.isError) return retry;

  if (!query.data) {
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
        {`Ver ${file.filename}`}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href={query.data.dataUrl} target="_blank" rel="noopener noreferrer">
          <FileText className="mr-2 h-3.5 w-3.5" />
          {file.filename}
        </a>
      </Button>
      <DownloadFileButton href={query.data.dataUrl} filename={file.filename} />
    </div>
  );
}

/**
 * Fallback legacy (servidor que todavía no manda `montageFiles`): trae el
 * archivo como blob URL recién al hacer click. "Ver" lo abre en una pestaña y
 * "Descargar" lo guarda con su nombre original.
 */
function RevisionFileButton({
  orderId,
  revisionId,
  kind,
  label,
  filename,
}: {
  orderId: number;
  revisionId: number;
  kind: "montage" | "feedback-file";
  label: string;
  filename: string;
}) {
  // El `seq` hace que dos clicks seguidos en el MISMO botón sigan siendo dos
  // pedidos distintos (el estado cambia igual aunque la acción se repita).
  const [action, setAction] = useState<{ kind: "open" | "download"; seq: number } | null>(
    null
  );
  const query = useDesignRevisionFile(orderId, revisionId, kind, action !== null);

  useEffect(() => {
    const url = query.data?.url;
    if (!action || !url) return;
    if (action.kind === "open") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      void downloadFromUrl(url, filename).catch(() =>
        toast.error("No se pudo descargar el archivo.")
      );
    }
    // Consumida la acción, se limpia para no repetirla en el próximo render.
    setAction(null);
  }, [action, query.data, filename]);

  const run = (next: "open" | "download") => {
    setAction((prev) => ({ kind: next, seq: (prev?.seq ?? 0) + 1 }));
  };

  const isBusy = action !== null && query.isLoading;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => run("open")}
        disabled={isBusy}
        className="gap-1.5"
      >
        {isBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        {label}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => run("download")}
        disabled={isBusy}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Descargar
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog: enviar montaje (Diseño) — drag&drop + botón + pegado (Ctrl+V)      */
/* -------------------------------------------------------------------------- */

interface StagedFile {
  input: UploadFileInput;
  /** Blob URL de vista previa (sólo imágenes); `null` para PDF. */
  previewUrl: string | null;
}

const MAX_UPLOAD_FILES = 10;

/**
 * Tope REAL del total de una ronda. El body-parser de Express corta en 10mb y
 * el JSON viaja en base64 (~+34% sobre los bytes del archivo), así que más de
 * ~7MB de archivos devuelve un 413 con HTML — no el `{message}` de Nest —, y
 * el usuario veía el toast genérico "No se pudo completar la acción" DESPUÉS
 * de haber perdido los archivos. Se corta acá, antes de mandar.
 */
const MAX_UPLOAD_TOTAL_BYTES = 7 * 1024 * 1024;

const MAX_UPLOAD_TOTAL_LABEL = "7MB";

/** Bytes reales que representa un base64 ya leído (sin el prefijo `data:`). */
function uploadInputBytes(input: UploadFileInput): number {
  return Math.floor(input.data.length * 0.75);
}

function stagedTotalBytes(files: StagedFile[]): number {
  return files.reduce((total, staged) => total + uploadInputBytes(staged.input), 0);
}

/** Revoca las vistas previas de una lista de archivos ya descartados. */
function revokePreviews(files: StagedFile[]) {
  files.forEach((staged) => {
    if (staged.previewUrl) URL.revokeObjectURL(staged.previewUrl);
  });
}

/**
 * Valida y lee un `File` del navegador. Devuelve `null` (y avisa con un toast)
 * si no pasa el tipo o el límite de 5MB por archivo.
 */
async function stageFile(file: File, subject: string): Promise<StagedFile | null> {
  const normalized = await normalizeImageFile(file);
  if (!normalized || !isAllowedUploadMime(normalized.type)) {
    toast.error(`${subject} debe ser PNG, JPG o PDF.`);
    return null;
  }
  if (normalized.size > UPLOAD_FILE_MAX_BYTES) {
    toast.error(`${subject} no puede pesar más de 5MB.`);
    return null;
  }
  try {
    const input = await readFileAsUploadInput(normalized);
    return {
      input,
      previewUrl: normalized.type.startsWith("image/")
        ? URL.createObjectURL(normalized)
        : null,
    };
  } catch {
    toast.error("No se pudo leer el archivo. Intentar de nuevo.");
    return null;
  }
}

/**
 * Lee los archivos entrantes respetando el tope por archivo (5MB), la cantidad
 * máxima por ronda y el TOTAL acumulado (7MB reales). Los que no entran no se
 * agregan y se avisa con un toast claro.
 */
async function stageIncomingFiles(
  incoming: File[],
  current: StagedFile[],
  subject: string,
  tooManyMessage: string
): Promise<StagedFile[]> {
  const room = MAX_UPLOAD_FILES - current.length;
  if (incoming.length > room) {
    toast.error(tooManyMessage);
    if (room <= 0) return [];
  }
  const staged: StagedFile[] = [];
  let total = stagedTotalBytes(current);
  for (const file of incoming.slice(0, Math.max(room, 0))) {
    const result = await stageFile(file, subject);
    if (!result) continue;
    const size = uploadInputBytes(result.input);
    if (total + size > MAX_UPLOAD_TOTAL_BYTES) {
      if (result.previewUrl) URL.revokeObjectURL(result.previewUrl);
      toast.error(
        `No entra: entre todos los archivos no se pueden superar los ${MAX_UPLOAD_TOTAL_LABEL}. Quitá alguno o mandalos en dos rondas.`
      );
      break;
    }
    total += size;
    staged.push(result);
  }
  return staged;
}

/** Lista de archivos ya elegidos, cada uno con su vista previa y su X. */
function StagedFileList({
  files,
  onRemove,
  disabled,
}: {
  files: StagedFile[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {files.map((staged, index) => (
        <li
          key={`${staged.input.filename}-${index}`}
          className="flex items-center gap-2 rounded-lg border p-2 text-left text-sm"
        >
          {staged.previewUrl ? (
            <PreviewImage
              src={staged.previewUrl}
              alt={staged.input.filename}
              className="h-12 w-12 shrink-0 rounded object-cover"
            />
          ) : (
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate">{staged.input.filename}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={`Quitar ${staged.input.filename}`}
            onClick={() => onRemove(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function MontageDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  /** Devuelve `true` si el envío salió bien (recién ahí se limpia el diálogo). */
  onSubmit: (montageFiles: UploadFileInput[]) => Promise<boolean>;
  isSubmitting: boolean;
}) {
  const { formButtonMotion } = useMotionPreset();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Una hoja de autorización puede ser varias imágenes (o un PDF), así que el
  // montaje es una LISTA: cada archivo elegido se acumula en vez de reemplazar
  // al anterior.
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Revocar FUERA del updater: en StrictMode el updater corre dos veces y la
  // segunda revocaría una URL ya revocada (o una todavía en uso).
  const reset = () => {
    revokePreviews(files);
    setFiles([]);
    setIsDragging(false);
  };

  const acceptFiles = async (incoming: File[]) => {
    if (incoming.length === 0) return;
    const staged = await stageIncomingFiles(
      incoming,
      files,
      "El montaje",
      `Se pueden enviar hasta ${MAX_UPLOAD_FILES} archivos por ronda.`
    );
    if (staged.length > 0) setFiles((prev) => [...prev, ...staged]);
  };

  const removeFile = (index: number) => {
    const staged = files[index];
    if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    await acceptFiles(picked);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await acceptFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pasted: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const pastedFile = item.getAsFile();
        if (pastedFile) pasted.push(pastedFile);
      }
    }
    if (pasted.length === 0) return;
    e.preventDefault();
    await acceptFiles(pasted);
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    // Sólo se limpia si el envío salió bien: si falla, los archivos siguen
    // cargados y se puede reintentar sin volver a elegirlos.
    const ok = await onSubmit(files.map((staged) => staged.input));
    if (ok) reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !isSubmitting && (onClose(), reset())}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar montaje a Recepción</DialogTitle>
        </DialogHeader>
        <div
          className={cn(
            "space-y-3 rounded-xl border-2 border-dashed p-4 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onPaste={handlePaste}
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_UPLOAD_MIME_TYPES.join(",")}
            className="hidden"
            onChange={handleInputChange}
          />
          {files.length > 0 && (
            <StagedFileList files={files} onRemove={removeFile} disabled={isSubmitting} />
          )}
          <div className="space-y-3 py-2">
            {files.length === 0 && (
              <>
                <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arrastrá las imágenes acá, pegalas con Ctrl+V, o adjuntalas
                  manualmente.
                </p>
              </>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Paperclip className="h-4 w-4" />
                {files.length === 0 ? "Adjuntar archivos" : "Agregar otro"}
              </Button>
              <CameraCaptureButton onChange={handleInputChange} />
              {files.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-1.5">
                  <X className="h-4 w-4" />
                  Quitar todos
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG o PDF. Hasta {MAX_UPLOAD_FILES} archivos, 5MB cada uno
              y {MAX_UPLOAD_TOTAL_LABEL} en total.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => (onClose(), reset())} disabled={isSubmitting}>
            Cancelar
          </Button>
          <motion.div {...(isSubmitting ? {} : formButtonMotion)}>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || files.length === 0}
              className="gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Enviando..." : "Confirmar y enviar"}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  /** Devuelve `true` si el envío salió bien (recién ahí se limpia el diálogo). */
  onSubmit: (
    feedbackText: string,
    feedbackFiles?: UploadFileInput[]
  ) => Promise<boolean>;
  isSubmitting: boolean;
}) {
  const { formButtonMotion } = useMotionPreset();
  const [text, setText] = useState("");
  // El cliente puede mandar varias fotos marcando qué cambiar, así que el
  // adjunto del feedback también es una lista (opcional).
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [error, setError] = useState("");

  // Revocar FUERA del updater (StrictMode lo corre dos veces).
  const reset = () => {
    setText("");
    revokePreviews(files);
    setFiles([]);
    setError("");
  };

  const removeFile = (index: number) => {
    const staged = files[index];
    if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    const staged = await stageIncomingFiles(
      picked,
      files,
      "El adjunto",
      `Se pueden adjuntar hasta ${MAX_UPLOAD_FILES} archivos.`
    );
    if (staged.length > 0) setFiles((prev) => [...prev, ...staged]);
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError("Contá qué cambios pidió el cliente");
      return;
    }
    setError("");
    // Si la mutación falla, el texto tipeado y los adjuntos siguen ahí: antes
    // se perdían los párrafos de cambios que acababa de escribir Recepción.
    const ok = await onSubmit(
      text.trim(),
      files.length > 0 ? files.map((staged) => staged.input) : undefined
    );
    if (ok) reset();
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
          <FormField label="Adjuntos (opcional)">
            <div className="space-y-2">
              {files.length > 0 && (
                <StagedFileList files={files} onRemove={removeFile} disabled={isSubmitting} />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  multiple
                  accept={ALLOWED_UPLOAD_MIME_TYPES.join(",")}
                  onChange={handleFileChange}
                  className="block flex-1 min-w-[12rem] text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                />
                <CameraCaptureButton onChange={handleFileChange} />
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG o PDF. Hasta {MAX_UPLOAD_FILES} archivos, 5MB cada uno
                y {MAX_UPLOAD_TOTAL_LABEL} en total.
              </p>
            </div>
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
  plannedAreas,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (productionArea?: string) => Promise<boolean>;
  isSubmitting: boolean;
  /** Áreas ya definidas en "Áreas de producción". Vacío = falta elegirla acá. */
  plannedAreas: string[];
}) {
  const { formButtonMotion } = useMotionPreset();
  const [productionArea, setProductionArea] = useState<string>("");
  const [error, setError] = useState("");

  const needsProductionArea = plannedAreas.length === 0;

  const handleSubmit = async () => {
    if (needsProductionArea && !productionArea) {
      setError("Seleccionar el área de producción antes de confirmar");
      return;
    }
    setError("");
    const ok = await onSubmit(productionArea || undefined);
    if (ok) setProductionArea("");
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
          {plannedAreas.length > 0 ? (
            // Ya está decidido en "Áreas de producción": acá se confirma, no se
            // vuelve a preguntar.
            <p className="text-sm">
              <span className="text-muted-foreground">Pasa a </span>
              <span className="font-medium">
                {plannedAreas.map(getAreaLabel).join(", ")}
              </span>
            </p>
          ) : (
            <FormField label="¿A qué área pasa?" required error={error}>
              <select
                className="flex h-9 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:border-primary focus-visible:outline-none"
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
