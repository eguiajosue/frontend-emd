import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          // Validar que se hayan proporcionado username y password
          if (!credentials?.username || !credentials?.password) {
            throw new Error("Username and password are required");
          }

          // Hacer la solicitud al backend para autenticar al usuario
          const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/login`, {
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
          const user = await res.json();

          // Si se devuelve un token, retornamos el objeto con los datos del usuario
          if (user.token) {
            return {
              id: user.id,
              username: user.username,
              token: user.token,
              first_name: user.first_name,
              last_name: user.last_name,
              role: user.role,
            };
          }

          // Si no hay token en la respuesta, lanzar un error
          throw new Error("Authentication failed: Token not found");

        } catch (error) {
          console.error("Error during login authorization:", error);
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
    async jwt({ token, user }) {
      return { ...token, ...user };
    },

    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        username: token.username as string,
        token: token.token as string,
        first_name: token.first_name as string,
        last_name: token.last_name as string,
        role: token.role as string,
      };
      return session;
    },
  },
});

export { handler as GET, handler as POST };
