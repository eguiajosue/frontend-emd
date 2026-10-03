"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { CollapsibleSection, DetailSection } from "@/components/orders/detail/DetailSection";
import { useOrderAuditLog, useOrderHistory, useOrderNotes } from "@/hooks/useOrders";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { formatDateTime, getAssignedUserName } from "@/lib/format";
import { buildAuditLines } from "@/lib/orderAuditLog";

/** Notas internas del equipo: siempre a mano, son la conversación del pedido. */
export function OrderNotesSection({ orderId }: { orderId: number }) {
  const { timeFormat } = useTimeFormat();
  const { notes, isLoading, isUnavailable, addNote, isAdding } = useOrderNotes(orderId);
  const [draft, setDraft] = useState("");

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    const result = await addNote(text);
    if (result !== undefined) {
      setDraft("");
      toast.success("Nota agregada");
    }
  };

  return (
    <DetailSection
      id="order-section-notes"
      title={notes.length > 0 ? `Notas internas (${notes.length})` : "Notas internas"}
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isUnavailable ? (
        <p className="text-sm text-muted-foreground">Las notas internas todavía no están disponibles.</p>
      ) : (
        <div className="space-y-3">
          {notes.length > 0 && (
            <ul className="space-y-2">
              {notes.map((note) => (
                <li key={note.id} className="space-y-1 rounded-xl bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {getAssignedUserName(note.user) ?? "Usuario"}
                    </span>{" "}
                    · {formatDateTime(note.createdAt, undefined, timeFormat)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{note.text}</p>
                </li>
              ))}
            </ul>
          )}
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleAdd();
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={notes.length === 0 ? "Dejá la primera nota para el equipo…" : "Agregar una nota…"}
              aria-label="Nueva nota interna"
              rows={2}
              onKeyDown={(e) => {
                // Ctrl/⌘+Enter envía sin ir al botón.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
            {draft.trim() && (
              <Button type="submit" size="sm" disabled={isAdding}>
                {isAdding && <Loader2 className="h-4 w-4 animate-spin" />}
                {isAdding ? "Enviando…" : "Agregar nota"}
              </Button>
            )}
          </form>
        </div>
      )}
    </DetailSection>
  );
}

/**
 * "Actividad": los cambios de estado y los cambios en los datos, juntos y
 * plegados. Son de consulta ocasional (antes eran dos bloques siempre
 * abiertos, casi siempre con "Sin cambios todavía"). Se piden recién al abrir.
 */
export function OrderActivitySection({ orderId }: { orderId: number }) {
  const { timeFormat } = useTimeFormat();
  const [open, setOpen] = useState(false);
  const { histories } = useOrderHistory(orderId, { enabled: open });
  const { entries, isLoading, isUnavailable } = useOrderAuditLog(open ? orderId : null, {
    enabled: open,
  });
  const auditLines = useMemo(
    () => entries.flatMap((entry) => buildAuditLines(entry, new Date(), timeFormat)),
    [entries, timeFormat]
  );

  return (
    <CollapsibleSection
      id="order-section-activity"
      title="Actividad"
      summary="Cambios de estado y de datos"
      onOpenChange={setOpen}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-label">Cambios de estado</p>
          {histories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cambios de estado todavía.</p>
          ) : (
            <ul className="space-y-2">
              {histories.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <StatusBadge statusId={h.previousStatusId} />
                  <span aria-hidden className="text-muted-foreground">→</span>
                  <StatusBadge statusId={h.newStatusId} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(h.changeDate, undefined, timeFormat)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-label">Cambios en el pedido</p>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isUnavailable ? (
            <p className="text-sm text-muted-foreground">El historial de cambios todavía no está disponible.</p>
          ) : auditLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cambios: el pedido está tal cual se creó.</p>
          ) : (
            <ul className="space-y-3">
              {auditLines.map((line) => (
                <li key={line.key} className="flex items-start gap-3">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {line.actorInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 leading-relaxed">
                    <p className="break-words text-sm">
                      <span className="font-medium">{line.actorName}</span> {line.action}
                    </p>
                    <p className="text-xs text-muted-foreground" title={line.absoluteTime}>
                      {line.relativeTime}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}
