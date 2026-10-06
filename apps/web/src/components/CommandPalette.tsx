"use client";

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
import { useEntityList } from "@/hooks/useEntity";
import { useVisibleNavItems } from "@/hooks/useVisibleNavItems";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useMotionPreset } from "@/lib/motion";
import { getOrderClientName } from "@/lib/format";
import { openShortcutsHelp } from "@/lib/shortcuts";
import { pushRecent, readRecents, type PaletteRecent } from "@/lib/paletteRecents";
import type { Client } from "@/types";
import {
  Clock,
  Keyboard,
  Monitor,
  Moon,
  Package,
  Plus,
  Settings,
  Sun,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Evento global para abrir la paleta desde un botón (ej. "Buscar" del header). */
export const OPEN_COMMAND_PALETTE_EVENT = "emd:open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}

const ORDERS_URL = "/dashboard/orders";
const TASKS_URL = "/dashboard/tareas";
const CLIENTS_URL = "/dashboard/clientes";
const CONFIG_URL = "/dashboard/configuracion";

function clientName(client: Client): string {
  return `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || `Cliente #${client.id}`;
}

interface PaletteAction {
  value: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  /** Palabras extra con las que también se encuentra al escribir. */
  keywords?: string;
  run: () => void;
}

/**
 * Command palette global del dashboard (Cmd+K / Ctrl+K, o el botón "Buscar"
 * del header). Navega a cualquier pantalla del menú del rol (misma fuente que
 * sidebar y barra móvil: `useVisibleNavItems`), ejecuta acciones (nuevo
 * pedido/cliente, modo TV, tema, atajos), recuerda los últimos destinos y
 * busca pedidos y clientes.
 *
 * Se monta una sola vez en `dashboard/layout.tsx`: escucha el atajo desde
 * cualquier pantalla del dashboard.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recents, setRecents] = useState<PaletteRecent[]>([]);
  const router = useRouter();
  const { canManageOperations } = usePermissions();
  const navItems = useVisibleNavItems();
  const { reduced } = useMotionPreset();
  const { resolvedTheme, setTheme } = useTheme();
  const { updatePreferences } = useUserPreferences();

  const visibleUrls = useMemo(() => new Set(navItems.map((item) => item.url)), [navItems]);
  const canSeeOrders = visibleUrls.has(ORDERS_URL);
  const canSeeClients = visibleUrls.has(CLIENTS_URL);
  const canSeeTasks = visibleUrls.has(TASKS_URL);

  // Sólo se piden pedidos/clientes con la paleta abierta: evita un fetch
  // extra en cada pantalla del dashboard sólo para tener la búsqueda lista.
  const { data: orders } = useOrders({ enabled: open });
  const { data: clients } = useEntityList<Client>("clients", { enabled: open && canSeeClients });

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
    if (open) setRecents(readRecents());
    else setSearch("");
  }, [open]);

  const go = (url: string, recent?: Omit<PaletteRecent, "url">) => {
    if (recent) pushRecent({ ...recent, url });
    setOpen(false);
    router.push(url);
  };

  const query = search.trim().toLowerCase();
  const matches = (text: string) => !query || text.toLowerCase().includes(query);

  const isDark = resolvedTheme === "dark";
  const actions: PaletteAction[] = [
    ...(canManageOperations && canSeeOrders
      ? [
          {
            value: "action:new-order",
            label: "Nuevo pedido",
            icon: Plus,
            hint: "N",
            keywords: "crear orden alta",
            run: () => go(`${ORDERS_URL}?new=1`),
          },
        ]
      : []),
    ...(canManageOperations && canSeeClients
      ? [
          {
            value: "action:new-client",
            label: "Nuevo cliente",
            icon: UserPlus,
            keywords: "crear alta",
            run: () => go(`${CLIENTS_URL}?new=1`),
          },
        ]
      : []),
    ...(canSeeOrders
      ? [
          {
            value: "action:tv",
            label: "Modo TV",
            icon: Monitor,
            keywords: "pedidos pantalla completa tele taller muro",
            run: () => go(`${ORDERS_URL}?tv=1`),
          },
        ]
      : []),
    ...(canSeeTasks
      ? [
          {
            value: "action:tasks-tv",
            label: "Modo TV de tareas",
            icon: Monitor,
            keywords: "tareas área pantalla completa tele taller tablero",
            run: () => go(`${TASKS_URL}?tv=1`),
          },
        ]
      : []),
    {
      value: "action:theme",
      label: isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
      icon: isDark ? Sun : Moon,
      keywords: "tema oscuro claro apariencia",
      run: () => {
        const next = isDark ? "light" : "dark";
        setTheme(next);
        updatePreferences({ themePreference: next });
        setOpen(false);
      },
    },
    {
      value: "action:shortcuts",
      label: "Atajos de teclado",
      icon: Keyboard,
      hint: "?",
      keywords: "teclas ayuda",
      run: () => {
        setOpen(false);
        openShortcutsHelp();
      },
    },
  ];
  const matchingActions = actions.filter((a) => matches(`${a.label} ${a.keywords ?? ""}`));

  // Pantallas: se filtran también al escribir ("hoja" → Hoja de Materiales).
  const pages = useMemo(
    () => [
      ...navItems.map((item) => ({ title: item.title, group: item.group, url: item.url, icon: item.icon })),
      { title: "Configuración", group: "Cuenta", url: CONFIG_URL, icon: Settings },
    ],
    [navItems]
  );
  const pageIcons = useMemo(() => new Map(pages.map((p) => [p.url, p.icon])), [pages]);
  const matchingPages = pages.filter((p) => matches(`${p.title} ${p.group}`));

  // Recientes sólo sin búsqueda, y sólo lo que este rol puede abrir hoy
  // (el navegador puede ser compartido entre usuarios del taller).
  const visibleRecents = query
    ? []
    : recents.filter((r) =>
        r.kind === "page"
          ? pageIcons.has(r.url)
          : r.kind === "client"
          ? canSeeClients && canSeeOrders
          : canSeeOrders
      );

  const matchingOrders = useMemo(() => {
    if (!query) return [];
    return orders
      .filter(
        (o) =>
          getOrderClientName(o).toLowerCase().includes(query) ||
          o.description?.toLowerCase().includes(query) ||
          String(o.id).includes(query)
      )
      .slice(0, 8);
  }, [orders, query]);

  const matchingClients = useMemo(() => {
    if (!query || !canSeeOrders) return [];
    return clients
      .filter((c) => `${clientName(c)} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(query))
      .slice(0, 5);
  }, [clients, query, canSeeOrders]);

  // Con `shouldFilter={false}` cmdk no re-elige el resaltado al filtrar: si
  // el ítem resaltado desaparece, Enter no hace nada. Se fija a mano al
  // primer resultado visible (en el orden en que se pintan los grupos).
  const firstValue =
    (visibleRecents[0] && `recent:${visibleRecents[0].id}`) ||
    matchingActions[0]?.value ||
    matchingPages[0]?.url ||
    (matchingOrders[0] && `order-${matchingOrders[0].id}`) ||
    (matchingClients[0] && `client-${matchingClients[0].id}`) ||
    "";
  const [selected, setSelected] = useState("");
  useEffect(() => setSelected(firstValue), [firstValue]);

  const recentIcon = (recent: PaletteRecent): LucideIcon =>
    recent.kind === "page" ? pageIcons.get(recent.url) ?? Clock : recent.kind === "order" ? Package : Users;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 pt-[12vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.01 : 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="elevation-2 mx-4 w-full max-w-xl overflow-hidden rounded-[1.5rem] border border-border/60 bg-popover shadow-soft-lg"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              shouldFilter={false}
              // Mismo lenguaje que el resto: buscador alto con borde suave,
              // grupos con aire y la opción elegida en píldora gris (no color).
              className={cn(
                "bg-transparent",
                "[&_[cmdk-input-wrapper]]:border-border/60 [&_[cmdk-input-wrapper]]:px-5 [&_[cmdk-input]]:h-14 [&_[cmdk-input]]:text-[0.9375rem]",
                "[&_[cmdk-list]]:max-h-[min(24rem,60vh)] [&_[cmdk-list]]:p-2",
                "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2",
                "[&_[cmdk-item]]:rounded-full [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item][data-selected=true]]:bg-muted [&_[cmdk-item][data-selected=true]]:text-foreground"
              )}
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
                <CommandEmpty>Sin resultados para &ldquo;{search.trim()}&rdquo;.</CommandEmpty>

                {visibleRecents.length > 0 && (
                  <CommandGroup heading="Recientes">
                    {visibleRecents.map((recent) => {
                      const Icon = recentIcon(recent);
                      return (
                        <CommandItem
                          key={recent.id}
                          value={`recent:${recent.id}`}
                          onSelect={() => go(recent.url, recent)}
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          <span className="truncate">{recent.label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {matchingActions.length > 0 && (
                  <CommandGroup heading="Acciones">
                    {matchingActions.map((action) => (
                      <CommandItem key={action.value} value={action.value} onSelect={action.run}>
                        <action.icon className="mr-2 h-4 w-4" />
                        {action.label}
                        {action.hint && (
                          <kbd className="ml-auto rounded-full border border-border/60 bg-card px-2 py-0.5 font-sans text-xs text-muted-foreground">
                            {action.hint}
                          </kbd>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {matchingPages.length > 0 && (
                  <CommandGroup heading="Ir a">
                    {matchingPages.map((page) => (
                      <CommandItem
                        key={page.url}
                        value={page.url}
                        onSelect={() => go(page.url, { id: `page:${page.url}`, kind: "page", label: page.title })}
                      >
                        <page.icon className="mr-2 h-4 w-4" />
                        {page.title}
                        <span className="ml-auto text-xs text-muted-foreground">{page.group}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {matchingOrders.length > 0 && (
                  <CommandGroup heading="Pedidos">
                    {matchingOrders.map((order) => {
                      const label = `#${order.id} · ${getOrderClientName(order)} — ${order.description}`;
                      return (
                        <CommandItem
                          key={order.id}
                          value={`order-${order.id}`}
                          onSelect={() =>
                            go(`${ORDERS_URL}?openOrderId=${order.id}`, {
                              id: `order:${order.id}`,
                              kind: "order",
                              label,
                            })
                          }
                        >
                          <Package className="mr-2 h-4 w-4" />
                          <span className="truncate">{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {matchingClients.length > 0 && (
                  <CommandGroup heading="Clientes">
                    {matchingClients.map((client) => {
                      const name = clientName(client);
                      return (
                        <CommandItem
                          key={client.id}
                          value={`client-${client.id}`}
                          onSelect={() =>
                            go(`${ORDERS_URL}?clientId=${client.id}`, {
                              id: `client:${client.id}`,
                              kind: "client",
                              label: `Pedidos de ${name}`,
                            })
                          }
                        >
                          <Users className="mr-2 h-4 w-4" />
                          <span className="truncate">{name}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">Ver sus pedidos</span>
                        </CommandItem>
                      );
                    })}
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
