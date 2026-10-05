"use client"

import {
  ChevronDown,
  Download,
  EyeOff,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SlidersHorizontal,
  Star,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useSidebar } from "./ui/sidebar";
import { logout } from "@/lib/logout";
import { Button } from "./ui/button";
import { SimpleTooltip } from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ThemeRailSwitch } from "./ThemeToggle";
import { useChatUnreadCount } from "@/hooks/useChat";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";
import { useNavLayout } from "@/hooks/useNavLayout";
import { SPRING_STANDARD, useMotionPreset } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navMenu";
import { useOrderViewCounts } from "./SidebarOrderViews";

const ORDERS_URL = "/dashboard/orders";

/** Ancla de la sección "Barra lateral" en Configuración. */
export const SIDEBAR_SETTINGS_URL = "/dashboard/configuracion#barra-lateral";

/**
 * Espacio que deja el contenido a la izquierda en escritorio: ancho del riel
 * (3.75rem angosto / 14.5rem con títulos) + 1rem de margen a cada lado. Lo usa
 * `dashboard/layout.tsx` como variable CSS (`--rail-offset`).
 */
export const RAIL_OFFSET_COLLAPSED = "5.75rem";
export const RAIL_OFFSET_EXPANDED = "16.5rem";

/** Exportado también para `MobileMoreSheet.tsx`, que reutiliza este botón tal
 *  cual en vez de duplicar su JSX/lógica de "colapsado". */
export function ConfiguracionLink({ pathname }: { pathname: string }) {
  const active = pathname === "/dashboard/configuracion";
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  return (
    <Button
      variant="ghost"
      className={cn(
        "gap-2 mb-2",
        collapsed ? "mx-auto size-8 justify-center p-0" : "w-full justify-start",
        active && "bg-muted font-medium text-foreground"
      )}
      asChild
    >
      <Link href="/dashboard/configuracion" title={collapsed ? "Configuración" : undefined}>
        <Settings className="h-4 w-4 shrink-0" />
        {!collapsed && "Configuración"}
      </Link>
    </Button>
  );
}

/**
 * Botón discreto de "Instalar app", visible sólo cuando el navegador
 * disparó `beforeinstallprompt` (ver `useInstallPrompt`) — no hay forma de
 * saber si es instalable de antemano, así que el botón directamente no
 * existe hasta ese momento en vez de mostrarse deshabilitado.
 */
export function InstallAppButton() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  if (!canInstall) return null;

  return (
    <Button
      variant="ghost"
      className={cn(
        "gap-2 mb-2 text-primary hover:text-primary",
        collapsed ? "mx-auto size-8 justify-center p-0" : "w-full justify-start"
      )}
      onClick={promptInstall}
      title={collapsed ? "Instalar app" : undefined}
    >
      <Download className="h-4 w-4 shrink-0" />
      {!collapsed && "Instalar app"}
    </Button>
  );
}

/** Transición de ancho del riel: mismo tempo que `DURATION_STANDARD` y `EASE_OUT` (lib/motion.ts). */
const RAIL_TRANSITION =
  "transition-[width,border-radius] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

/** Segmento flotante del riel: píldora blanca vertical, como en la referencia. */
function RailSegment({
  className,
  expanded = false,
  children,
}: {
  className?: string;
  expanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center gap-1 rounded-[1.875rem] border border-border/60 bg-sidebar p-2 shadow-soft dark:border-border",
        RAIL_TRANSITION,
        expanded ? "w-[14.5rem] items-stretch" : "w-[3.75rem]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Contador sobre un ícono del riel (no leídos, vencidos). */
function RailCount({
  value,
  tone = "primary",
  label,
  inline = false,
}: {
  value: number;
  tone?: "primary" | "danger";
  label?: string;
  inline?: boolean;
}) {
  return (
    <span
      title={label}
      className={cn(
        "pointer-events-none z-10 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none",
        inline
          ? "relative transition-opacity group-hover/item:opacity-0 group-focus-within/item:opacity-0"
          : "absolute -right-0.5 -top-0.5 ring-2 ring-sidebar",
        tone === "danger" ? "bg-rose-600 text-white" : "bg-primary text-primary-foreground"
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

const COLLAPSED_GROUPS_KEY = "emd:nav-collapsed-groups";

/**
 * Grupos plegados en el riel expandido. Es comodidad de este navegador (no
 * viaja con la cuenta), así que vive en localStorage y no en `navPreferences`.
 */
function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) ?? "[]");
      if (Array.isArray(parsed)) setCollapsed(parsed.filter((v): v is string => typeof v === "string"));
    } catch {
      // Sin almacenamiento o valor corrupto: todo desplegado.
    }
  }, []);
  const toggle = useCallback((label: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
      try {
        localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // No pasa nada si no se puede guardar.
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

interface RailItemProps {
  item: NavItem;
  expanded: boolean;
  active: boolean;
  unread: number;
  overdue: number;
  favorite: boolean;
  reducedMotion: boolean;
  onToggleFavorite: () => void;
  onHide: () => void;
}

/**
 * Un destino del riel. Angosto: ícono con tooltip. Expandido: ícono + título,
 * y al pasar el mouse (o con foco) una estrella para fijar y "⋯" con más
 * opciones. En ambos modos, clic derecho (o Shift+F10) abre el mismo menú.
 */
function RailItem({
  item,
  expanded,
  active,
  unread,
  overdue,
  favorite,
  reducedMotion,
  onToggleFavorite,
  onHide,
}: RailItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const favoriteLabel = favorite ? "Quitar de favoritos" : "Agregar a favoritos";

  const link = (
    <Link
      ref={linkRef}
      href={item.url}
      aria-label={expanded ? undefined : item.title}
      aria-current={active ? "page" : undefined}
      data-tour={item.title === "Ayuda" ? "help-link" : undefined}
      className={cn(
        "relative flex items-center rounded-full text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        expanded ? "h-10 w-full gap-3 pl-3 pr-2" : "h-11 w-11 justify-center",
        active && "text-sidebar-primary-foreground hover:bg-transparent hover:text-sidebar-primary-foreground",
        !active && unread > 0 && "text-primary"
      )}
    >
      {active && (
        <motion.span
          layoutId="rail-active-indicator"
          className="pointer-events-none absolute inset-0 -z-0 rounded-full bg-sidebar-primary"
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
        />
      )}
      <motion.span
        aria-hidden
        className="relative flex shrink-0"
        animate={unread > 0 && !reducedMotion ? { rotate: [0, -10, 8, -5, 0] } : { rotate: 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <item.icon className="h-[1.15rem] w-[1.15rem]" />
      </motion.span>
      {expanded && (
        <>
          <span className="relative min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            {item.title}
          </span>
          {item.url === ORDERS_URL && overdue > 0 ? (
            <RailCount
              inline
              value={overdue}
              tone="danger"
              label={`${overdue} vencido${overdue === 1 ? "" : "s"}`}
            />
          ) : null}
          {unread > 0 ? <RailCount inline value={unread} /> : null}
        </>
      )}
    </Link>
  );

  return (
    <li
      className={cn("group/item relative", expanded && "w-full")}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
    >
      {expanded ? link : <SimpleTooltip label={item.title} side="right">{link}</SimpleTooltip>}

      {!expanded && item.url === ORDERS_URL && overdue > 0 ? (
        <RailCount value={overdue} tone="danger" label={`${overdue} vencido${overdue === 1 ? "" : "s"}`} />
      ) : null}
      {!expanded && unread > 0 ? <RailCount value={unread} /> : null}

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        {expanded ? (
          // Acciones rápidas: aparecen con hover o con foco dentro de la fila.
          <span
            className={cn(
              "absolute inset-y-0 right-1 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 group-focus-within/item:opacity-100",
              menuOpen && "opacity-100",
              active ? "text-sidebar-primary-foreground" : "text-muted-foreground"
            )}
          >
            <button
              type="button"
              aria-label={`${favoriteLabel}: ${item.title}`}
              aria-pressed={favorite}
              onClick={onToggleFavorite}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                active ? "hover:bg-white/15" : "hover:bg-sidebar hover:text-foreground",
                favorite && !active && "text-amber-500 hover:text-amber-500"
              )}
            >
              <Star className={cn("h-3.5 w-3.5", favorite && "fill-current")} aria-hidden />
            </button>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Opciones de ${item.title}`}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active ? "hover:bg-white/15" : "hover:bg-sidebar hover:text-foreground"
                )}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
          </span>
        ) : (
          // Riel angosto: no hay lugar para botones; el menú se abre con clic
          // derecho y se ancla al ícono.
          <DropdownMenuTrigger asChild>
            <span aria-hidden className="pointer-events-none absolute inset-0" />
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={expanded ? 12 : 14}
          className="w-56"
          onCloseAutoFocus={(e) => {
            if (!expanded) {
              e.preventDefault();
              linkRef.current?.focus();
            }
          }}
        >
          <DropdownMenuItem onSelect={onToggleFavorite}>
            <Star className={cn(favorite && "fill-current text-amber-500")} />
            {favoriteLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onHide}>
            <EyeOff />
            Ocultar de la barra
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={SIDEBAR_SETTINGS_URL}>
              <SlidersHorizontal />
              Personalizar barra
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

interface RailSectionProps {
  label: string;
  /** Ícono junto al nombre (Favoritos). */
  icon?: React.ComponentType<{ className?: string }>;
  expanded: boolean;
  folded: boolean;
  onToggleFold: () => void;
  containsActive: boolean;
  reducedMotion: boolean;
  children: React.ReactNode;
}

/**
 * Sección del riel. Expandido: encabezado con su nombre que la pliega o
 * despliega. Angosto: sólo la lista de íconos (sin encabezado ni plegado; un
 * separador entre secciones basta).
 */
function RailSection({
  label,
  icon: Icon,
  expanded,
  folded,
  onToggleFold,
  containsActive,
  reducedMotion,
  children,
}: RailSectionProps) {
  const listId = `rail-section-${label.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
  if (!expanded) {
    return (
      <ul aria-label={label} className="flex flex-col items-center gap-1">
        {children}
      </ul>
    );
  }
  const open = !folded;
  return (
    <div className="w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggleFold}
        className="group/section flex h-8 w-full items-center gap-2 rounded-full pl-3 pr-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        {Icon && <Icon className="h-3 w-3 shrink-0 fill-current text-amber-500" />}
        <span className="truncate">{label}</span>
        {!open && containsActive && (
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 group-hover/section:opacity-100 motion-reduce:transition-none",
            !open && "-rotate-90"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id={listId}
            aria-label={label}
            key="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : SPRING_STANDARD}
            className="flex flex-col gap-0.5 overflow-hidden"
          >
            {children}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Riel de escritorio: tres píldoras flotantes sobre el lienzo — tema arriba,
 * navegación al medio y cuenta abajo. La navegación respeta las preferencias
 * del usuario (`navPreferences`): Favoritos arriba, orden propio por grupo y
 * ocultos fuera. Angosto muestra sólo íconos con tooltip; expandido (botón
 * del pie o Ctrl+B) muestra títulos y grupos plegables. En móvil no existe:
 * navega `MobileTabBar` + "Más".
 */
export function AppSidebar() {
  const pathname = usePathname();

  // Badges de no leídos: misma query que el chat y la campanita, invalidada
  // en vivo por `useSocket`.
  const chatUnread = useChatUnreadCount();
  const { count: notificationsUnread } = useUnreadNotificationsCount();
  const { reduced: reducedMotion } = useMotionPreset();
  const { roleVisibleGroups: roleGroups, favorites, groups, activeUrl, nav } = useNavLayout();
  const expanded = nav.expanded;
  const { collapsed: foldedGroups, toggle: toggleFold } = useCollapsedGroups();

  const showsOrders = roleGroups.some((group) => group.items.some((item) => item.url === ORDERS_URL));
  // Los vencidos se avisan como badge sobre el ícono de Pedidos.
  const { overdue } = useOrderViewCounts(showsOrders);
  const { isMobile } = useSidebar();
  // Al entrar a una pantalla del fondo del menú, su ícono se trae a la vista.
  const navScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    navScrollRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeUrl]);

  // Todos los hooks de arriba se llaman siempre (regla de hooks); en móvil
  // sólo se omite el JSX.
  if (isMobile) return null;

  const settingsActive = pathname === "/dashboard/configuracion";
  const favoriteUrls = new Set(favorites.map((item) => item.url));

  const hideItem = (item: NavItem) => {
    nav.setHidden(item.url, true);
    toast(`«${item.title}» ya no aparece en la barra.`, {
      action: { label: "Deshacer", onClick: () => nav.setHidden(item.url, false) },
    });
  };

  const renderItem = (item: NavItem) => {
    const unread =
      item.url === "/dashboard/chat"
        ? chatUnread
        : item.url === "/dashboard/notificaciones"
        ? notificationsUnread
        : 0;
    return (
      <RailItem
        key={item.url}
        item={item}
        expanded={expanded}
        active={activeUrl === item.url}
        unread={unread}
        overdue={overdue}
        favorite={favoriteUrls.has(item.url)}
        reducedMotion={reducedMotion}
        onToggleFavorite={() => nav.toggleFavorite(item.url)}
        onHide={() => hideItem(item)}
      />
    );
  };

  const sections = [
    ...(favorites.length > 0
      ? [{ label: "Favoritos", icon: Star, items: favorites }]
      : []),
    ...groups.map((group) => ({ label: group.groupLabel, icon: undefined, items: group.items })),
  ];

  const settingsLink = (
    <Link
      href="/dashboard/configuracion"
      aria-label={expanded ? undefined : "Configuración"}
      aria-current={settingsActive ? "page" : undefined}
      className={cn(
        "flex h-10 items-center rounded-full text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        expanded ? "w-full gap-3 pl-3 pr-2 text-sm font-medium" : "w-10 justify-center",
        settingsActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
      )}
    >
      <Settings className="h-[1.15rem] w-[1.15rem] shrink-0" aria-hidden={expanded} />
      {expanded && <span className="truncate animate-in fade-in-0 duration-200">Configuración</span>}
    </Link>
  );

  const toggleLabel = expanded ? "Contraer barra lateral" : "Expandir barra lateral";

  return (
    <aside
      aria-label="Navegación principal"
      data-expanded={expanded ? "true" : "false"}
      className="fixed bottom-4 left-4 top-[5.25rem] z-30 hidden flex-col items-start gap-3 md:flex"
    >
      <RailSegment
        expanded={expanded}
        className={cn(expanded && "flex-row justify-center rounded-full py-1.5")}
      >
        <span data-tour="theme-toggle">
          <ThemeRailSwitch orientation={expanded ? "horizontal" : "vertical"} />
        </span>
      </RailSegment>

      <RailSegment expanded={expanded} className="min-h-0 shrink overflow-hidden px-0 py-0">
        <nav
          id="rail-nav"
          ref={navScrollRef}
          data-tour="sidebar-nav"
          aria-label="Secciones"
          className={cn(
            "flex min-h-0 w-full flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 py-2 [scrollbar-width:none]",
            expanded ? "items-stretch" : "items-center"
          )}
        >
          {sections.map((section, index) => (
            <Fragment key={section.label}>
              {index > 0 &&
                (expanded ? (
                  <span aria-hidden className="h-1 shrink-0" />
                ) : (
                  <span aria-hidden className="my-1 h-px w-6 shrink-0 bg-border" />
                ))}
              <RailSection
                label={section.label}
                icon={section.icon}
                expanded={expanded}
                folded={foldedGroups.includes(section.label)}
                onToggleFold={() => toggleFold(section.label)}
                containsActive={section.items.some((item) => item.url === activeUrl)}
                reducedMotion={reducedMotion}
              >
                {section.items.map(renderItem)}
              </RailSection>
            </Fragment>
          ))}
        </nav>
      </RailSegment>

      <div className="flex-1" aria-hidden />

      <RailSegment expanded={expanded}>
        <FooterButton
          expanded={expanded}
          label={expanded ? "Contraer" : "Expandir"}
          tooltip={`${expanded ? "Ocultar" : "Mostrar"} títulos (Ctrl+B)`}
          ariaLabel={toggleLabel}
          icon={expanded ? PanelLeftClose : PanelLeftOpen}
          onClick={() => nav.setExpanded(!expanded)}
          extraProps={{ "aria-expanded": expanded, "aria-controls": "rail-nav" }}
        />
        {expanded ? settingsLink : (
          <SimpleTooltip label="Configuración" side="right">
            {settingsLink}
          </SimpleTooltip>
        )}
        <FooterButton
          expanded={expanded}
          label="Cerrar sesión"
          tooltip="Cerrar sesión"
          ariaLabel="Cerrar sesión"
          icon={LogOut}
          onClick={() => void logout()}
          className="hover:bg-destructive/10 hover:text-destructive"
        />
      </RailSegment>
    </aside>
  );
}

/** Botón del pie del riel: ícono solo (con tooltip) o ícono + texto. */
function FooterButton({
  expanded,
  label,
  tooltip,
  ariaLabel,
  icon: Icon,
  onClick,
  className,
  extraProps,
}: {
  expanded: boolean;
  label: string;
  tooltip: string;
  ariaLabel: string;
  icon: LucideIcon;
  onClick: () => void;
  className?: string;
  extraProps?: Record<string, unknown>;
}) {
  const button = (
    <Button
      variant="ghost"
      aria-label={ariaLabel}
      onClick={onClick}
      {...extraProps}
      className={cn(
        "h-10 rounded-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        expanded ? "w-full justify-start gap-3 pl-3 pr-2 text-sm font-medium" : "w-10 p-0",
        className
      )}
    >
      <Icon className="!size-[1.15rem] shrink-0" aria-hidden />
      {expanded && <span className="truncate animate-in fade-in-0 duration-200">{label}</span>}
    </Button>
  );
  return expanded ? button : <SimpleTooltip label={tooltip} side="right">{button}</SimpleTooltip>;
}
