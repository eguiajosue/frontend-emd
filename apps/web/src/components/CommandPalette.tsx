"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useOrders } from "@/hooks/useOrders";
import { useVisibleNavItems } from "@/hooks/useVisibleNavItems";
import { usePermissions } from "@/hooks/usePermissions";
import { useMotionPreset } from "@/lib/motion";
import { getOrderClientName } from "@/lib/format";
import { Plus, Search, Settings } from "lucide-react";

/** Evento global para abrir la paleta desde un botón (ej. "Buscar" del header). */
export const OPEN_COMMAND_PALETTE_EVENT = "emd:open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}

/**
 * Command palette global del dashboard (Cmd+K / Ctrl+K, o el botón "Buscar"
 * del header). Navega a cualquier pantalla del menú del rol (misma fuente que
 * sidebar y barra móvil: `useVisibleNavItems`), abre "+ Nueva Orden" y busca
 * pedidos por cliente/descripción/número.
 *
 * Se monta una sola vez en `dashboard/layout.tsx`: escucha el atajo desde
 * cualquier pantalla del dashboard.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { canManageOperations } = usePermissions();
  const navItems = useVisibleNavItems();
  const { reduced } = useMotionPreset();
  // Sólo se pide la lista de pedidos cuando el palette está abierto: evita un
  // fetch extra en cada pantalla del dashboard sólo para tener la búsqueda lista.
  const { data: orders } = useOrders({ enabled: open });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const openFromButton = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openFromButton);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openFromButton);
    };
  }, []);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const go = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  const query = search.trim().toLowerCase();

  // Pantallas: se filtran también al escribir ("hoja" → Hoja de Materiales).
  const matchingPages = useMemo(() => {
    const pages = [
      ...navItems.map((item) => ({ title: item.title, group: item.group, url: item.url, icon: item.icon })),
      { title: "Configuración", group: "Cuenta", url: "/dashboard/configuracion", icon: Settings },
    ];
    if (!query) return pages;
    return pages.filter((p) => `${p.title} ${p.group}`.toLowerCase().includes(query));
  }, [navItems, query]);

  // Con `shouldFilter={false}` cmdk no re-elige el resaltado al filtrar: si
  // el ítem resaltado desaparece, Enter no hace nada. Se fija a mano al
  // primer resultado visible en cada cambio de búsqueda.
  const [selected, setSelected] = useState("");

  const matchingOrders = useMemo(() => {
    const q = query;
    if (!q) return [];
    return orders
      .filter(
        (o) =>
          getOrderClientName(o).toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q) ||
          String(o.id).includes(q)
      )
      .slice(0, 8);
  }, [orders, query]);

  useEffect(() => {
    const first =
      (canManageOperations && !query ? "action:new-order" : null) ??
      matchingPages[0]?.url ??
      (matchingOrders[0] ? `order-${matchingOrders[0].id}` : "");
    setSelected(first);
  }, [query, canManageOperations, matchingPages, matchingOrders]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.01 : 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="elevation-2 bg-popover w-full max-w-lg overflow-hidden rounded-xl border border-border shadow-2xl"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              shouldFilter={false}
              className="bg-transparent"
              value={selected}
              onValueChange={setSelected}
            >
              <CommandInput
                autoFocus
                placeholder="Buscar pantalla, pedido o cliente…"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>Sin resultados.</CommandEmpty>

                {canManageOperations && !query && (
                  <CommandGroup heading="Acciones">
                    <CommandItem value="action:new-order" onSelect={() => go("/dashboard/orders?new=1")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nuevo pedido
                      <kbd className="ml-auto text-xs text-muted-foreground">N</kbd>
                    </CommandItem>
                  </CommandGroup>
                )}

                {matchingPages.length > 0 && (
                  <CommandGroup heading="Ir a">
                    {matchingPages.map((page) => (
                      <CommandItem key={page.url} value={page.url} onSelect={() => go(page.url)}>
                        <page.icon className="mr-2 h-4 w-4" />
                        {page.title}
                        <span className="ml-auto text-xs text-muted-foreground">{page.group}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {matchingOrders.length > 0 && (
                  <CommandGroup heading="Pedidos">
                    {matchingOrders.map((order) => (
                      <CommandItem
                        key={order.id}
                        value={`order-${order.id}`}
                        onSelect={() => go(`/dashboard/orders?openOrderId=${order.id}`)}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        <span className="truncate">
                          #{order.id} · {getOrderClientName(order)} — {order.description}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
