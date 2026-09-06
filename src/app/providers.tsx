"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { ThemeProvider, useTheme } from "next-themes";
import { MotionConfig } from "framer-motion";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, getErrorMessage, isSessionExpiredError } from "@/lib/api";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAccentColor } from "@/hooks/useAccentColor";
import { useGlassIntensity } from "@/hooks/useGlassIntensity";
import { useDensity, type Density } from "@/hooks/useDensity";
import { LANGUAGE_STORAGE_KEY } from "@/lib/language";

/**
 * Providers globales de la app (sesión + cache de datos + toasts).
 *
 * El manejo de errores de red es uniforme: cualquier query o mutación que falle
 * muestra el mismo tipo de toast (salvo un 401, que ya dispara signOut global).
 * Las pantallas sólo se encargan del estado de error visible en pantalla.
 */

const isDev = process.env.NODE_ENV === "development";

// Devtools sólo en desarrollo (carga diferida, no entra en el bundle de producción).
const ReactQueryDevtools = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
  { ssr: false }
);

const RETRYABLE_ATTEMPTS = 2;

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isSessionExpiredError(error)) return false;
  // No reintentar errores de cliente (400-499): no se van a arreglar solos.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < RETRYABLE_ATTEMPTS;
}

function notifyError(error: unknown, fallback: string) {
  if (isSessionExpiredError(error)) return;
  toast.error(getErrorMessage(error, fallback));
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s: evita refetchear lo mismo al navegar entre pantallas
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => notifyError(error, "No se pudo cargar la información."),
    }),
    mutationCache: new MutationCache({
      onError: (error) => notifyError(error, "No se pudo guardar el cambio."),
    }),
  });
}

/** Si el refresh del access token falló (refresh token vencido/inválido), cerramos sesión. */
function SessionErrorWatcher() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      toast.error("Tu sesión expiró. Iniciá sesión nuevamente.");
      signOut({ callbackUrl: "/login" });
    }
  }, [session?.error]);

  return null;
}

/**
 * Aplica las preferencias del usuario logueado (tema/acento/idioma) apenas
 * llegan del backend, una sola vez por sesión iniciada, para que cada cuenta
 * vea SU configuración al loguearse sin depender de lo que había guardado
 * previamente en ese navegador (localStorage sigue funcionando como cache
 * local para evitar parpadeo mientras esto carga).
 */
function PreferencesSync() {
  const { data: session, status } = useSession();
  const { setTheme } = useTheme();
  const { setAccent } = useAccentColor();
  const { setIntensity } = useGlassIntensity();
  const { setDensity } = useDensity();
  const { preferences } = useUserPreferences();
  const appliedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session || !preferences) return;
    const userKey = String(session.user?.id ?? session.user?.username ?? "unknown");
    if (appliedForUser.current === userKey) return;
    appliedForUser.current = userKey;

    if (preferences.themePreference) setTheme(preferences.themePreference);
    if (preferences.accentColor) setAccent(preferences.accentColor);
    if (preferences.glassIntensity !== null && preferences.glassIntensity !== undefined) {
      setIntensity(preferences.glassIntensity);
    }
    if (preferences.density) setDensity(preferences.density as Density);
    if (preferences.languagePreference) {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, preferences.languagePreference);
      } catch {
        // Sin acceso a localStorage: no rompe la app, sólo no cachea localmente.
      }
    }
  }, [status, session, preferences, setTheme, setAccent, setIntensity, setDensity]);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  // El QueryClient se crea una sola vez por montaje del árbol de React.
  const [queryClient] = useState(createQueryClient);

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        {/*
          reducedMotion="user": respeta prefers-reduced-motion del sistema para
          TODO lo animado con framer-motion en la app (springs, stagger, hover,
          transición de ruta) sin tener que tocar cada componente uno por uno —
          Framer Motion reduce automáticamente las animaciones a un crossfade
          simple sin desplazamiento/escala cuando el usuario tiene esa
          preferencia activada.
        */}
        <MotionConfig reducedMotion="user">
          <QueryClientProvider client={queryClient}>
            <SessionErrorWatcher />
            <PreferencesSync />
            {children}
            {isDev && <ReactQueryDevtools initialIsOpen={false} />}
          </QueryClientProvider>
        </MotionConfig>
      </ThemeProvider>
    </SessionProvider>
  );
}
