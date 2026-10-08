"use client";

import { useState, type FormEvent } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Atajos del muro de pedidos (ver `useOrderKeyboardNav`). */
export const ORDER_SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["←", "→"], label: "Pedido anterior / siguiente (también J y K)" },
  { keys: ["↑", "↓"], label: "Pedido de arriba / abajo" },
  { keys: ["Enter"], label: "Dar el siguiente paso al pedido elegido" },
  { keys: ["O"], label: "Abrir el detalle del pedido" },
  { keys: ["Z"], label: "Deshacer el último cambio" },
  { keys: ["/"], label: "Ir a un pedido por número" },
  { keys: ["?"], label: "Ver esta ayuda" },
];

function Kbd({ children, large }: { children: string; large?: boolean }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.75em] items-center justify-center rounded-md border border-border bg-muted px-1.5 font-sans font-medium text-foreground",
        large ? "h-8 text-sm" : "h-6 text-xs"
      )}
    >
      {children}
    </kbd>
  );
}

export function OrderShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>Para cambiar estados sin soltar el teclado.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2.5">
          {ORDER_SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-sm">
              <span className="flex w-24 shrink-0 gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
              <span className="text-muted-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** "Ir al pedido #": el número y Enter. */
export function OrderJumpDialog({
  open,
  onOpenChange,
  onJump,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJump: (orderId: number) => void;
}) {
  const [value, setValue] = useState("");
  const id = Number(value.replace(/\D/g, ""));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    onJump(id);
    setValue("");
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setValue("");
        onOpenChange(next);
      }}
    >
      {/* Al cerrar, el foco se queda en la tarjeta elegida (no vuelve al botón de antes). */}
      <DialogContent className="max-w-sm" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Ir a un pedido</DialogTitle>
          <DialogDescription>Escribe el número y presiona Enter.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex gap-2">
          <Input
            autoFocus
            inputMode="numeric"
            placeholder="#1234"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Número de pedido"
          />
          <Button type="submit" disabled={!id}>
            Ir
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Franja con los atajos principales (Modo TV) o botón "Atajos" (vista Lista). */
export function OrderShortcutHints({ large = false, onHelp }: { large?: boolean; onHelp: () => void }) {
  if (!large) {
    return (
      <Button variant="ghost" size="sm" className="hidden gap-1.5 text-muted-foreground sm:inline-flex" onClick={onHelp}>
        <Keyboard className="h-4 w-4" />
        Atajos
      </Button>
    );
  }
  const main = [
    { keys: ["←", "→", "↑", "↓"], label: "elegir" },
    { keys: ["Enter"], label: "siguiente paso" },
    { keys: ["Z"], label: "deshacer" },
    { keys: ["/"], label: "buscar #" },
    { keys: ["?"], label: "ayuda" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Atajos de teclado">
      {main.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          {s.keys.map((k) => (
            <Kbd key={k} large>
              {k}
            </Kbd>
          ))}
          <span className="ml-1">{s.label}</span>
        </span>
      ))}
    </div>
  );
}
