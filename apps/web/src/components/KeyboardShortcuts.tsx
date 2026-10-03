"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVisibleNavItems } from "@/hooks/useVisibleNavItems";
import { usePermissions } from "@/hooks/usePermissions";
import { homePathForRoles } from "@/lib/navMenu";
import {
  OPEN_SHORTCUTS_EVENT,
  SEQUENCE_TIMEOUT_MS,
  isTypingTarget,
  resolveGoShortcuts,
} from "@/lib/shortcuts";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border/60 bg-card px-2 font-sans text-xs font-medium text-foreground shadow-soft">
      {children}
    </kbd>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((key, index) => (
        <Fragment key={`${key}-${index}`}>
          {index > 0 && <span className="text-xs text-muted-foreground">luego</span>}
          <Kbd>{key}</Kbd>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Atajos globales del dashboard: `g` + letra para ir a una pantalla y `?`
 * para ver la lista. Se monta una vez en `dashboard/layout.tsx`, junto a la
 * paleta ⌘K. Ninguna tecla actúa mientras se escribe ni con un diálogo
 * abierto (ahí las letras son del diálogo).
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { data: session } = useSession();
  const { canManageOperations } = usePermissions();
  const navItems = useVisibleNavItems();
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const pendingG = useRef<number | null>(null);

  const goShortcuts = useMemo(
    () => resolveGoShortcuts(navItems, homePathForRoles(session?.user?.roles ?? [])),
    [navItems, session?.user?.roles]
  );
  const goRef = useRef(goShortcuts);
  goRef.current = goShortcuts;

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
        return;
      }

      const key = e.key.toLowerCase();
      if (pendingG.current != null && Date.now() - pendingG.current < SEQUENCE_TIMEOUT_MS) {
        pendingG.current = null;
        // La segunda tecla es siempre de la secuencia: sin esto "g n" además
        // abría "Nuevo pedido" (atajo N de Pedidos, que respeta defaultPrevented).
        e.preventDefault();
        const target = goRef.current.find((s) => s.key === key);
        if (target) router.push(target.url);
        return;
      }
      pendingG.current = key === "g" ? Date.now() : null;
    };
    const openHelp = () => setOpen(true);
    // Captura: corre antes que los atajos propios de cada pantalla.
    window.addEventListener("keydown", onKey, true);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, openHelp);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, openHelp);
    };
  }, [router]);

  const sections: { title: string; rows: { keys: string[]; label: string }[] }[] = [
    {
      title: "General",
      rows: [
        { keys: [isMac ? "⌘" : "Ctrl", "K"], label: "Buscar pantalla, pedido o cliente" },
        { keys: ["?"], label: "Ver estos atajos" },
        { keys: ["Esc"], label: "Cerrar ventana o modo TV" },
      ],
    },
    {
      title: "Ir a",
      rows: goShortcuts.map((s) => ({ keys: ["G", s.key.toUpperCase()], label: s.label })),
    },
    ...(canManageOperations
      ? [{ title: "En Pedidos", rows: [{ keys: ["N"], label: "Nuevo pedido" }] }]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>Funcionan en cualquier pantalla, salvo mientras se escribe.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="mb-2 text-label">
                {section.title}
              </h3>
              <ul className="divide-y divide-border/60 rounded-2xl bg-muted/60">
                {section.rows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{row.label}</span>
                    {row.keys.length === 2 && row.keys[0] === "G" ? (
                      <Keys keys={row.keys} />
                    ) : (
                      <span className="flex shrink-0 items-center gap-1">
                        {row.keys.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
