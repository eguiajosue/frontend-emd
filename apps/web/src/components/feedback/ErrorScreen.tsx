"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Compass,
  Copy,
  KeyRound,
  Link2Off,
  Lock,
  Hourglass,
  RefreshCw,
  ServerCrash,
  Timer,
  TriangleAlert,
  Wrench,
  WifiOff,
  Home,
  LogIn,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { DUR, EASE_OUT } from "@/lib/motion";
import { classifyError, ERROR_CATALOG, type ErrorKind } from "@/lib/errorMessages";
import { cn } from "@/lib/utils";

/**
 * Pantalla de error de marca para cualquier código (404, 401, 403, 429, 500,
 * 503, sin conexión y enlaces públicos vencidos/inválidos/revocados).
 *
 * - `layout="page"`: pantalla completa (raíz, login, enlaces públicos).
 * - `layout="section"`: dentro del dashboard (mantiene sidebar y topbar).
 * - `layout="inline"`: tarjeta compacta dentro de un panel o diálogo.
 *
 * No depende de providers (ni sesión, ni tema, ni react-query): sirve también
 * para `global-error.tsx`. Con `plainLinks` usa `<a>` en vez de `next/link`
 * para forzar una carga completa cuando el router mismo puede estar roto.
 */

export type ErrorScreenVariant =
  | "404"
  | "401"
  | "403"
  | "429"
  | "500"
  | "503"
  | "offline"
  | "expired"
  | "revoked"
  | "invalid";

export interface ErrorScreenAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
}

interface VariantSpec {
  /** Texto grande decorativo (código). Vacío = sólo ícono. */
  code: string;
  icon: LucideIcon;
  /** Color del círculo del ícono (relleno suave + tinta legible, AA en ambos temas). */
  tone: string;
  title: string;
  description: string;
  alert: boolean;
  primary?: ErrorScreenAction;
}

const TONE = {
  cyan: "bg-cyan-soft text-cyan-ink",
  magenta: "bg-magenta-soft text-magenta-ink",
  lime: "bg-lime-soft text-lime-ink",
  navy: "bg-navy-50 text-navy-600 dark:bg-secondary dark:text-primary",
  danger: "bg-destructive/10 text-destructive",
} as const;

const HOME: ErrorScreenAction = { label: "Volver al inicio", href: "/dashboard", icon: Home };
const LOGIN: ErrorScreenAction = { label: "Iniciar sesión", href: "/login", icon: LogIn };

export const ERROR_SCREEN_VARIANTS: Record<ErrorScreenVariant, VariantSpec> = {
  "404": {
    code: "404",
    icon: Compass,
    tone: TONE.cyan,
    title: "No encontramos esta página",
    description: "El enlace puede estar mal escrito o la página se movió. Revisa la dirección o vuelve al inicio.",
    alert: false,
    primary: HOME,
  },
  "401": {
    code: "401",
    icon: KeyRound,
    tone: TONE.magenta,
    title: ERROR_CATALOG.unauthorized.title,
    description: ERROR_CATALOG.unauthorized.description,
    alert: false,
    primary: LOGIN,
  },
  "403": {
    code: "403",
    icon: Lock,
    tone: TONE.magenta,
    title: ERROR_CATALOG.forbidden.title,
    description: ERROR_CATALOG.forbidden.description,
    alert: false,
    primary: HOME,
  },
  "429": {
    code: "429",
    icon: Timer,
    tone: TONE.lime,
    title: ERROR_CATALOG.rateLimited.title,
    description: ERROR_CATALOG.rateLimited.description,
    alert: true,
  },
  "500": {
    code: "500",
    icon: ServerCrash,
    tone: TONE.danger,
    title: "Algo salió mal",
    description: "Ocurrió un error inesperado de nuestro lado. Ya quedó registrado; puedes reintentar o volver al inicio.",
    alert: true,
  },
  "503": {
    code: "503",
    icon: Wrench,
    tone: TONE.cyan,
    title: ERROR_CATALOG.maintenance.title,
    description: ERROR_CATALOG.maintenance.description,
    alert: true,
  },
  offline: {
    code: "",
    icon: WifiOff,
    tone: TONE.navy,
    title: "Sin conexión",
    description:
      "No hay red en este momento. Lo que ya cargaste sigue disponible y los cambios pendientes se enviarán solos cuando vuelva la conexión.",
    alert: true,
  },
  expired: {
    code: "",
    icon: Hourglass,
    tone: TONE.lime,
    title: "Este enlace ya venció",
    description: "Por seguridad, los enlaces dejan de funcionar después de un tiempo. Pídenos uno nuevo y con gusto te lo mandamos.",
    alert: false,
  },
  revoked: {
    code: "",
    icon: Link2Off,
    tone: TONE.magenta,
    title: "Este enlace ya no está activo",
    description: "Quien te lo compartió lo desactivó. Si aún lo necesitas, pídele uno nuevo.",
    alert: false,
  },
  invalid: {
    code: "",
    icon: Link2Off,
    tone: TONE.cyan,
    title: "No encontramos este enlace",
    description: "Puede que esté incompleto o mal copiado. Revisa que sea el enlace completo o pide uno nuevo.",
    alert: false,
  },
};

/** Variante recomendada para un error cualquiera (ApiError, red caída, etc.). */
export function variantForKind(kind: ErrorKind): ErrorScreenVariant {
  switch (kind) {
    case "offline":
    case "network":
      return "offline";
    case "unauthorized":
      return "401";
    case "forbidden":
      return "403";
    case "notFound":
      return "404";
    case "gone":
      return "expired";
    case "rateLimited":
      return "429";
    case "maintenance":
      return "503";
    default:
      return "500";
  }
}

export function variantForError(error: unknown): ErrorScreenVariant {
  return variantForKind(classifyError(error).kind);
}

interface ErrorScreenProps {
  variant?: ErrorScreenVariant;
  title?: string;
  description?: string;
  /** Referencia corta (digest de Next / requestId) para dar a soporte. */
  digest?: string;
  /** Acción principal; por defecto la de la variante (ir al inicio / iniciar sesión). */
  primary?: ErrorScreenAction | null;
  secondary?: ErrorScreenAction | null;
  layout?: "page" | "section" | "inline";
  /** Usa `<a>` (carga completa) en vez de `next/link`. */
  plainLinks?: boolean;
  /**
   * `false` = sin animación de entrada (el HTML ya sale visible). Para pantallas
   * que deben verse aunque el JS no hidrate, como `/offline` sin red.
   */
  animate?: boolean;
  /** Logo de marca arriba (pantallas completas). */
  showLogo?: boolean;
  children?: ReactNode;
  className?: string;
}

function ActionButton({
  action,
  variant,
  plainLinks,
}: {
  action: ErrorScreenAction;
  variant: "default" | "secondary";
  plainLinks?: boolean;
}) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon aria-hidden />}
      {action.label}
    </>
  );
  if (action.href && !action.onClick) {
    return (
      <Button asChild variant={variant}>
        {plainLinks ? <a href={action.href}>{content}</a> : <Link href={action.href}>{content}</Link>}
      </Button>
    );
  }
  return (
    <Button variant={variant} onClick={action.onClick}>
      {content}
    </Button>
  );
}

function DigestChip({ digest }: { digest: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin permiso de portapapeles: la referencia sigue visible para copiarla a mano.
    }
  };
  return (
    <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      <span>
        Referencia: <span className="select-all font-mono tabular-nums text-foreground/80">{digest}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Referencia copiada" : "Copiar referencia"}
        className="hit-44 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
    </p>
  );
}

export function ErrorScreen({
  variant = "500",
  title,
  description,
  digest,
  primary,
  secondary,
  layout = "section",
  plainLinks = false,
  animate = true,
  showLogo,
  children,
  className,
}: ErrorScreenProps) {
  const reduced = useReducedMotion();
  const spec = ERROR_SCREEN_VARIANTS[variant];
  const Icon = spec.icon ?? TriangleAlert;
  const main = primary === null ? undefined : (primary ?? spec.primary);
  const side = secondary === null ? undefined : secondary;
  const Heading = layout === "page" ? "h1" : "h2";
  const withLogo = showLogo ?? layout === "page";

  const card = (
    <motion.div
      initial={!animate ? false : reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? DUR.fast : DUR.slow, ease: EASE_OUT }}
      role={spec.alert ? "alert" : undefined}
      data-variant={variant}
      className={cn(
        "relative flex w-full flex-col items-center gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card text-center shadow-soft",
        layout === "inline" ? "max-w-md px-5 py-8" : "max-w-lg px-6 py-10 sm:px-10",
        className
      )}
    >
      {/* Firma de marca: la barra de tres colores del logo. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-spectrum-gradient" />
      {/* Destellos decorativos, sin información: no se pintan tarjetas enteras de color. */}
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-cyan/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-14 -left-10 size-36 rounded-full bg-magenta/10 blur-3xl" />

      <div className="relative flex items-center justify-center">
        {spec.code && (
          <span
            aria-hidden
            className="select-none font-heading text-[5.5rem] font-semibold leading-none tracking-tighter text-foreground/[0.07] sm:text-[7rem]"
          >
            {spec.code}
          </span>
        )}
        <motion.span
          initial={reduced || !animate ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: DUR.slow, ease: EASE_OUT, delay: reduced ? 0 : 0.05 }}
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl ring-1 ring-black/5 dark:ring-white/10",
            spec.code && "absolute",
            spec.tone
          )}
        >
          <Icon className="size-6" strokeWidth={1.75} aria-hidden />
        </motion.span>
      </div>

      <div className="relative space-y-2">
        {spec.code && <p className="sr-only">Error {spec.code}</p>}
        <Heading
          className={cn(
            "font-heading font-semibold leading-tight tracking-tight text-foreground",
            layout === "inline" ? "text-lg" : "text-2xl sm:text-[1.75rem]"
          )}
        >
          {title ?? spec.title}
        </Heading>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description ?? spec.description}
        </p>
      </div>

      {children}

      {(main || side) && (
        <div className="relative mt-1 flex flex-wrap items-center justify-center gap-2">
          {main && <ActionButton action={main} variant="default" plainLinks={plainLinks} />}
          {side && <ActionButton action={side} variant="secondary" plainLinks={plainLinks} />}
        </div>
      )}

      {digest && <DigestChip digest={digest} />}
    </motion.div>
  );

  if (layout === "inline") return <div className="flex justify-center py-4">{card}</div>;

  if (layout === "section") {
    return <div className="mx-auto mt-6 flex w-full justify-center px-0 sm:mt-10">{card}</div>;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-4">
      {withLogo && (
        <BrandLogo className="h-8" priority />
      )}
      {card}
    </main>
  );
}

/** Atajos con la copia y acciones correctas para cada caso de uso. */
export function ForbiddenScreen(props: Omit<ErrorScreenProps, "variant">) {
  return <ErrorScreen variant="403" {...props} />;
}

export function UnauthorizedScreen(props: Omit<ErrorScreenProps, "variant">) {
  return <ErrorScreen variant="401" {...props} />;
}

export function NotFoundScreen(props: Omit<ErrorScreenProps, "variant">) {
  return <ErrorScreen variant="404" {...props} />;
}

/** Botón de reintento estándar para las variantes recuperables. */
export function retryAction(onClick: () => void, label = "Reintentar"): ErrorScreenAction {
  return { label, onClick, icon: RefreshCw };
}
