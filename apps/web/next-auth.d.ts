// types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      token: string;
      first_name: string;
      last_name: string;
      roles: string[];
    } & DefaultSession["user"];
    /** Presente ("RefreshAccessTokenError") si el refresh del access token falló. */
    error?: string;
  }

  interface User {
    id: string;
    username: string;
    token: string;
    refreshToken?: string;
    first_name: string;
    last_name: string;
    roles: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    token?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    first_name?: string;
    last_name?: string;
    roles?: string[];
    error?: string;
  }
}
