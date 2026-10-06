import { cn } from "@/lib/utils";

/**
 * Formas orgánicas difuminadas de fondo ("blobs") usadas en pantallas con
 * mucho aire (login, hero del dashboard, estados vacíos) para dar
 * profundidad tipo "AI wellness" sin volverse ruidoso.
 *
 * - Usa los tokens de color de marca (`--primary` / `--accent2-*`), NUNCA
 *   colores fijos, para respetar el acento elegido por el usuario y
 *   light/dark mode.
 * - Opacidad baja en claro, aún más baja en oscuro (evita "manchas" sobre
 *   fondos oscuros).
 * - `pointer-events-none` + contenedor `overflow-hidden` para que nunca
 *   interfieran con el contenido ni generen scroll horizontal.
 * - Sólo 2-3 formas por pantalla, posicionadas en esquinas/bordes, nunca
 *   debajo de texto.
 */

type BlobVariant = "login" | "hero" | "subtle";

const VARIANT_BLOBS: Record<BlobVariant, string[]> = {
  // Pantalla de login: fondo oscuro fijo, blobs más presentes.
  login: [
    "absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl",
    "absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent2-500/15 blur-3xl",
  ],
  // Hero de dashboard / paneles admin: sutil, adaptado a light/dark.
  hero: [
    "absolute -top-32 right-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl dark:bg-primary/[0.06]",
    "absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent2-500/10 blur-3xl dark:bg-accent2-500/[0.05]",
  ],
  // Estados vacíos / superficies chicas: una sola forma discreta.
  subtle: [
    "absolute top-0 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl dark:bg-primary/[0.05]",
  ],
};

export function GradientBlobs({
  variant = "hero",
  className,
}: {
  variant?: BlobVariant;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      {VARIANT_BLOBS[variant].map((cls, i) => (
        <div key={i} className={cls} />
      ))}
    </div>
  );
}
