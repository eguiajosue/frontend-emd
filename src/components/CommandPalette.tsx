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
import { usePermissions } from "@/hooks/usePermissions";
import { useMotionPreset } from "@/lib/motion";
import { getOrderClientName } from "@/lib/format";
import {
  History,
  Package,
  Plus,
  Search,
  Settings,
  UserRound,
  Users2,
} from "lucide-react";

/**
 * Command palette global del dashboard (Cmd+K / Ctrl+K). Navega a las
 * pantallas principales, abre "+ Nueva Orden" y busca pedidos por
 * cliente/descripción (click en un resultado va directo al detalle).
 *
 * Se monta una sola vez en `dashboard/layout.tsx`: escucha el atajo desde
 * cualquier pantalla del dashboard.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { isAdmin, canManageOperations, roles } = usePermissions();
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
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const go = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  const matchingOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return orders
      .filter(
        (o) =>
          getOrderClientName(o).toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q) ||
          String(o.id).includes(q)
      )
      .slice(0, 8);
  }, [orders, search]);

  const showUsuarios = isAdmin || roles.includes("superuser");
  const showClientes = isAdmin || roles.includes("recepcion");
  const showHistorial = isAdmin || roles.includes("recepcion");

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
            <Command shouldFilter={false} className="bg-transparent">
              <CommandInput
                placeholder="Ir a... o buscar un pedido por cliente/descripción"
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>Sin resultados.</CommandEmpty>

                {!search.trim() && (
                  <CommandGroup heading="Navegación">
                    <CommandItem onSelect={() => go("/dashboard/orders")}>
                      <Package className="mr-2 h-4 w-4" />
                      Ir a Pedidos
                    </CommandItem>
                    {showHistorial && (
                      <CommandItem onSelect={() => go("/dashboard/historial")}>
                        <History className="mr-2 h-4 w-4" />
                        Ir a Historial
                      </CommandItem>
                    )}
                    {showClientes && (
                      <CommandItem onSelect={() => go("/dashboard/clientes")}>
                        <Users2 className="mr-2 h-4 w-4" />
                        Ir a Clientes
                      </CommandItem>
                    )}
                    {showUsuarios && (
                      <CommandItem onSelect={() => go("/dashboard/usuarios")}>
                        <UserRound className="mr-2 h-4 w-4" />
                        Ir a Usuarios
                      </CommandItem>
                    )}
                    <CommandItem onSelect={() => go("/dashboard/configuracion")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Ir a Configuración
                    </CommandItem>
                    {canManageOperations && (
                      <CommandItem onSelect={() => go("/dashboard/orders?new=1")}>
                        <Plus className="mr-2 h-4 w-4" />+ Nueva Orden
                      </CommandItem>
                    )}
                  </CommandGroup>
                )}

                {search.trim() && (
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
