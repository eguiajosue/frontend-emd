"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseWhatsAppList } from "@/lib/quotes/parseWhatsApp";
import { clientDisplayName, findClientByName } from "@/lib/quotes/clients";
import { PRIORITY_CHOICE_LABELS, priorityDateFor, type PriorityChoice } from "@/lib/quotes/priority";
import {
  COMMENT_STATUSES,
  MAX_QUOTE_BULK_ITEMS,
  MAX_QUOTE_CLIENT_NAME_LENGTH,
  MAX_QUOTE_COMMENT_LENGTH,
  MAX_QUOTE_DESCRIPTION_LENGTH,
  QUOTE_STATUSES_BY_STAGE,
  QUOTE_STATUS_LABELS,
  isQuoteStatus,
  type CreateQuotePayload,
  type QuoteStatus,
} from "@/lib/quotes/types";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

interface DraftRow {
  key: string;
  line: number;
  raw: string;
  include: boolean;
  clientId: number | null;
  clientName: string;
  description: string;
  status: QuoteStatus;
  priority: PriorityChoice;
  comment: string;
  warnings: string[];
}

interface PasteWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  /** Crea en bloque; resuelve `true` si se guardó. */
  onSubmit: (items: CreateQuotePayload[]) => Promise<boolean>;
}

const PLACEHOLDER = [
  "* OFISDECO .✅enviada -en espera de montajes",
  "* ESTEBAN TALAMAS . ☑️pendiente lleve la camioneta para medir",
  "* DDN . ☑️HOY",
  "* IHS . ☑️en espera de montajes *prioridad mañana",
].join("\n");

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/** Los datos mínimos que exige el backend para una fila incluida. */
function rowError(row: DraftRow): string | null {
  if (!row.clientName.trim() && !row.clientId) return "Falta el cliente";
  if (!row.description.trim()) return "Falta la descripción";
  return null;
}

/**
 * "Pegar de WhatsApp": se pega el listado del chat, se revisa en una vista
 * previa editable (cliente, descripción, subestado, prioridad, comentario,
 * incluir o no) y se crea todo junto con `POST /quotes/bulk`.
 */
export function PasteWhatsAppDialog({ open, onOpenChange, clients, onSubmit }: PasteWhatsAppDialogProps) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (open) {
      setText("");
      setRows(null);
      setShowErrors(false);
    }
  }, [open]);

  const detected = useMemo(() => parseWhatsAppList(text), [text]);

  const review = () => {
    setShowErrors(false);
    setRows(
      detected.map((p) => {
        const client = findClientByName(clients, p.clientName);
        return {
          key: `l${p.line}`,
          line: p.line,
          raw: p.raw.trim(),
          include: true,
          clientId: client?.id ?? null,
          clientName: client ? clientDisplayName(client) : p.clientName,
          description: p.description,
          status: p.status,
          priority: p.priority,
          comment: p.comment ?? "",
          warnings: p.warnings,
        };
      })
    );
  };

  const update = (key: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? prev);

  const included = rows?.filter((r) => r.include) ?? [];
  const invalid = included.filter((r) => rowError(r));
  const tooMany = included.length > MAX_QUOTE_BULK_ITEMS;

  const save = async () => {
    if (invalid.length || included.length === 0 || tooMany) {
      setShowErrors(true);
      return;
    }
    const now = new Date();
    const items: CreateQuotePayload[] = included.map((r) => ({
      ...(r.clientId ? { clientId: r.clientId } : {}),
      clientName: r.clientName.trim(),
      description: r.description.trim(),
      status: r.status,
      priorityDate: priorityDateFor(r.priority, now),
      ...(r.comment.trim() ? { comment: r.comment.trim() } : {}),
    }));
    setSaving(true);
    try {
      if (await onSubmit(items)) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{rows ? "Revisa antes de crear" : "Pegar de WhatsApp"}</DialogTitle>
          <DialogDescription>
            {rows
              ? "Corrige lo que haga falta: cada fila es una cotización."
              : "Pega el listado del chat, una cotización por línea. Se detectan ✅ / ☑️, «enviada», «en espera de montajes», «medir», «HOY» y «prioridad mañana»."}
          </DialogDescription>
        </DialogHeader>

        {rows === null ? (
          <div className="space-y-2">
            <label htmlFor="quote-paste" className="sr-only">
              Listado de WhatsApp
            </label>
            <Textarea
              id="quote-paste"
              rows={10}
              value={text}
              placeholder={PLACEHOLDER}
              className="min-h-[14rem] font-mono text-sm"
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-meta" aria-live="polite">
              {detected.length === 0
                ? "Todavía no se detecta ninguna cotización."
                : `${detected.length} ${detected.length === 1 ? "cotización detectada" : "cotizaciones detectadas"}`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No quedó ninguna fila.</p>}
            <ol className="space-y-2.5" aria-label="Vista previa">
              {rows.map((row) => {
                const error = row.include && showErrors ? rowError(row) : null;
                const showComment = COMMENT_STATUSES.includes(row.status) || Boolean(row.comment);
                return (
                  <li
                    key={row.key}
                    data-testid="paste-row"
                    className={cn(
                      "rounded-xl border p-3 transition-opacity",
                      row.warnings.length ? "border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/5" : "border-border/60",
                      !row.include && "opacity-50",
                      error && "border-destructive"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        className="mt-2.5"
                        checked={row.include}
                        onCheckedChange={(v) => update(row.key, { include: v === true })}
                        aria-label={`Incluir línea ${row.line}`}
                      />
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                        <div className="relative">
                          <Input
                            aria-label={`Cliente, línea ${row.line}`}
                            value={row.clientName}
                            maxLength={MAX_QUOTE_CLIENT_NAME_LENGTH}
                            className={cn("font-medium", row.clientId && "pr-8")}
                            onChange={(e) => update(row.key, { clientName: e.target.value, clientId: null })}
                          />
                          {row.clientId && (
                            <UserCheck
                              className="absolute right-2.5 top-2.5 h-4 w-4 text-emerald-600"
                              aria-label="Cliente registrado"
                            />
                          )}
                        </div>
                        <Input
                          aria-label={`Descripción, línea ${row.line}`}
                          value={row.description}
                          maxLength={MAX_QUOTE_DESCRIPTION_LENGTH}
                          onChange={(e) => update(row.key, { description: e.target.value })}
                        />
                        <select
                          aria-label={`Subestado, línea ${row.line}`}
                          className={selectClass}
                          value={row.status}
                          onChange={(e) => isQuoteStatus(e.target.value) && update(row.key, { status: e.target.value })}
                        >
                          <optgroup label="Por enviar">
                            {QUOTE_STATUSES_BY_STAGE.por_enviar.map((s) => (
                              <option key={s} value={s}>
                                {QUOTE_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Enviada">
                            {QUOTE_STATUSES_BY_STAGE.enviada.map((s) => (
                              <option key={s} value={s}>
                                {QUOTE_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <select
                          aria-label={`Prioridad, línea ${row.line}`}
                          className={selectClass}
                          value={row.priority}
                          onChange={(e) => update(row.key, { priority: e.target.value as PriorityChoice })}
                        >
                          {(["hoy", "manana", "normal"] as const).map((p) => (
                            <option key={p} value={p}>
                              Prioridad: {PRIORITY_CHOICE_LABELS[p]}
                            </option>
                          ))}
                        </select>
                        {showComment && (
                          <Input
                            aria-label={`Comentario, línea ${row.line}`}
                            placeholder="Comentario"
                            value={row.comment}
                            maxLength={MAX_QUOTE_COMMENT_LENGTH}
                            className="sm:col-span-2"
                            onChange={(e) => update(row.key, { comment: e.target.value })}
                          />
                        )}
                        <p className="truncate font-mono text-[0.6875rem] text-muted-foreground sm:col-span-2" title={row.raw}>
                          {row.line}: {row.raw}
                        </p>
                        {row.warnings.map((w) => (
                          <p key={w} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300 sm:col-span-2">
                            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
                          </p>
                        ))}
                        {error && <p className="text-xs text-destructive sm:col-span-2">{error}</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {tooMany && (
              <p className="text-sm text-destructive">
                Se pueden crear hasta {MAX_QUOTE_BULK_ITEMS} cotizaciones a la vez: quita algunas filas.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {rows === null ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={detected.length === 0} onClick={review}>
                Revisar {detected.length > 0 ? `(${detected.length})` : ""}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setRows(null)} disabled={saving} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Volver al texto
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving || included.length === 0}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear {included.length} {included.length === 1 ? "cotización" : "cotizaciones"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
