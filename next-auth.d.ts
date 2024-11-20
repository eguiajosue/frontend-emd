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
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    token: string;
    first_name: string;
    last_name: string;
    role: string;
  }
}
