import { createContext, useContext, type ReactNode } from "react";

/**
 * Sesión mínima que necesitan los hooks compartidos (token + roles), sin
 * atarse a cómo cada app maneja el login: la Web sigue usando NextAuth, la
 * futura Mobile usa expo-secure-store — cada una alimenta este contexto con
 * lo que ya tiene, y los hooks de acá adentro no saben ni les importa de
 * dónde salió.
 */
export interface AuthSession {
  token: string | null | undefined;
  roles: string[];
}

const AuthSessionContext = createContext<AuthSession>({
  token: undefined,
  roles: [],
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
