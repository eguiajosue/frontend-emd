"use client"

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Loader2, User, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMotionPreset } from '@/lib/motion'
import { GradientBlobs } from '@/components/decor/GradientBlobs'
import { ParticleField } from '@/components/three/ParticleField'

const LoginForm = () => {
  const [errors, setErrors] = useState<string[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState<{ username?: boolean; password?: boolean }>({})
  const [submitting, setSubmitting] = useState(false)
  const [slowServer, setSlowServer] = useState(false)
  const { formButtonMotion } = useMotionPreset()

  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionMessage = searchParams.get('message')

  const usernameError = touched.username && username.trim().length === 0 ? 'Ingresar el nombre de usuario' : undefined
  const passwordError = touched.password && password.length === 0 ? 'Ingresar la contraseña' : undefined

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ username: true, password: true });
    if (!username.trim() || !password) return;
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
    // El login queda fijo en claro (theme-force-light) más allá del tema
    // elegido en Configuración: es la puerta de entrada de la marca, no una
    // pantalla operativa donde el modo oscuro aporte.
    <div className="theme-force-light grid min-h-dvh w-full grid-cols-1 bg-background md:grid-cols-2">
      {/* Panel de marca: ocupa toda la altura de la pantalla, sólo escritorio.
          Sin asset de ilustración con licencia disponible, reutiliza los
          blobs + campo de partículas ya existentes en vez de una imagen
          inventada. Curva pronunciada + margen para que se lea como un
          bloque flotando dentro del full-bleed, igual que la referencia. */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-neutral-950 via-brand-950 to-neutral-950 p-10 text-white md:m-4 md:flex md:flex-col md:justify-center md:rounded-[2.5rem] lg:p-14">
        <GradientBlobs variant="login" />
        <ParticleField className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          <h1 className="font-heading text-6xl font-bold leading-[0.95] tracking-tight text-white lg:text-7xl">
            EMD
            <br />
            <span className="text-brand-300">HUB</span>
          </h1>
          <p className="mt-6 max-w-sm text-lg font-medium leading-snug text-neutral-200">
            Imprenta, bordado y marketing: todo tu equipo creativo en un solo lugar.
          </p>
          <p className="mt-3 max-w-sm text-sm font-medium text-neutral-400">
            De la idea a la entrega, sin perder ningún pedido en el camino.
          </p>
        </motion.div>
      </div>

      {/* Panel de formulario: sin card propia, vive directo sobre el fondo
          claro de la página — igual que la referencia. */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 md:px-16 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          className="mx-auto w-full max-w-sm"
        >
          <div className="mb-10 flex items-center gap-3">
            <Image
              src="/icons/icon.svg"
              alt="EMD"
              width={44}
              height={44}
              className="shrink-0 shadow-soft"
              priority
            />
            <span className="font-heading text-xl font-bold tracking-tight text-foreground">
              EMD HUB
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="font-heading text-4xl font-bold leading-tight tracking-tight text-foreground">
              Bienvenido de vuelta
            </h2>
            <p className="text-muted-foreground">
              Ingresar usuario y contraseña para entrar al panel de EMD HUB
            </p>
          </div>

          {sessionMessage && (
            <div className="mt-6 rounded-2xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-center text-sm text-brand-700">
              {sessionMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <FormField label="Nombre de Usuario" htmlFor="username" icon={User} error={usernameError}>
              <Input
                id="username"
                placeholder="Ingrese su nombre de usuario"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                className="h-12 w-full rounded-2xl border border-transparent bg-muted px-4 transition-colors focus-visible:border-primary focus-visible:bg-card focus-visible:ring-0"
              />
            </FormField>

            <FormField label="Contraseña" htmlFor="password" icon={Lock} error={passwordError}>
              <Input
                id="password"
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                className="h-12 w-full rounded-2xl border border-transparent bg-muted px-4 transition-colors focus-visible:border-primary focus-visible:bg-card focus-visible:ring-0"
              />
            </FormField>

            {errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
                className="text-center text-sm text-muted-foreground"
              >
                El servidor estaba inactivo y está despertando, puede tardar
                unos segundos más...
              </motion.p>
            )}

            <motion.div {...(submitting ? {} : formButtonMotion)}>
              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-full bg-primary text-primary-foreground transition-colors hover:bg-brand-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </motion.div>
          </form>

          <p className="mt-6 text-center text-muted-foreground">
            ¿No tienes una cuenta?{' '}
            <span className="font-medium text-primary">
              Consulta con un administrador para dar la alta de su usuario
            </span>
          </p>

          <p className="mt-6 text-center text-xs text-muted-foreground/70">
            v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_GIT_COMMIT}
          </p>
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
