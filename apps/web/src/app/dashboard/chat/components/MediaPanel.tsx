"use client";

import { FileText, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { PreviewImage } from "@/components/ui/preview-image";
import type { ChatMessage } from "@/types";

interface MediaPanelProps {
  messages: ChatMessage[];
  className?: string;
}

function formatBytes(bytes: number | null): string | null {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Panel de archivos compartidos (imágenes/videos/archivos) de la conversación
 * abierta, armado del lado del cliente a partir de los adjuntos que ya vienen
 * en `messages` (no pega un endpoint nuevo). Como `messages` está paginado
 * (ver `useChatMessages`), sólo refleja los adjuntos de los mensajes ya
 * cargados en pantalla, no el historial completo.
 */
export function MediaPanel({ messages, className }: MediaPanelProps) {
  const attachments = messages
    .filter((m) => m.attachment?.dataUrl)
    .map((m) => ({ message: m, attachment: m.attachment! }))
    .reverse();

  const images = attachments.filter((a) => a.attachment.mimeType.startsWith("image/"));
  const videos = attachments.filter((a) => a.attachment.mimeType.startsWith("video/"));
  const files = attachments.filter(
    (a) =>
      !a.attachment.mimeType.startsWith("image/") &&
      !a.attachment.mimeType.startsWith("video/")
  );

  return (
    <aside
      className={cn(
        "hidden w-72 shrink-0 flex-col overflow-y-auto border-l bg-card/40 p-4 xl:flex",
        className
      )}
    >
      <h3 className="mb-3 text-sm font-semibold tracking-tight">Archivos compartidos</h3>

      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Las imágenes, videos y archivos que se compartan en esta conversación
          van a aparecer acá.
        </p>
      ) : (
        <>
          {images.length > 0 ? (
            <section className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                Imágenes
              </p>
              <div className="grid grid-cols-2 gap-2">
                {images.slice(0, 8).map(({ message, attachment }) => (
                  <a
                    key={message.id}
                    href={attachment.dataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-xl border shadow-soft transition-opacity hover:opacity-80"
                  >
                    <PreviewImage
                      src={attachment.dataUrl!}
                      alt={attachment.filename}
                      className="aspect-square w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {videos.length > 0 ? (
            <section className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                Videos
              </p>
              <ul className="space-y-2">
                {videos.map(({ message, attachment }) => (
                  <li key={message.id}>
                    <a
                      href={attachment.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border bg-background/60 p-2.5 text-xs shadow-soft transition-colors hover:bg-accent"
                    >
                      <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {attachment.filename}
                      </span>
                      {formatBytes(attachment.size) ? (
                        <span className="shrink-0 text-muted-foreground">
                          {formatBytes(attachment.size)}
                        </span>
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {files.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                Archivos
              </p>
              <ul className="space-y-2">
                {files.map(({ message, attachment }) => (
                  <li key={message.id}>
                    <a
                      href={attachment.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={attachment.filename}
                      className="flex items-center gap-2 rounded-xl border bg-background/60 p-2.5 text-xs shadow-soft transition-colors hover:bg-accent"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {attachment.filename}
                      </span>
                      {formatBytes(attachment.size) ? (
                        <span className="shrink-0 text-muted-foreground">
                          {formatBytes(attachment.size)}
                        </span>
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </aside>
  );
}
