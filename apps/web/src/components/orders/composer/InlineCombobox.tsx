"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface InlineOption {
  /** Único dentro de la lista (también arma el id del elemento). */
  id: string;
  label: React.ReactNode;
  /** Texto plano del nombre accesible (si `label` no es texto). */
  textValue?: string;
  /** Detalle a la derecha (teléfono, ×cantidad…). */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** Encabezado del grupo al que pertenece (se muestra al cambiar de grupo). */
  group?: string;
  onSelect: () => void;
}

interface InlineComboboxProps {
  id: string;
  /** Nombre accesible del campo. */
  label: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: InlineOption[];
  /** Mostrar la lista aunque no haya texto (ej. clientes recientes). */
  openOnEmpty?: boolean;
  /** Con texto, la primera opción queda activa y Enter la elige. */
  autoActivateFirst?: boolean;
  /** Enter con el campo vacío y sin opción activa (ej. pasar a la descripción). */
  onEnterEmpty?: () => void;
  /** Cambia la opción activa (teclado o mouse): sirve para prefetch. */
  onActiveChange?: (option: InlineOption | null) => void;
  /** Contenido extra al pie de la lista (ej. "Sin resultados"). */
  footer?: React.ReactNode;
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
  className?: string;
  inputClassName?: string;
  leading?: React.ReactNode;
}

/**
 * Campo de texto con su lista de resultados debajo (patrón combobox de ARIA
 * 1.2 con `aria-activedescendant`): se escribe directo, sin abrir primero un
 * popover. Flechas mueven la opción activa, Enter la elige, Escape cierra la
 * lista (sin cerrar el diálogo: ver `onEscapeKeyDown` en CreateOrderDialog).
 *
 * El Enter que elige una opción hace `preventDefault`: el ⌘/Ctrl+Enter del
 * formulario lo ve y NO envía con el estado de antes de esa elección.
 */
export function InlineCombobox({
  id,
  label,
  placeholder,
  value,
  onValueChange,
  options,
  openOnEmpty = false,
  autoActivateFirst = true,
  onEnterEmpty,
  onActiveChange,
  footer,
  invalid,
  required,
  describedBy,
  className,
  inputClassName,
  leading,
}: InlineComboboxProps) {
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const hasText = value.trim() !== "";
  const open = focused && !dismissed && (hasText || openOnEmpty) && (options.length > 0 || Boolean(footer));

  // Al cambiar lo escrito, la activa vuelve a la primera (o a ninguna sin texto).
  useEffect(() => {
    setActive(hasText && autoActivateFirst ? 0 : -1);
  }, [value, hasText, autoActivateFirst]);

  const activeOption = open && active >= 0 ? options[active] ?? null : null;
  const activeId = activeOption ? `${id}-opt-${activeOption.id}` : undefined;
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;
  useEffect(() => {
    onActiveChangeRef.current?.(activeOption);
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // La lista entera a la vista al abrirse (puede caer debajo del borde).
  useEffect(() => {
    if (open) listRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open]);

  const choose = (option: InlineOption) => {
    option.onSelect();
    setDismissed(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (options.length === 0) return;
      e.preventDefault();
      setDismissed(false);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i < 0 ? (delta > 0 ? 0 : options.length - 1) : (i + delta + options.length) % options.length));
      return;
    }
    if (e.key === "Enter") {
      if (activeOption) {
        e.preventDefault();
        choose(activeOption);
        return;
      }
      if (!hasText && onEnterEmpty && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onEnterEmpty();
      }
      return;
    }
    if (e.key === "Escape" && open) {
      // El diálogo no se cierra (ver onEscapeKeyDown): sólo la lista.
      setDismissed(true);
      return;
    }
  };

  let lastGroup: string | undefined;
  return (
    <div className={cn("relative", className)}>
      {leading}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setDismissed(false);
          onValueChange(e.target.value);
        }}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-11 w-full rounded-lg border border-input bg-card px-3 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-[invalid=true]:border-red-600 sm:h-10 sm:text-sm",
          inputClassName
        )}
      />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!open}
        // El clic no le quita el foco al campo: la lista sigue "dentro" del input.
        onMouseDown={(e) => e.preventDefault()}
        className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1 text-sm shadow-lg"
      >
        {options.map((option, index) => {
          const header = option.group && option.group !== lastGroup ? option.group : null;
          lastGroup = option.group;
          return (
            <React.Fragment key={option.id}>
              {header && (
                <li role="presentation" className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {header}
                </li>
              )}
              <li
                id={`${id}-opt-${option.id}`}
                role="option"
                aria-selected={index === active}
                aria-label={option.textValue}
                onMouseMove={() => index !== active && setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 sm:min-h-9",
                  index === active && "bg-muted"
                )}
              >
                {option.icon}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{option.hint}</span>}
              </li>
            </React.Fragment>
          );
        })}
        {footer && (
          <li role="presentation" className="px-2.5 py-2 text-xs text-muted-foreground">
            {footer}
          </li>
        )}
      </ul>
    </div>
  );
}
