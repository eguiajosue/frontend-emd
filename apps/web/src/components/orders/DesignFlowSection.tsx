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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OrderMaterialDialog } from "@/components/orders/OrderMaterialDialog";
import { useOrderMaterials } from "@/hooks/useOrderMaterials";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { useStartOrderDesign, useTakeOrderDesign } from "@/hooks/useOrders";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { PRODUCTION_AREA_OPTIONS, getAreaLabel } from "@/lib/areas";
import { DESIGN_FLOW_STATUS_NAMES } from "@/lib/orderStatus";
import { formatDateTime } from "@/lib/format";
import { useTimeFormat } from "@/hooks/useTimeFormat";
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
  CircleDashed,
  Download,
  FileText,
  Loader2,
  MessagesSquare,
  Palette,
  Paperclip,
  Play,
  Plus,
  RotateCcw,
  Upload,
  UserRound,
  X,
  ZoomIn,
} from "lucide-react";
import type { DesignRevisionFile, Order } from "@/types";
import type { UploadFileInput } from "@/lib/fileInput";
import { PreviewImage } from "@/components/ui/preview-image";
import { ZoomableImage } from "@/components/ui/zoomable-image";

const ImageLightbox = dynamic(() => import("./ImageLightbox"), { ssr: false });

interface DesignFlowSectionProps {
  order: Order;
  /**
   * Dentro del detalle rediseñado: sin recuadro ni título propios (los pone
   * la sección que lo contiene) y con el vacío en una línea.
   */
  embedded?: boolean;
}

/** Mismo criterio que dentro de `RevisionTimelineItem`, reusado para el título del acordeón. */
function revisionStateLabel(revision: import("@/types").DesignRevision): string {
  if (revision.approved) return "Aprobada";
  if (revision.feedbackText) return "Con cambios";
  return "Enviada";
}

export function DesignFlowSection({ order, embedded = false }: DesignFlowSectionProps) {
  const { roles, isAdmin } = usePermissions();
  const { data: session } = useSession();
  const { timeFormat } = useTimeFormat();
  const { takeDesign, isTakingDesign } = useTakeOrderDesign();
  const { startDesign, isStartingDesign } = useStartOrderDesign();
  const [starterName, setStarterName] = useState("");
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
  const isChangesRequested = currentStatus === DESIGN_FLOW_STATUS_NAMES.CAMBIOS_SOLICITADOS;
  const isWaitingAuthorization = currentStatus === DESIGN_FLOW_STATUS_NAMES.ESPERANDO_AUTORIZACION;
  const isAuthorized = currentStatus === DESIGN_FLOW_STATUS_NAMES.AUTORIZADO;

  const latestRevision = revisions[revisions.length - 1] ?? null;
  const nextRound = (latestRevision?.round ?? 0) + 1;
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
   * `roles.includes("diseno") || roles.includes("superuser")`, NO `canDesign`
   * (que también deja pasar a admin): tomar el pedido es asignárselo, y el
   * backend exige pertenecer al área Diseño — salvo superuser, el único rol
   * que hace de todo. A un admin puro el endpoint le responde 403 aunque la
   * ruta lo dejara pasar — sería un botón que sólo puede fallar (mismo
   * criterio que "Tomar" en `AreaTasksSection`).
   */
  const currentUserId = session?.user?.id ? Number(session.user.id) : null;
  const isInSharedPool =
    order.assignedUserId == null || order.assignedUser?.isSharedAccount === true;
  const isDesignerRole = roles.includes("diseno") || roles.includes("superuser");
  const canTakeDesign =
    isDesignerRole &&
    currentUserId !== null &&
    isInSharedPool &&
    order.assignedUserId !== currentUserId;

  /**
   * "Empezar diseño": hasta que alguien lo marca, Recepción no sabe si el
   * pedido está esperando o ya se está haciendo. Sólo aplica a la primera
   * ronda (con montaje enviado ya es obvio que se empezó).
   */
  const notStarted =
    !order.designStartedAt &&
    revisions.length === 0 &&
    currentStatus === DESIGN_FLOW_STATUS_NAMES.EN_DISENO;
  // Entró con la cuenta compartida del área: varias personas la usan, así
  // que se pide el nombre de quien lo empieza.
  const isSharedLogin =
    currentUserId !== null &&
    order.assignedUserId === currentUserId &&
    order.assignedUser?.isSharedAccount === true;
  const canStart =
    notStarted && isDesignerRole && (isInSharedPool || order.assignedUserId === currentUserId);
  const startedAgo = order.designStartedAt
    ? formatDistanceToNow(new Date(order.designStartedAt), { addSuffix: true, locale: es })
    : null;

  const handleStart = async () => {
    if (isSharedLogin) {
      if (!starterName.trim()) return;
      await startDesign(order.id, starterName.trim());
    } else if (canTakeDesign) {
      // Una persona con su propio usuario: empezar es tomarlo a su nombre.
      await takeDesign(order.id);
    } else {
      await startDesign(order.id);
    }
  };

  return (
    <div className={embedded ? "space-y-4" : "space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-soft"}>
      {!embedded && (
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h4 className="font-semibold">Proceso de diseño</h4>
        </div>
      )}

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
      ) : revisions.length === 0 && embedded && notStarted ? null : revisions.length === 0 && embedded ? (
        <p className="text-sm text-muted-foreground">
          {canDesign
            ? "Todavía no hay montaje: subí el primero para que Recepción lo mande al cliente."
            : "Diseño todavía no subió el primer montaje."}
        </p>
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
        <motion.div
          className="space-y-3"
          variants={staggerContainerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Rondas anteriores: colapsadas, para no repetir información vieja
              ni ocupar espacio con montajes ya resueltos. */}
          {revisions.length > 1 && (
            <Accordion type="multiple" className="space-y-2">
              {revisions.slice(0, -1).map((revision) => (
                <AccordionItem
                  key={revision.id}
                  value={String(revision.id)}
                  className="rounded-xl border-0 bg-muted/50 px-4"
                >
                  <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                    <span className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
                      <span>Ronda {revision.round}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {revisionStateLabel(revision)}
                        {revision.sentAt
                          ? ` · ${formatDateTime(revision.sentAt, undefined, timeFormat)}`
                          : ""}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <RevisionTimelineItem
                      orderId={order.id}
                      revision={revision}
                      isCurrentRound={false}
                      onZoom={setLightboxSrc}
                      hideHeader
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {/* Ronda vigente: siempre abierta — es la que necesita acción o
              muestra el resultado más reciente. */}
          <ol>
            <AnimatePresence initial={false}>
              <RevisionTimelineItem
                key={revisions[revisions.length - 1].id}
                orderId={order.id}
                revision={revisions[revisions.length - 1]}
                isCurrentRound
                feedbackFirst={isChangesRequested}
                respondsTo={revisions.length > 1 ? revisions[revisions.length - 2].feedbackText : null}
                onZoom={setLightboxSrc}
              />
            </AnimatePresence>
          </ol>
        </motion.div>
      )}

      {canStart ? (
        <div className="space-y-2 rounded-xl bg-primary/5 p-4">
          <p className="text-sm font-medium">Nadie lo empezó todavía</p>
          <p className="text-xs text-muted-foreground">
            Marcalo cuando arranques, así Recepción sabe que ya está en curso.
          </p>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              void handleStart();
            }}
          >
            {isSharedLogin && (
              <Input
                value={starterName}
                onChange={(e) => setStarterName(e.target.value)}
                placeholder="Tu nombre"
                aria-label="Tu nombre"
                maxLength={60}
                className="h-9 sm:max-w-48"
              />
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isStartingDesign || isTakingDesign || (isSharedLogin && !starterName.trim())}
              className="gap-1.5"
            >
              {isStartingDesign || isTakingDesign ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Empezar diseño
            </Button>
          </form>
        </div>
      ) : notStarted ? (
        <p className="text-sm text-muted-foreground">Diseño todavía no lo empezó.</p>
      ) : order.designStartedAt && currentStatus === DESIGN_FLOW_STATUS_NAMES.EN_DISENO ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Play className="h-3.5 w-3.5" aria-hidden />
          Lo empezó{" "}
          <span className="font-medium text-foreground">{order.designStartedByName ?? "Diseño"}</span>{" "}
          {startedAgo}
        </p>
      ) : null}

      {canTakeDesign && !canStart && (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
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
        <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
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
            {isSendingMontage
              ? "Enviando…"
              : isChangesRequested
              ? `Corregir y reenviar (ronda ${nextRound})`
              : "Enviar montaje a Recepción"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {isChangesRequested
              ? "Subí el montaje corregido: vuelve a Recepción para que lo vea el cliente."
              : "La hoja de autorización: imágenes o PDF. Recepción se la muestra al cliente."}
          </p>
        </div>
      )}

      {canReception && isWaitingAuthorization && latestRevision && (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-sm font-medium">¿Qué respondió el cliente?</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setApproveOpen(true)} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Autorizó
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFeedbackOpen(true)}
              className="gap-1.5"
            >
              <MessagesSquare className="h-4 w-4" />
              Pidió cambios
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Autorizado pasa a producción · con cambios vuelve a Diseño.
          </p>
        </div>
      )}

      {isAuthorized && (
        <p className="flex items-center gap-1.5 border-t border-border/60 pt-4 text-sm text-emerald-600 dark:text-emerald-400">
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
          orderId={order.id}
          round={latestRevision.round}
          plannedAreas={plannedAreas}
          onSubmit={async (productionAreas) => {
            const ok = await approveRevision({
              revisionId: latestRevision.id,
              productionAreas,
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
  hideHeader = false,
  feedbackFirst = false,
  respondsTo = null,
}: {
  orderId: number;
  revision: import("@/types").DesignRevision;
  /**
   * El cliente pidió cambios sobre esta ronda: lo que hay que corregir va
   * ARRIBA del montaje viejo, que es lo primero que tiene que leer Diseño.
   */
  feedbackFirst?: boolean;
  /** Cambios de la ronda anterior que esta ronda corrige (contexto para Recepción). */
  respondsTo?: string | null;
  /** La ronda vigente precarga sus imágenes; las anteriores, bajo demanda. */
  isCurrentRound: boolean;
  onZoom: (src: string) => void;
  /** Dentro de un acordeón el título ya lo muestra el trigger: no repetirlo. */
  hideHeader?: boolean;
}) {
  const { staggerItemVariants } = useMotionPreset();
  const { timeFormat } = useTimeFormat();
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
    ? { label: "Aprobada", classes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" }
    : revision.feedbackText
    ? { label: "Con cambios", classes: "bg-orange-500/10 text-orange-700 dark:text-orange-300" }
    : { label: "Enviada", classes: "bg-sky-500/10 text-sky-700 dark:text-sky-300" };

  const legacyMontageName = revision.montageFileName ?? `montaje-ronda-${revision.round}`;
  const feedbackBlock = revision.feedbackText ? (
    <div
      className={cn(
        "rounded-xl p-3.5 text-sm",
        feedbackFirst ? "bg-orange-500/10" : "bg-background/70"
      )}
    >
      <p className={cn("mb-1", feedbackFirst ? "text-sm font-semibold" : "text-label")}>
        {feedbackFirst ? "El cliente pidió estos cambios" : "Cambios pedidos por el cliente"}
        {revision.feedbackAt ? ` · ${formatDateTime(revision.feedbackAt, undefined, timeFormat)}` : ""}
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
  ) : null;
  const Wrapper = hideHeader ? motion.div : motion.li;

  return (
    <Wrapper
      variants={staggerItemVariants}
      exit={{ opacity: 0 }}
      className={cn(
        "relative space-y-2",
        !hideHeader && "space-y-3 rounded-xl bg-muted/50 p-4"
      )}
    >
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Ronda {revision.round}</span>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", state.classes)}>
            {state.label}
          </span>
        </div>
      )}
      {feedbackFirst && feedbackBlock}

      {revision.sentAt && (
        <p className="text-xs text-muted-foreground">Montaje enviado {formatDateTime(revision.sentAt, undefined, timeFormat)}</p>
      )}
      {respondsTo && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          Corrige lo que pidió el cliente: “{respondsTo}”
        </p>
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
              <ZoomableImage src={montageQuery.data.url} alt={legacyMontageName} onZoom={onZoom} />
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

      {!feedbackFirst && feedbackBlock}

      {revision.approved && (
        <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Aprobada{revision.approvedAt ? ` · ${formatDateTime(revision.approvedAt, undefined, timeFormat)}` : ""}
        </p>
      )}
    </Wrapper>
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
    <div className="flex w-32 flex-col items-start gap-1.5 rounded-xl border border-dashed p-2.5 text-xs text-muted-foreground">
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
        <ZoomableImage src={query.data.dataUrl} alt={file.filename} onZoom={onZoom} className="flex" />
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
          className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2 text-left text-sm"
        >
          {staged.previewUrl ? (
            <PreviewImage
              src={staged.previewUrl}
              alt={staged.input.filename}
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
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

/**
 * Zona para sumar archivos: arrastrar, pegar (Ctrl+V), adjuntar o sacar foto.
 * La comparten el montaje (Diseño) y los cambios del cliente (Recepción),
 * que antes tenía un input nativo sin pegado ni arrastre.
 */
function FileDropzone({
  files,
  onAdd,
  onRemove,
  onClear,
  disabled,
  emptyHint,
}: {
  files: StagedFile[];
  onAdd: (incoming: File[]) => Promise<void>;
  onRemove: (index: number) => void;
  onClear: () => void;
  disabled?: boolean;
  emptyHint: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    await onAdd(picked);
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
    await onAdd(pasted);
  };

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        isDragging ? "border-primary bg-primary/5" : "border-border"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        await onAdd(Array.from(e.dataTransfer.files ?? []));
      }}
      onPaste={handlePaste}
      tabIndex={0}
      aria-label="Zona para soltar o pegar archivos"
    >
      <Input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_UPLOAD_MIME_TYPES.join(",")}
        className="hidden"
        onChange={handleInputChange}
        tabIndex={-1}
        aria-hidden
      />
      {files.length > 0 && <StagedFileList files={files} onRemove={onRemove} disabled={disabled} />}
      <div className="space-y-3 py-1">
        {files.length === 0 && (
          <>
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{emptyHint}</p>
          </>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="gap-1.5"
          >
            <Paperclip className="h-4 w-4" />
            {files.length === 0 ? "Adjuntar archivos" : "Agregar otro"}
          </Button>
          <CameraCaptureButton onChange={handleInputChange} />
          {files.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled} className="gap-1.5">
              <X className="h-4 w-4" />
              Quitar todos
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPG o PDF. Hasta {MAX_UPLOAD_FILES} archivos, 5MB cada uno y {MAX_UPLOAD_TOTAL_LABEL} en total.
        </p>
      </div>
    </div>
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
  // Una hoja de autorización puede ser varias imágenes (o un PDF), así que el
  // montaje es una LISTA: cada archivo elegido se acumula en vez de reemplazar
  // al anterior.
  const [files, setFiles] = useState<StagedFile[]>([]);

  // Revocar FUERA del updater: en StrictMode el updater corre dos veces y la
  // segunda revocaría una URL ya revocada (o una todavía en uso).
  const reset = () => {
    revokePreviews(files);
    setFiles([]);
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
          <DialogDescription>
            Recepción se lo muestra al cliente y registra si lo autoriza o pide cambios.
          </DialogDescription>
        </DialogHeader>
        <FileDropzone
          files={files}
          onAdd={acceptFiles}
          onRemove={removeFile}
          onClear={reset}
          disabled={isSubmitting}
          emptyHint="Arrastrá la hoja de autorización acá, pegala con Ctrl+V o adjuntala."
        />
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
              {isSubmitting ? "Enviando…" : "Enviar a Recepción"}
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

  const acceptFiles = async (incoming: File[]) => {
    if (incoming.length === 0) return;
    const staged = await stageIncomingFiles(
      incoming,
      files,
      "El adjunto",
      `Se pueden adjuntar hasta ${MAX_UPLOAD_FILES} archivos.`
    );
    if (staged.length > 0) setFiles((prev) => [...prev, ...staged]);
  };

  const clearFiles = () => {
    revokePreviews(files);
    setFiles([]);
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
          <DialogTitle>El cliente pidió cambios</DialogTitle>
          <DialogDescription>
            El pedido vuelve a Diseño con estas indicaciones.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="¿Qué pidió cambiar el cliente?" required error={error}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Ej.: agrandar el logo, cambiar el color a azul…"
            />
          </FormField>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Fotos o capturas del cliente (opcional)</p>
            <FileDropzone
              files={files}
              onAdd={acceptFiles}
              onRemove={removeFile}
              onClear={clearFiles}
              disabled={isSubmitting}
              emptyHint="Pegá con Ctrl+V la captura de WhatsApp, o arrastrala acá."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => (onClose(), reset())} disabled={isSubmitting}>
            Cancelar
          </Button>
          <motion.div {...(isSubmitting ? {} : formButtonMotion)}>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-1.5">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Enviando…" : "Devolver a Diseño"}
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

/**
 * Autorizar tiene dos requisitos (al menos un material y saber a qué áreas
 * va). Antes ninguno se veía hasta apretar "Confirmar": el backend devolvía
 * el error en un toast y el diálogo quedaba abierto sin decir cómo seguir.
 * Ahora se muestran como checklist y se resuelven acá mismo.
 */
function ApproveDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  orderId,
  round,
  plannedAreas,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (productionAreas?: string[]) => Promise<boolean>;
  isSubmitting: boolean;
  orderId: number;
  round: number;
  /** Áreas ya definidas en "Áreas de producción". Vacío = se eligen acá. */
  plannedAreas: string[];
}) {
  const { formButtonMotion } = useMotionPreset();
  const { items: materials, isLoading: materialsLoading } = useOrderMaterials(open ? orderId : null);
  const [areas, setAreas] = useState<string[]>([]);
  const [materialOpen, setMaterialOpen] = useState(false);

  const needsAreas = plannedAreas.length === 0;
  const hasMaterials = materials.length > 0;
  const hasAreas = !needsAreas || areas.length > 0;
  const ready = hasMaterials && hasAreas;

  const handleSubmit = async () => {
    if (!ready) return;
    const ok = await onSubmit(needsAreas ? areas : undefined);
    if (ok) setAreas([]);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>El cliente autorizó la ronda {round}</DialogTitle>
          <DialogDescription>
            El pedido sale de Diseño y pasa a producción con este montaje.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3" aria-label="Requisitos para autorizar">
          <li className="flex items-start gap-3">
            <RequirementMark done={hasMaterials} loading={materialsLoading} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-medium">Hoja de materiales</p>
              {hasMaterials ? (
                <p className="text-xs text-muted-foreground">
                  {materials.length === 1 ? "1 material cargado" : `${materials.length} materiales cargados`}
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Cargá al menos un material: producción tiene que saber qué va a usar.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMaterialOpen(true)}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Cargar material
                  </Button>
                </>
              )}
            </div>
          </li>
          <li className="flex items-start gap-3">
            <RequirementMark done={hasAreas} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-medium" id="approve-areas-label">
                Áreas de producción
              </p>
              {needsAreas ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    ¿Quién lo produce? Si va a más de un área, elegilas todas.
                  </p>
                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    size="sm"
                    value={areas}
                    onValueChange={setAreas}
                    aria-labelledby="approve-areas-label"
                    className="flex-wrap justify-start"
                  >
                    {PRODUCTION_AREA_OPTIONS.map((a) => (
                      <ToggleGroupItem key={a.value} value={a.value} className="rounded-full px-3">
                        {a.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Pasa a{" "}
                  <span className="font-medium text-foreground">
                    {plannedAreas.map(getAreaLabel).join(", ")}
                  </span>
                </p>
              )}
            </div>
          </li>
        </ul>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <motion.div {...(isSubmitting || !ready ? {} : formButtonMotion)}>
            <Button onClick={handleSubmit} disabled={isSubmitting || !ready} className="gap-1.5">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Pasando a producción…" : "Pasar a producción"}
            </Button>
          </motion.div>
        </DialogFooter>

        <OrderMaterialDialog open={materialOpen} onClose={() => setMaterialOpen(false)} orderId={orderId} />
      </DialogContent>
    </Dialog>
  );
}

function RequirementMark({ done, loading = false }: { done: boolean; loading?: boolean }) {
  if (loading) return <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />;
  return done ? (
    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Listo" />
  ) : (
    <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-label="Falta" />
  )
}
