"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  MessageSquareText,
  MoreHorizontal,
  Package,
  PackagePlus,
  Pencil,
  Send,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COMMENT_STATUSES,
  DEFAULT_QUOTE_DESCRIPTION,
  MAX_QUOTE_COMMENT_LENGTH,
  type Quote,
  type QuoteStatus,
} from "@/lib/quotes/types";
import { cn } from "@/lib/utils";
import { QuotePriorityChip } from "./QuotePriorityChip";
import { QuoteStatusMenu } from "./QuoteStatusMenu";

export interface QuoteCardProps {
  quote: Quote;
  onStatusChange: (quote: Quote, status: QuoteStatus) => void;
  onMarkSent: (quote: Quote) => void;
  onMarkPending: (quote: Quote) => void;
  onCommentSave: (quote: Quote, comment: string | null) => void;
  onEdit: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
  onConvert: (quote: Quote) => void;
  /** Abre el editor del comentario al montar (p. ej. recién pasó a "Comentarios"). */
  editCommentOnMount?: boolean;
  onCommentEditorOpened?: () => void;
}

function since(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (Date.now() - date.getTime() < 60_000) return "hace un momento";
  return formatDistanceToNowStrict(date, { locale: es, addSuffix: true });
}

/**
 * Una cotización: cliente, descripción, prioridad, subestado (un clic),
 * acción principal según la etapa y comentario editable en línea.
 */
export function QuoteCard({
  quote,
  onStatusChange,
  onMarkSent,
  onMarkPending,
  onCommentSave,
  onEdit,
  onDelete,
  onConvert,
  editCommentOnMount,
  onCommentEditorOpened,
}: QuoteCardProps) {
  const [editingComment, setEditingComment] = useState(false);
  const showComment = editingComment || Boolean(quote.comment) || COMMENT_STATUSES.includes(quote.status);
  const isDefaultDescription = quote.description.trim() === DEFAULT_QUOTE_DESCRIPTION;
  const timeLabel =
    quote.stage === "enviada" && quote.sentAt ? `Enviada ${since(quote.sentAt)}` : `Movida ${since(quote.updatedAt)}`;

  useEffect(() => {
    if (editCommentOnMount) {
      setEditingComment(true);
      onCommentEditorOpened?.();
    }
  }, [editCommentOnMount, onCommentEditorOpened]);

  return (
    <article
      aria-label={quote.clientName}
      data-testid="quote-card"
      className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-soft sm:p-4"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 break-words font-semibold leading-tight">{quote.clientName}</h3>
            {quote.clientId !== null && (
              <UserCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Cliente registrado" />
            )}
            <QuotePriorityChip priorityDate={quote.priorityDate} />
          </div>
          <p
            className={cn(
              "mt-1 line-clamp-3 whitespace-pre-line break-words text-sm",
              isDefaultDescription ? "text-muted-foreground/70" : "text-muted-foreground"
            )}
          >
            {quote.description}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-1.5 -mt-1.5 h-9 w-9 shrink-0" aria-label={`Más acciones de ${quote.clientName}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => onEdit(quote)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditingComment(true)}>
              <MessageSquareText className="mr-2 h-4 w-4" /> {quote.comment ? "Editar comentario" : "Agregar comentario"}
            </DropdownMenuItem>
            {quote.stage === "enviada" && (
              <DropdownMenuItem onSelect={() => onMarkPending(quote)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Regresar a por enviar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDelete(quote)}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <QuoteStatusMenu status={quote.status} onChange={(status) => onStatusChange(quote, status)} />
        {quote.stage === "por_enviar" && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full" onClick={() => onMarkSent(quote)}>
            <Send className="h-3.5 w-3.5" aria-hidden /> Marcar como enviada
          </Button>
        )}
        {quote.orderId !== null ? (
          <Link
            href={`/dashboard/orders/${quote.orderId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20 transition-colors hover:bg-primary/15"
          >
            <Package className="h-3.5 w-3.5" aria-hidden /> Pedido #{quote.orderId}
          </Link>
        ) : (
          quote.status === "aceptada" && (
            <Button size="sm" className="h-8 gap-1.5 rounded-full" onClick={() => onConvert(quote)}>
              <PackagePlus className="h-3.5 w-3.5" aria-hidden /> Convertir en pedido
            </Button>
          )
        )}
        <span className="ml-auto text-meta">{timeLabel}</span>
      </div>

      {showComment && (
        <InlineComment
          value={quote.comment}
          editing={editingComment}
          onEditingChange={setEditingComment}
          onSave={(comment) => onCommentSave(quote, comment)}
        />
      )}
    </article>
  );
}

/** Comentario editable en línea: clic para editar, Enter guarda, Esc cancela. */
function InlineComment({
  value,
  editing,
  onEditingChange,
  onSave,
}: {
  value: string | null;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSave: (comment: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing) {
      cancelled.current = false;
      setDraft(value ?? "");
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.select();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    if (cancelled.current) return;
    const next = draft.trim();
    if (next !== (value ?? "").trim()) onSave(next || null);
    onEditingChange(false);
  };

  if (editing) {
    return (
      <div className="mt-3">
        <Textarea
          ref={ref}
          aria-label="Comentario"
          rows={2}
          maxLength={MAX_QUOTE_COMMENT_LENGTH}
          value={draft}
          placeholder="Qué respondió el cliente, qué falta…"
          className="min-h-[3.5rem] [field-sizing:content]"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancelled.current = true;
              onEditingChange(false);
            }
          }}
        />
        <p className="mt-1 text-meta">Enter para guardar · Esc para cancelar</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onEditingChange(true)}
      className={cn(
        "mt-3 flex w-full items-start gap-2 rounded-xl bg-muted/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      aria-label={value ? `Comentario: ${value}. Editar` : "Agregar comentario"}
    >
      <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className={cn("min-w-0 flex-1 whitespace-pre-line break-words", !value && "text-muted-foreground")}>
        {value || "Agregar comentario"}
      </span>
    </button>
  );
}
