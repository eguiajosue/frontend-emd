"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientDisplayName } from "@/lib/quotes/clients";
import {
  PRIORITY_CHOICE_LABELS,
  priorityChoiceOf,
  priorityDateFor,
  priorityLabel,
  type PriorityChoice,
} from "@/lib/quotes/priority";
import {
  COMMENT_STATUSES,
  DEFAULT_QUOTE_STATUS,
  MAX_QUOTE_CLIENT_NAME_LENGTH,
  MAX_QUOTE_COMMENT_LENGTH,
  MAX_QUOTE_DESCRIPTION_LENGTH,
  QUOTE_STATUSES_BY_STAGE,
  QUOTE_STATUS_LABELS,
  isQuoteStatus,
  type CreateQuotePayload,
  type Quote,
  type QuoteStage,
  type QuoteStatus,
} from "@/lib/quotes/types";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";
import { QUOTE_STATUS_STYLES } from "./quoteStyles";

/** "Mantener" = la fecha guardada no es hoy ni mañana (p. ej. atrasada): no se toca. */
type PriorityValue = PriorityChoice | "keep";

interface QuoteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  /** Con cotización = editar; sin = alta rápida. */
  quote?: Quote | null;
  /** Etapa de la pestaña abierta: el alta arranca con su subestado por defecto. */
  defaultStage?: QuoteStage;
  /** Guarda; resuelve `true` si se guardó (el diálogo se cierra o se limpia). */
  onSubmit: (payload: CreateQuotePayload) => Promise<boolean>;
}

/**
 * Alta rápida y edición de una cotización. Cliente con el mismo combobox que
 * "Nuevo pedido" (registrado o texto libre), descripción, subestado,
 * prioridad (Hoy / Mañana / Normal → fecha) y, si aplica, comentario.
 */
export function QuoteFormDialog({ open, onOpenChange, clients, quote, defaultStage = "por_enviar", onSubmit }: QuoteFormDialogProps) {
  const editing = Boolean(quote);
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<QuoteStatus>("lista");
  const [priority, setPriority] = useState<PriorityValue>("normal");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<{ client?: string; description?: string }>({});
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setClientId(quote?.clientId ?? null);
    setClientName(quote?.clientName ?? "");
    setDescription(quote?.description ?? "");
    setStatus(quote?.status ?? DEFAULT_QUOTE_STATUS[defaultStage]);
    setPriority(quote ? priorityChoiceOf(quote.priorityDate) ?? "keep" : "normal");
    setComment(quote?.comment ?? "");
    setErrors({});
  };

  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quote?.id]);

  const items = useMemo(() => clients.map((c) => ({ id: c.id, label: clientDisplayName(c) })), [clients]);
  const showComment = editing || COMMENT_STATUSES.includes(status) || Boolean(comment);

  const submit = async (keepOpen: boolean) => {
    const nextErrors: typeof errors = {};
    if (!clientId && !clientName.trim()) nextErrors.client = "Elige o escribe un cliente";
    if (!description.trim()) nextErrors.description = "Escribe qué se cotiza";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(nextErrors.client ? "quote-client" : "quote-description")?.focus();
      return;
    }
    const payload: CreateQuotePayload = {
      clientId: clientId ?? null,
      clientName: clientName.trim(),
      description: description.trim(),
      status,
    };
    if (priority !== "keep") payload.priorityDate = priorityDateFor(priority);
    if (showComment) payload.comment = comment.trim() || null;
    if (!editing && payload.clientId === null) delete payload.clientId;
    setSaving(true);
    try {
      const ok = await onSubmit(payload);
      if (!ok) return;
      if (keepOpen) {
        // "Guardar y agregar otra": mismo subestado y prioridad, cliente y descripción en blanco.
        setClientId(null);
        setClientName("");
        setDescription("");
        setComment("");
        requestAnimationFrame(() => document.getElementById("quote-client")?.focus());
      } else {
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cotización" : "Nueva cotización"}</DialogTitle>
          <DialogDescription className="sr-only">
            Cliente, descripción, subestado y prioridad de la cotización.
          </DialogDescription>
        </DialogHeader>

        <form
          id="quote-form"
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="quote-client" className="text-sm font-medium">
              Cliente o empresa
            </label>
            <CreatableCombobox
              id="quote-client"
              required
              invalid={Boolean(errors.client)}
              describedBy={errors.client ? "quote-client-error" : undefined}
              items={items}
              selectedId={clientId}
              customValue={clientId && items.some((i) => i.id === clientId) ? null : clientName}
              placeholder="Buscar cliente…"
              createLabel={(value) => `Usar "${value}" como nombre de cliente`}
              emptyLabel="Todavía no hay clientes. Escribe un nombre para usarlo."
              onSelectItem={(item) => {
                setClientId(Number(item.id));
                setClientName(item.label);
                setErrors((e) => ({ ...e, client: undefined }));
              }}
              onUseCustom={(text) => {
                setClientId(null);
                setClientName(text.slice(0, MAX_QUOTE_CLIENT_NAME_LENGTH));
                setErrors((e) => ({ ...e, client: undefined }));
              }}
            />
            {errors.client && (
              <p id="quote-client-error" className="text-xs text-destructive">
                {errors.client}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="quote-description" className="text-sm font-medium">
              Descripción
            </label>
            <Textarea
              id="quote-description"
              rows={2}
              maxLength={MAX_QUOTE_DESCRIPTION_LENGTH}
              value={description}
              placeholder="Ej. 50 playeras bordadas, lona 2×1…"
              className="min-h-[4rem] [field-sizing:content]"
              aria-required
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "quote-description-error" : undefined}
              onChange={(e) => {
                setDescription(e.target.value);
                if (e.target.value.trim()) setErrors((er) => ({ ...er, description: undefined }));
              }}
            />
            {errors.description && (
              <p id="quote-description-error" className="text-xs text-destructive">
                {errors.description}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="quote-status" className="text-sm font-medium">
                Subestado
              </label>
              <Select value={status} onValueChange={(v) => isQuoteStatus(v) && setStatus(v)}>
                <SelectTrigger id="quote-status" className="h-11 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Por enviar</SelectLabel>
                    {QUOTE_STATUSES_BY_STAGE.por_enviar.map((s) => (
                      <StatusOption key={s} status={s} />
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Enviada</SelectLabel>
                    {QUOTE_STATUSES_BY_STAGE.enviada.map((s) => (
                      <StatusOption key={s} status={s} />
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span id="quote-priority-label" className="text-sm font-medium">
                Prioridad
              </span>
              <ToggleGroup
                type="single"
                variant="segmented"
                size="sm"
                value={priority}
                onValueChange={(v) => v && setPriority(v as PriorityValue)}
                aria-labelledby="quote-priority-label"
                className="w-full justify-start rounded-full border border-border/60 bg-card p-1"
              >
                {priority === "keep" && quote?.priorityDate && (
                  <ToggleGroupItem value="keep" className="flex-1">
                    {priorityLabel(quote.priorityDate)}
                  </ToggleGroupItem>
                )}
                {(["hoy", "manana", "normal"] as const).map((choice) => (
                  <ToggleGroupItem key={choice} value={choice} className="flex-1">
                    {PRIORITY_CHOICE_LABELS[choice]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          {showComment && (
            <div className="space-y-1.5">
              <label htmlFor="quote-comment" className="text-sm font-medium">
                Comentario <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Textarea
                id="quote-comment"
                rows={2}
                maxLength={MAX_QUOTE_COMMENT_LENGTH}
                value={comment}
                placeholder="Qué respondió el cliente, qué falta…"
                className="min-h-[3.5rem] [field-sizing:content]"
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}
        </form>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          {!editing && (
            <Button type="button" variant="secondary" onClick={() => void submit(true)} disabled={saving}>
              Guardar y agregar otra
            </Button>
          )}
          <Button type="submit" form="quote-form" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Guardar cambios" : "Agregar cotización"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusOption({ status }: { status: QuoteStatus }) {
  return (
    <SelectItem value={status}>
      <span className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", QUOTE_STATUS_STYLES[status].dot)} aria-hidden />
        {QUOTE_STATUS_LABELS[status]}
      </span>
    </SelectItem>
  );
}
