"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  id: string | number;
  label: string;
}

interface CreatableComboboxProps {
  items: ComboboxItem[];
  /** id del item seleccionado del catálogo (mutuamente excluyente con `customValue`). */
  selectedId?: string | number | null;
  /** texto libre elegido (mutuamente excluyente con `selectedId`). */
  customValue?: string | null;
  onSelectItem: (item: ComboboxItem) => void;
  onUseCustom: (text: string) => void;
  placeholder?: string;
  /** Texto de la opción para usar el valor libre, ej. "Usar “{value}” como nombre de cliente". */
  createLabel?: (value: string) => string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Combobox "creatable" (patrón shadcn Command + Popover): el usuario escribe
 * libremente y filtra opciones existentes, o elige usar el texto tipeado tal
 * cual si no coincide con ninguna. Reemplaza los pares select/tabs +
 * input-libre repetidos en el formulario de pedido (cliente, producto).
 */
export function CreatableCombobox({
  items,
  selectedId,
  customValue,
  onSelectItem,
  onUseCustom,
  placeholder = "Buscar o escribir...",
  createLabel = (value) => `Usar "${value}"`,
  emptyLabel = "No se encontraron resultados.",
  className,
  disabled,
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedItem = items.find((i) => String(i.id) === String(selectedId));
  const displayValue = selectedItem ? selectedItem.label : customValue || "";

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? items.filter((i) => i.label.toLowerCase().includes(normalizedSearch))
    : items;
  const hasExactMatch = items.some(
    (i) => i.label.trim().toLowerCase() === normalizedSearch
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between font-normal",
            !displayValue && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayValue || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 && !search.trim() && (
              <CommandEmpty>{emptyLabel}</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((item) => (
                <CommandItem
                  key={item.id}
                  value={String(item.id)}
                  onSelect={() => {
                    onSelectItem(item);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      String(selectedId) === String(item.id) && !customValue
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {search.trim() && !hasExactMatch && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${search}`}
                  onSelect={() => {
                    onUseCustom(search.trim());
                    setOpen(false);
                  }}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {createLabel(search.trim())}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
