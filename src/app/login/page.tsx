"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

const LoginForm = () => {
  const [errors, setErrors] = useState<string[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [slowServer, setSlowServer] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionMessage = searchParams.get('message')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors([]);
    setSubmitting(true);
    setSlowServer(false);

    // El backend gratuito puede tardar hasta ~50s en "despertar" tras estar
    // inactivo. Avisamos al usuario en vez de dejar el botón sin feedback.
    const slowServerTimer = setTimeout(() => setSlowServer(true), 4000);

    try {
      const responseNextAuth = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (responseNextAuth?.error) {
        setErrors(responseNextAuth.error.split(","));
        return;
      }

      router.push("/dashboard");
    } finally {
      clearTimeout(slowServerTimer);
      setSubmitting(false);
      setSlowServer(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <div className="hidden md:flex items-center justify-center bg-gradient-to-br from-neutral-950 via-brand-950 to-neutral-950 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent2-500/10 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center px-8 py-6 relative"
        >
          <h1 className="text-6xl lg:text-8xl font-extrabold bg-gradient-to-r from-white via-brand-200 to-brand-400 bg-clip-text text-transparent">
            EMD Bordados
          </h1>
          <p className="text-lg mt-4 font-medium text-neutral-200">
            Sistema de gestión de pedidos e inventario
          </p>
          <p className="text-sm mt-2 opacity-60">Versión 1.0.0</p>
        </motion.div>
      </div>

      <div className="flex items-center justify-center bg-neutral-950 md:bg-background p-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="space-y-2 text-center md:hidden">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">EMD Bordados</h1>
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-foreground">Iniciar Sesión</h2>
            <p className="text-neutral-300 md:text-muted-foreground mt-2">Ingrese su nombre de usuario y contraseña para acceder a la plataforma</p>
          </div>

          {sessionMessage && (
            <div className="rounded-lg border border-brand-500/40 bg-brand-500/10 text-brand-300 md:text-brand-700 text-sm px-4 py-3 text-center">
              {sessionMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-neutral-200 md:text-foreground font-medium">Nombre de Usuario</Label>
              <Input
                id="username"
                placeholder="Ingrese su nombre de usuario"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-neutral-700 md:border-input bg-transparent focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 transition duration-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-200 md:text-foreground font-medium">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingrese su contraseña"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-neutral-700 md:border-input bg-transparent focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 transition duration-300"
              />
            </div>

            {errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 md:text-destructive text-sm space-y-2"
              >
                <ul>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {slowServer && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-muted-foreground md:text-neutral-300 text-center"
              >
                El servidor estaba inactivo y está despertando, puede tardar
                unos segundos más...
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary hover:bg-brand-700 text-primary-foreground rounded-lg transition duration-300 ease-in-out"
              asChild={false}
            >
              <motion.span
                className="flex w-full items-center justify-center"
                whileHover={submitting ? undefined : { scale: 1.02 }}
                whileTap={submitting ? undefined : { scale: 0.98 }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </motion.span>
            </Button>
          </form>

          <div>
            <p className="text-neutral-300 md:text-muted-foreground text-center">
              ¿No tienes una cuenta?{' '}
              <span className="text-brand-400 md:text-primary font-medium">
                Consulta con un administrador para dar la alta de su usuario
              </span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

const Login = () => (
  <Suspense fallback={null}>
    <LoginForm />
  </Suspense>
)

export default Login
