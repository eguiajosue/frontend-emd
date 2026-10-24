import { createContext, useContext, type ReactNode } from "react";

/**
 * Sesión mínima que necesitan los hooks compartidos (token, roles y áreas), sin
 * atarse a cómo cada app maneja el login: la Web sigue usando NextAuth, la
 * futura Mobile usa expo-secure-store — cada una alimenta este contexto con
 * lo que ya tiene, y los hooks de aquí adentro no saben ni les importa de
 * dónde salió.
 */
export interface AuthSession {
  token: string | null | undefined;
  roles: string[];
  /** Slugs de las áreas en las que trabaja (separadas de los roles). */
  areas: string[];
}

const AuthSessionContext = createContext<AuthSession>({
  token: undefined,
  roles: [],
  areas: [],
});

export function AuthSessionProvider({
  value,
  children,
}: {
  value: AuthSession;
  children: ReactNode;
}) {
  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSession {
  return useContext(AuthSessionContext);
}
