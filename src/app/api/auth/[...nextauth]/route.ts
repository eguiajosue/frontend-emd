import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import { decodeJwt } from "jose";
import { apiUrl } from "@/lib/config";

/** Margen de seguridad: renovamos el access token si expira en menos de esto. */
const REFRESH_MARGIN_SECONDS = 60;

interface BackendAuthResponse {
  token: string;
  refreshToken?: string;
  id?: string | number;
  username: string;
  first_name?: string;
  last_name?: string;
  roles?: string[];
  role?: string;
}

/** Lee el `exp` (segundos epoch) de un JWT sin verificar la firma. */
function getTokenExpiry(jwt: string): number | undefined {
  try {
    const payload = decodeJwt(jwt);
    return typeof payload.exp === "number" ? payload.exp : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Canjea el refreshToken guardado por un nuevo par de tokens contra
 * POST /auth/refresh. Si falla (refresh token inválido/expirado), devuelve
 * el token original marcado con `error` para que el cliente cierre sesión.
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(apiUrl("auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status}: ${res.statusText}`);
    }

    const refreshed: BackendAuthResponse = await res.json();

    return {
      ...token,
      token: refreshed.token,
      refreshToken: refreshed.refreshToken ?? token.refreshToken,
      accessTokenExpires: getTokenExpiry(refreshed.token),
      roles: Array.isArray(refreshed.roles) ? refreshed.roles : token.roles,
      error: undefined,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Error refrescando el access token:",
        error instanceof Error ? error.message : "unknown error"
      );
    }
    // Marcamos el error para que la app fuerce el signOut del lado del cliente.
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          // Validar que se hayan proporcionado username y password
          if (!credentials?.username || !credentials?.password) {
            throw new Error("Username and password are required");
          }

          // Hacer la solicitud al backend para autenticar al usuario
          const res = await fetch(apiUrl("auth/login"), {
            method: "POST",
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
            headers: { "Content-Type": "application/json" },
          });

          // Comprobar si la respuesta es exitosa
          if (!res.ok) {
            throw new Error(`Error ${res.status}: ${res.statusText}`);
          }

          // Obtener la respuesta como JSON
          const user: BackendAuthResponse = await res.json();

          // Si se devuelve un token, retornamos el objeto con los datos del usuario
          if (user.token) {
            return {
              id: String(user.id ?? user.username),
              username: user.username,
              token: user.token,
              refreshToken: user.refreshToken,
              first_name: user.first_name ?? "",
              last_name: user.last_name ?? "",
              roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []),
            };
          }

          // Si no hay token en la respuesta, lanzar un error
          throw new Error("Authentication failed: Token not found");

        } catch (error) {
          // Nunca loguear credenciales ni el token devuelto por el backend.
          if (process.env.NODE_ENV === "development") {
            console.error(
              "Error during login authorization:",
              error instanceof Error ? error.message : "unknown error"
            );
          }
          // Si hay un error, retornar null
          return null;
        }
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Callback para manejar la sesión
    async jwt({ token, user }): Promise<JWT> {
      // Login inicial: guardamos el par de tokens y la expiración del access token.
      if (user) {
        return {
          ...token,
          ...user,
          accessTokenExpires: getTokenExpiry((user as { token: string }).token),
          error: undefined,
        };
      }

      const expires = token.accessTokenExpires as number | undefined;
      const nowInSeconds = Math.floor(Date.now() / 1000);

      // Si no sabemos la expiración o todavía falta margen suficiente, no tocamos nada.
      if (!expires || nowInSeconds < expires - REFRESH_MARGIN_SECONDS) {
        return token;
      }

      // Access token por expirar (o expirado): intentamos renovarlo con el refreshToken.
      if (!token.refreshToken) {
        return { ...token, error: "RefreshAccessTokenError" as const };
      }

      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        username: token.username as string,
        token: token.token as string,
        first_name: token.first_name as string,
        last_name: token.last_name as string,
        roles: (token.roles as string[]) || [],
      };
      // Si el refresh falló, exponemos el error para que el cliente cierre sesión.
      session.error = token.error as string | undefined;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
