"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  QUOTE_STATUSES_BY_STAGE,
  QUOTE_STATUS_LABELS,
  isQuoteStatus,
  type QuoteStatus,
} from "@/lib/quotes/types";
import { cn } from "@/lib/utils";
import { QUOTE_STATUS_STYLES } from "./quoteStyles";

/**
 * Subestado editable en un clic: el chip abre el menú con los 8 subestados
 * agrupados por etapa. Elegir uno de la otra etapa también mueve la
 * cotización de pestaña (el backend deduce la etapa del subestado).
 */
export function QuoteStatusMenu({
  status,
  onChange,
  disabled,
  onCloseAutoFocus,
}: {
  status: QuoteStatus;
  onChange: (status: QuoteStatus) => void;
  disabled?: boolean;
  /** Se llama al cerrarse el menú, antes de devolver el foco al botón (preventDefault lo evita). */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const style = QUOTE_STATUS_STYLES[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Subestado: ${QUOTE_STATUS_LABELS[status]}. Cambiar`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
          style.chip
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", style.dot)} aria-hidden />
        {QUOTE_STATUS_LABELS[status]}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56" onCloseAutoFocus={onCloseAutoFocus}>
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(value) => {
            if (isQuoteStatus(value) && value !== status) onChange(value);
          }}
        >
          <DropdownMenuLabel className="text-label">Por enviar</DropdownMenuLabel>
          {QUOTE_STATUSES_BY_STAGE.por_enviar.map((s) => (
            <StatusItem key={s} status={s} />
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-label">Enviada</DropdownMenuLabel>
          {QUOTE_STATUSES_BY_STAGE.enviada.map((s) => (
            <StatusItem key={s} status={s} />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusItem({ status }: { status: QuoteStatus }) {
  return (
    <DropdownMenuRadioItem value={status} className="gap-2">
      <span className={cn("h-2 w-2 rounded-full", QUOTE_STATUS_STYLES[status].dot)} aria-hidden />
      {QUOTE_STATUS_LABELS[status]}
    </DropdownMenuRadioItem>
  );
}
