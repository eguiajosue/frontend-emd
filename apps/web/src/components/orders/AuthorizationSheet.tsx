"use client";

/**
 * Hoja de autorización del pedido: el montaje que el cliente autorizó (o, si
 * todavía no autorizó ninguno, el último que se le mandó, marcado como tal).
 *
 * Es lo que Producción tiene que mirar para trabajar, así que va arriba del
 * detalle (diálogo y página), para todos los roles. Una hoja puede ser varias
 * imágenes o un PDF (`montageFiles`); las rondas viejas sin lista caen al
 * endpoint legacy `/montage`. Los archivos se piden recién cuando el detalle
 * se monta (el diálogo abierto), y comparten caché con "Proceso de diseño".
 *
 * PDF sin vista previa en línea: la CSP (src/lib/csp.ts) no permite `frame-src`
 * ni `object-src` para `data:`/`blob:`, así que se abre en una pestaña nueva
 * (blob URL) o se descarga.
 */

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  MessagesSquare,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { DownloadFileButton } from "@/components/ui/download-file-button";
import { DetailSection } from "@/components/orders/detail/DetailSection";
import {
  useDesignRevisionFileContent,
  useDesignRevisionLegacyMontage,
  useDesignRevisionList,
} from "@/hooks/useDesignRevisions";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { dataUrlToBlob } from "@/lib/download";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DesignRevision, Order } from "@/types";

const ImageLightbox = dynamic(() => import("./ImageLightbox"), { ssr: false });

export const AUTHORIZATION_SHEET_SECTION_ID = "order-section-sheet";

/* -------------------------------------------------------------------------- */
/* Qué hoja mostrar                                                            */
/* -------------------------------------------------------------------------- */

export type AuthorizationSheetState =
  /** El cliente autorizó esta ronda: es LA hoja. */
  | { kind: "approved"; revision: DesignRevision }
  /** Montaje enviado, el cliente todavía no contesta. */
  | { kind: "pending"; revision: DesignRevision }
  /** El cliente pidió cambios sobre este montaje: Diseño arma otra ronda. */
  | { kind: "changes"; revision: DesignRevision }
  | { kind: "none" };

/** Una ronda tiene hoja si trae archivos (lista nueva o campos legacy). */
function hasMontage(revision: DesignRevision): boolean {
  return (revision.montageFiles?.length ?? 0) > 0 || revision.hasMontageFile;
}

/**
 * La hoja vigente: la última ronda aprobada; si no hay, la última ronda con
 * montaje (con su estado); si no, ninguna.
 */
export function pickAuthorizationSheet(revisions: DesignRevision[]): AuthorizationSheetState {
  const byRound = [...revisions].sort((a, b) => b.round - a.round);
  const approved = byRound.find((r) => r.approved && hasMontage(r));
  if (approved) return { kind: "approved", revision: approved };
  const latest = byRound.find(hasMontage);
  if (!latest) return { kind: "none" };
  return latest.feedbackText ? { kind: "changes", revision: latest } : { kind: "pending", revision: latest };
}

/** Un archivo de la hoja; `fileId: null` = el montaje legacy (sin lista). */
interface SheetFile {
  key: string;
  fileId: number | null;
  filename: string;
  mimeType: string;
}

export function sheetFiles(revision: DesignRevision): SheetFile[] {
  const files = revision.montageFiles ?? [];
  if (files.length > 0) {
    return files.map((file) => ({
      key: `file-${file.id}`,
      fileId: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
    }));
  }
  if (!revision.hasMontageFile) return [];
  return [
    {
      key: "legacy",
      fileId: null,
      filename: revision.montageFileName ?? `hoja-autorizacion-ronda-${revision.round}`,
      mimeType: revision.montageFileMime ?? "",
    },
  ];
}

const STATE_COPY: Record<
  Exclude<AuthorizationSheetState["kind"], "none">,
  { pill: string; pillClass: string; icon: typeof CheckCircle2 }
> = {
  approved: {
    pill: "Autorizada",
    pillClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  pending: {
    pill: "Sin autorizar",
    pillClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
  changes: {
    pill: "Con cambios",
    pillClass: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    icon: MessagesSquare,
  },
};

/* -------------------------------------------------------------------------- */
/* Sección                                                                     */
/* -------------------------------------------------------------------------- */

export function AuthorizationSheet({
  order,
  className,
}: {
  order: Pick<Order, "id" | "requiresDesign">;
  className?: string;
}) {
  const { timeFormat } = useTimeFormat();
  const query = useDesignRevisionList(order.id, { enabled: order.requiresDesign });
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Sin flujo de diseño no hay hoja de autorización: la sección no existe.
  if (!order.requiresDesign) return null;

  const sheet = query.data ? pickAuthorizationSheet(query.data) : null;
  const copy = sheet && sheet.kind !== "none" ? STATE_COPY[sheet.kind] : null;

  let body: ReactNode;
  if (query.isError) {
    body = (
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>No se pudo cargar la hoja de autorización.</span>
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
  } else if (!sheet) {
    body = <Skeleton className="h-40 w-full rounded-xl" aria-label="Cargando hoja de autorización" />;
  } else if (sheet.kind === "none") {
    body = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileImage className="h-4 w-4 shrink-0" aria-hidden />
        Todavía no hay hoja de autorización: aparece aquí cuando Diseño envíe el montaje.
      </p>
    );
  } else {
    const { revision } = sheet;
    const files = sheetFiles(revision);
    const images = files.filter((f) => isImageFile(f));
    const others = files.filter((f) => !isImageFile(f));
    const when =
      sheet.kind === "approved"
        ? revision.approvedAt && `autorizada el ${formatDateTime(revision.approvedAt, undefined, timeFormat)}`
        : revision.sentAt && `enviada el ${formatDateTime(revision.sentAt, undefined, timeFormat)}`;
    const status =
      sheet.kind === "approved"
        ? "autorizada por el cliente"
        : sheet.kind === "pending"
          ? "esperando autorización del cliente"
          : "el cliente pidió cambios";

    body = (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Ronda {revision.round} · {status}
          </span>
          {when ? ` · ${when}` : ""}
        </p>

        {sheet.kind !== "approved" && (
          <div
            role="note"
            className={cn(
              "flex gap-2 rounded-xl p-3 text-sm",
              sheet.kind === "pending" ? "bg-amber-500/10" : "bg-orange-500/10"
            )}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="font-medium">
                {sheet.kind === "pending"
                  ? "El cliente todavía no autoriza esta hoja: no se produce con ella."
                  : "Esta hoja ya no vale: Diseño prepara otra ronda con los cambios."}
              </p>
              {sheet.kind === "changes" && revision.feedbackText && (
                <p className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                  “{revision.feedbackText}”
                </p>
              )}
            </div>
          </div>
        )}

        {images.length > 0 && (
          <ul
            aria-label="Imágenes de la hoja de autorización"
            className={cn("grid gap-3", images.length > 1 && "sm:grid-cols-2")}
          >
            {images.map((file) => (
              <SheetFileItem
                key={file.key}
                orderId={order.id}
                revisionId={revision.id}
                file={file}
                large={images.length === 1}
                onZoom={setLightboxSrc}
              />
            ))}
          </ul>
        )}

        {others.length > 0 && (
          <ul aria-label="Documentos de la hoja de autorización" className="space-y-2">
            {others.map((file) => (
              <SheetFileItem
                key={file.key}
                orderId={order.id}
                revisionId={revision.id}
                file={file}
                large={false}
                onZoom={setLightboxSrc}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <DetailSection
      id={AUTHORIZATION_SHEET_SECTION_ID}
      title="Hoja de autorización"
      className={className}
      action={
        copy ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              copy.pillClass
            )}
          >
            <copy.icon className="h-3.5 w-3.5" aria-hidden />
            {copy.pill}
          </span>
        ) : undefined
      }
    >
      {body}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="Hoja de autorización"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </DetailSection>
  );
}

/** Imagen por mime; el legacy sin mime se decide al tener el contenido. */
function isImageFile(file: SheetFile): boolean {
  if (file.mimeType) return file.mimeType.startsWith("image/");
  // Legacy sin mime: por extensión (el nombre es lo único que hay antes de bajarlo).
  return /\.(png|jpe?g|gif|webp)$/i.test(file.filename);
}

/** Abre un PDF (data URL) en una pestaña nueva como blob URL propia. */
function openInNewTab(dataUrl: string) {
  // Chrome bloquea navegar a una `data:` URL de nivel superior; una blob URL sí abre.
  const url = URL.createObjectURL(dataUrlToBlob(dataUrl));
  window.open(url, "_blank", "noopener,noreferrer");
  // Margen para que la pestaña nueva lo cargue antes de liberar la copia.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function SheetFileItem({
  orderId,
  revisionId,
  file,
  large,
  onZoom,
}: {
  orderId: number;
  revisionId: number;
  file: SheetFile;
  /** Una sola imagen: se muestra grande. */
  large: boolean;
  onZoom: (src: string) => void;
}) {
  const isLegacy = file.fileId === null;
  // Se piden al montarse la sección (el detalle ya está abierto): son lo
  // primero que mira Producción. Misma caché que "Proceso de diseño".
  const listed = useDesignRevisionFileContent(orderId, revisionId, file.fileId, !isLegacy);
  const legacy = useDesignRevisionLegacyMontage(orderId, revisionId, isLegacy);
  const query = isLegacy ? legacy : listed;
  const content = query.data;
  const filename = content?.filename || file.filename;
  const mime = content?.mimeType || file.mimeType;
  const isImage = mime ? mime.startsWith("image/") : isImageFile(file);

  if (query.isError) {
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        <span className="min-w-0 flex-1 truncate" title={filename}>
          No se pudo cargar {filename}.
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
      </li>
    );
  }

  if (isImage) {
    return (
      <li className="min-w-0 space-y-2">
        {content ? (
          <ZoomableImage
            src={content.dataUrl}
            alt={filename}
            onZoom={onZoom}
            className="flex w-full justify-center rounded-xl border-border/60 bg-white"
            imageClassName={cn("w-auto object-contain", large ? "max-h-[28rem]" : "max-h-64")}
          />
        ) : (
          <Skeleton
            className={cn("w-full rounded-xl", large ? "h-72" : "h-48")}
            aria-label={`Cargando ${filename}`}
          />
        )}
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-meta" title={filename}>
            {filename}
          </span>
          {content && <DownloadFileButton href={content.dataUrl} filename={filename} />}
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
        <FileText className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" title={filename}>
          {filename}
        </span>
        <span className="block text-meta">{mime === "application/pdf" ? "PDF" : "Documento"}</span>
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!content}
          onClick={() => {
            if (!content) return;
            try {
              openInNewTab(content.dataUrl);
            } catch {
              toast.error("No se pudo abrir el archivo.");
            }
          }}
          aria-label={`Abrir ${filename}`}
          className="gap-1.5"
        >
          {content ? (
            <ExternalLink className="h-3.5 w-3.5" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Abrir
        </Button>
        {content && <DownloadFileButton href={content.dataUrl} filename={filename} />}
      </div>
    </li>
  );
}
