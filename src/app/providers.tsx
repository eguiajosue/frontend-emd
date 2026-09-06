"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, getErrorMessage, isSessionExpiredError } from "@/lib/api";

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

export default function Providers({ children }: { children: ReactNode }) {
  // El QueryClient se crea una sola vez por montaje del árbol de React.
  const [queryClient] = useState(createQueryClient);

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <SessionErrorWatcher />
          {children}
          {isDev && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
