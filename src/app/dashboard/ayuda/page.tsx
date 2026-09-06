"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import Title from "@/components/Title";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getStatusBadgeClasses } from "@/lib/statusColors";
import { statusOptions } from "@/lib/orderStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { useMotionPreset } from "@/lib/motion";
import {
  BarChart3,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Palette,
  PackagePlus,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const OPERATIONAL_ROLES = [
  "recepcion",
  "taller",
  "dtf",
  "bordado",
  "diseno",
  "laser",
  "impresiones",
];

/**
 * Sección "story": entra con fade + subida sutil, se mantiene visible en el
 * centro del viewport, y se atenúa (nunca desaparece del todo) al salir por
 * arriba. La animación está LIGADA al progreso de scroll de la sección
 * (useScroll con target propio), no disparada una sola vez.
 *
 * Con reduced-motion, cae a un fade estático simple sin scroll-linking.
 */
function StorySection({
  children,
  className = "",
  parallax = false,
}: {
  children: ReactNode;
  className?: string;
  /** Si true, aplica un leve efecto de profundidad extra (scale) al contenedor. */
  parallax?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const { reduced } = useMotionPreset();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.6, 1], [0, 1, 1, 0.4]);
  const y = useTransform(scrollYProgress, [0, 0.25], [28, 0]);
  const scale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    parallax ? [0.95, 1, 1, 0.97] : [1, 1, 1, 1],
  );

  if (reduced) {
    return (
      <motion.section
        ref={ref}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.15, ease: "linear" }}
        className={className}
      >
        {children}
      </motion.section>
    );
  }

  return (
    <motion.section ref={ref} style={{ opacity, y, scale }} className={className}>
      {children}
    </motion.section>
  );
}

/**
 * Sección con profundidad real: una forma decorativa de fondo y el contenido
 * en primer plano se mueven a distinta velocidad de scroll (parallax de dos
 * capas), además del fade/slide de entrada de `StorySection`. La forma de
 * fondo es puramente decorativa (aria-hidden) y usa sólo `transform`/`opacity`
 * para quedar en el compositor.
 */
function LayeredParallaxSection({
  children,
  className = "",
  shapeClassName = "",
  reverse = false,
}: {
  children: ReactNode;
  className?: string;
  shapeClassName?: string;
  /** Si true, el fondo se mueve más rápido que el contenido en vez de más lento. */
  reverse?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const { reduced } = useMotionPreset();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.6, 1], [0, 1, 1, 0.4]);
  const contentY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const bgY = useTransform(scrollYProgress, [0, 1], reverse ? [-90, 90] : [70, -70]);
  const bgRotate = useTransform(scrollYProgress, [0, 1], [0, reverse ? -14 : 14]);

  if (reduced) {
    return (
      <motion.section
        ref={ref}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.15, ease: "linear" }}
        className={`relative ${className}`}
      >
        {children}
      </motion.section>
    );
  }

  return (
    <motion.section ref={ref} style={{ opacity }} className={`relative ${className}`}>
      <motion.div
        aria-hidden
        style={{ y: bgY, rotate: bgRotate }}
        className={`pointer-events-none absolute -z-10 rounded-full blur-3xl ${shapeClassName}`}
      />
      <motion.div style={{ y: contentY }}>{children}</motion.div>
    </motion.section>
  );
}

/** Barra fina de progreso de lectura, fija arriba del contenido de Ayuda. */
function ReadingProgressBar({ progress }: { progress: MotionValue<number> }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 h-1 bg-border/50 sm:-mx-6">
      <motion.div
        style={{ scaleX: progress }}
        className="h-full w-full origin-left bg-primary"
      />
    </div>
  );
}

/**
 * Card con highlight que sigue el puntero (spotlight sutil), sólo en
 * dispositivos con puntero fino (mouse/trackpad) y sin reduced-motion — en
 * touch no hay cursor que seguir, así que ahí se comporta como una card
 * normal.
 */
function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { reduced } = useMotionPreset();
  const mouseX = useMotionValue(-200);
  const mouseY = useMotionValue(-200);
  const [canSpotlight, setCanSpotlight] = useState(false);

  const background = useTransform(
    [mouseX, mouseY],
    ([x, y]) =>
      `radial-gradient(220px circle at ${x}px ${y}px, hsl(var(--primary) / 0.14), transparent 70%)`,
  );

  return (
    <div
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse" && !reduced) setCanSpotlight(true);
      }}
      onPointerLeave={() => setCanSpotlight(false)}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
      }}
      className={`group relative overflow-hidden rounded-xl border border-border bg-card shadow-soft ${className}`}
    >
      {canSpotlight && (
        <motion.div
          aria-hidden
          style={{ background }}
          className="pointer-events-none absolute inset-0"
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * Preview de los botones de estado: ahora es realmente interactivo (no sólo
 * ilustrativo). Al hacer click en un estado, un anillo animado con spring
 * (`layoutId` compartido) se desplaza hasta ahí para mostrar cómo se ve
 * "seleccionado" — así se practica el gesto sin tocar un pedido real.
 */
function StatusButtonsPreview() {
  const [active, setActive] = useState(statusOptions[0]?.value ?? 1);
  const { reduced } = useMotionPreset();

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-4 shadow-sm">
      {statusOptions.map((opt) => {
        const isActive = opt.value === active;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setActive(opt.value)}
            aria-pressed={isActive}
            className={`relative rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition-colors ${getStatusBadgeClasses(
              opt.value,
            )} ${isActive ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-card" : "opacity-70 hover:opacity-100"}`}
          >
            {isActive && !reduced && (
              <motion.span
                layoutId="ayuda-status-highlight"
                transition={{ type: "spring", bounce: 0.35, duration: 0.45 }}
                className="absolute inset-0 -z-10 rounded-full bg-primary/10"
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sección "pinned": el bloque de texto queda fijo (`position: sticky`) mientras
 * las tarjetas de contenido se deslizan por encima al hacer scroll, como en las
 * páginas de producto de Apple. El contenedor exterior es más alto que el
 * viewport para darle "pista" de scroll a la sección fija.
 */
function PinnedSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { reduced } = useMotionPreset();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const cardsY = useTransform(scrollYProgress, [0, 1], [80, 0]);
  const cardsOpacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0.3, 1, 1, 0.3]);
  const headingScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.03, 1]);

  if (reduced) {
    return (
      <section className="space-y-6 py-14">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {children}
      </section>
    );
  }

  return (
    <div ref={ref} className="relative min-h-[170vh]">
      <div className="sticky top-14 flex min-h-[70vh] flex-col justify-center gap-6 py-10 sm:top-20">
        <motion.div style={{ scale: headingScale }} className="flex items-center gap-2">
          {icon}
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        </motion.div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <motion.div style={{ y: cardsY, opacity: cardsOpacity }} className="max-w-2xl space-y-4">
          {children}
        </motion.div>
      </div>
    </div>
  );
}

const AyudaPage = () => {
  const { roles, isAdmin } = usePermissions();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasOperationalRole = roles.some((r) => OPERATIONAL_ROLES.includes(r));
  const isRecepcion = roles.includes("recepcion");
  const { reduced } = useMotionPreset();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 300,
    damping: 40,
    restDelta: 0.001,
  });

  return (
    <div ref={containerRef} className="space-y-2">
      <Title title="Ayuda" />
      <ReadingProgressBar progress={progress} />

      {/* Intro: qué es esto y por qué existe, con parallax de dos capas. */}
      <LayeredParallaxSection
        className="flex min-h-[40vh] flex-col items-start justify-center gap-4 overflow-hidden py-10"
        shapeClassName="-left-16 -top-16 h-72 w-72 bg-gradient-to-br from-primary/25 to-accent2-500/20"
      >
        <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-accent2-500/10 p-4">
          <HelpCircle className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">¿Cómo uso esta plataforma?</h2>
            <p className="text-sm text-muted-foreground">
              Guía rápida, pensada para tu rol. Si algo no coincide con lo que
              ves, preguntale a un administrador.
            </p>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Esta plataforma acompaña a un pedido de EMD Bordados desde que entra
          hasta que se entrega, pasando por las áreas que lo procesan
          (diseño, láser, DTF, bordado, impresiones y taller). Cada rol ve
          sólo lo que necesita para hacer su parte del trabajo.
        </p>
      </LayeredParallaxSection>

      {isAdmin && (
        <StorySection className="min-h-[60vh] space-y-6 py-14">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">
              Administración
            </h2>
          </div>
          <SpotlightCard className="max-w-3xl p-1">
            <Accordion type="single" collapsible className="w-full px-3">
              <AccordionItem value="panel-general">
                <AccordionTrigger>¿Qué es el Panel General?</AccordionTrigger>
                <AccordionContent>
                  Es la vista global de todos los pedidos de la empresa. Ahí
                  podés ver en qué etapa está cada pedido (pendiente, en
                  pruebas, en proceso, terminado o entregado), filtrar por
                  estado y ordenar la lista. Sirve para tener una foto completa
                  de la operación sin entrar pedido por pedido.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="estancamiento">
                <AccordionTrigger>
                  ¿Cómo detecto pedidos estancados?
                </AccordionTrigger>
                <AccordionContent>
                  El Panel General calcula cuánto tiempo lleva cada pedido en su
                  estado actual y lo compara contra el tiempo promedio
                  histórico de ese estado. Si un pedido tarda más de lo normal,
                  aparece resaltado en la tabla de &quot;pedidos estancados&quot;
                  con una sugerencia de qué revisar (por ejemplo, contactar al
                  área responsable de esa etapa).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="rendimiento">
                <AccordionTrigger>
                  ¿Cómo interpreto el rendimiento por área?
                </AccordionTrigger>
                <AccordionContent>
                  Cada área (bordado, DTF, diseño, láser, impresiones, taller)
                  trabaja una etapa del pedido. Las métricas te muestran cuántos
                  pedidos tiene cada área en este momento y cuánto tiempo
                  promedio le toma completar su parte. Un tiempo mucho mayor al
                  habitual suele indicar sobrecarga o un problema puntual en esa
                  área.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="usuarios">
                <AccordionTrigger>
                  ¿Cómo gestiono usuarios, roles, empresas y clientes?
                </AccordionTrigger>
                <AccordionContent>
                  Desde el menú lateral, en las secciones &quot;Usuarios y
                  Roles&quot;, &quot;Clientes&quot; y &quot;Empresas&quot; podés
                  crear, editar o eliminar registros. Al crear o editar un
                  usuario, la contraseña debe tener al menos 8 caracteres, una
                  mayúscula y un número — el formulario te avisa si falta algo.
                  Los roles determinan qué secciones y qué etapas de pedido
                  puede ver y modificar cada persona.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="metricas">
                <AccordionTrigger>
                  ¿Cómo leo los gráficos del dashboard?
                </AccordionTrigger>
                <AccordionContent>
                  Los gráficos resumen la cantidad de pedidos por estado y su
                  evolución. Cada color representa siempre el mismo estado en
                  toda la app (por ejemplo, verde para &quot;entregado&quot;),
                  así que podés comparar de un vistazo entre el dashboard, el
                  tablero de estatus y el detalle de cada pedido.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </SpotlightCard>
        </StorySection>
      )}

      {hasOperationalRole && (
        <PinnedSection
          icon={<ClipboardList className="h-6 w-6 text-primary" />}
          title="Estatus de Pedidos"
          description={
            'Vas a ver únicamente los pedidos que están en la etapa que le corresponde a tu rol. Por ejemplo, si trabajás en bordado, sólo aparecen los pedidos que están "en proceso" de bordado esperando que termines tu parte. Los pedidos de otras etapas no se muestran ahí para no generar confusión.'
          }
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cuando termines tu parte, entrá al pedido (o hacé clic en
            &quot;Ver&quot;) y usá el selector de estado para pasarlo a la
            siguiente etapa. Apenas lo cambiás, el pedido pasa a la lista de
            tareas del área siguiente y queda registrado en el historial con
            fecha y hora. Probá haciendo click en los estados de abajo:
          </p>
          <StatusButtonsPreview />
          {isRecepcion && (
            <SpotlightCard className="p-1">
              <Accordion type="single" collapsible className="w-full px-3">
                <AccordionItem value="crear-pedido">
                  <AccordionTrigger>¿Cómo creo un pedido nuevo?</AccordionTrigger>
                  <AccordionContent>
                    Andá a &quot;Nuevo Pedido&quot; en el menú lateral, elegí
                    el cliente (o cargalo si es nuevo), completá la
                    descripción del trabajo y la fecha de entrega estimada, y
                    guardá. El pedido arranca en estado &quot;pendiente&quot;
                    y aparece automáticamente en las tareas del área que
                    corresponde a la primera etapa del proceso.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </SpotlightCard>
          )}
        </PinnedSection>
      )}

      {!isAdmin && !hasOperationalRole && (
        <StorySection className="flex min-h-[40vh] flex-col justify-center gap-3 py-14">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">
              Sin secciones asignadas
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tu usuario todavía no tiene un rol operativo asignado. Pedile a un
            administrador que te asigne un rol para poder ver tus tareas.
          </p>
        </StorySection>
      )}

      {/* Colores de estado: parallax de dos capas + preview interactivo,
          ya que es uno de los 1-2 elementos "profundos" de la página. */}
      <LayeredParallaxSection
        className="flex min-h-[45vh] flex-col justify-center gap-4 overflow-hidden py-14"
        shapeClassName="-right-20 top-1/3 h-80 w-80 bg-gradient-to-br from-accent2-500/25 to-primary/15"
        reverse
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Colores de estado
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          En toda la app vas a ver los mismos colores para cada estado de
          pedido: gris para pendiente, celeste para en pruebas, ámbar para en
          proceso, violeta para terminado y verde para entregado. Así podés
          identificar el estado de un pedido de un vistazo, sin importar en
          qué pantalla estés. Tocá un estado para ver cómo se resalta.
        </p>
        <div className="max-w-2xl">
          <StatusButtonsPreview />
        </div>
      </LayeredParallaxSection>

      {/* Flujo de diseño (opcional, Order.requiresDesign) */}
      <StorySection className="min-h-[40vh] space-y-4 py-14">
        <div className="flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Flujo de diseño
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cuando un pedido &quot;requiere diseño&quot;, no va directo a
          producción: primero pasa por un ida y vuelta con el cliente hasta
          que autoriza el montaje.
        </p>
        <SpotlightCard className="max-w-3xl p-5">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                1
              </span>
              <span>
                <b>Recepción</b> asigna el pedido a <b>Diseño</b> (queda en
                estado &quot;en diseño&quot;).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                2
              </span>
              <span>
                <b>Diseño</b> arma el montaje y lo sube desde el detalle del
                pedido; vuelve a Recepción.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                3
              </span>
              <span>
                <b>Recepción</b> se lo manda al cliente por fuera del sistema
                y espera su autorización (&quot;esperando autorización&quot;).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-semibold text-orange-600 dark:text-orange-400">
                ↺
              </span>
              <span>
                Si el cliente pide cambios, Recepción los carga
                (&quot;cambios solicitados&quot;) y el pedido vuelve a
                Diseño — se repite desde el paso 2 tantas veces como haga
                falta.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                ✓
              </span>
              <span>
                Cuando el cliente autoriza, el pedido queda
                &quot;autorizado&quot; y salta al área de producción elegida
                — recién ahí arranca el trabajo de taller/producción.
              </span>
            </li>
          </ol>
        </SpotlightCard>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Todo esto vive en la sección &quot;Proceso de diseño&quot; del
          detalle de cada pedido: ahí se ve el historial de montajes y
          feedback por ronda, y sólo aparecen los botones que le corresponden
          a tu rol en el paso en el que está el pedido — el selector manual
          de estado no permite saltearse este flujo.
        </p>
      </StorySection>

      {/* FAQ / cierre */}
      <StorySection className="min-h-[40vh] space-y-4 py-14">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Preguntas frecuentes
          </h2>
        </div>
        <SpotlightCard className="max-w-3xl p-1">
          <Accordion type="single" collapsible className="w-full px-3">
            <AccordionItem value="atajos">
              <AccordionTrigger>¿Qué atajos de teclado hay?</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1.5">
                  <li>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Ctrl/Cmd + K</kbd>{" "}
                    abre el buscador rápido (navegar a una sección o buscar un pedido).
                  </li>
                  <li>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">N</kbd>{" "}
                    en la pantalla de Pedidos abre &quot;+ Nueva Orden&quot; (sin tener nada escribiendo en un campo).
                  </li>
                  <li>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Esc</kbd>{" "}
                    cierra cualquier ventana o diálogo abierto.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="mas-ayuda">
              <AccordionTrigger>¿Necesitás más ayuda?</AccordionTrigger>
              <AccordionContent>
                Si algo no funciona como esperás o necesitás un permiso que no
                tenés, contactá a un administrador de EMD Bordados.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SpotlightCard>
        <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-br from-primary/10 to-accent2-500/10 p-4">
          <PackagePlus className="h-6 w-6 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            {reduced
              ? "Modo de movimiento reducido activo: mostramos las secciones con un fade simple."
              : "Seguí explorando el resto del dashboard desde el menú lateral."}
          </p>
        </div>
      </StorySection>
    </div>
  );
};

export default AyudaPage;
