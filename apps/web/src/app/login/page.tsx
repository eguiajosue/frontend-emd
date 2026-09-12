"use client"

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
    <div className="min-h-dvh flex items-center justify-center bg-background p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl bg-card shadow-soft-md md:grid-cols-2"
      >
        {/* Panel de marca: sólo escritorio, igual que antes. Sin asset de
            ilustración con licencia disponible, reutiliza los blobs + campo
            de partículas ya existentes en vez de una imagen inventada. */}
        <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-950 via-brand-950 to-neutral-950 p-8 text-white md:m-3 md:flex md:rounded-xl">
          <GradientBlobs variant="login" />
          <ParticleField className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" />
          <div className="relative text-center">
            <h1 className="font-heading text-4xl font-semibold leading-tight text-white lg:text-5xl">
              EMD <span className="text-brand-300">Bordados</span>
            </h1>
            <p className="mt-4 text-base font-medium text-neutral-200">
              De la idea al bordado: cada pedido, taller y entrega en un solo lugar
            </p>
          </div>
        </div>

        {/* Panel de formulario */}
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
              E
            </div>
            <span className="font-heading text-base font-semibold tracking-tight text-foreground">
              EMD Bordados
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground">
              Bienvenido de vuelta
            </h2>
            <p className="text-muted-foreground">
              Ingresar usuario y contraseña para entrar al taller
            </p>
          </div>

          {sessionMessage && (
            <div className="mt-6 rounded-lg border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-center text-sm text-brand-700 dark:text-brand-300">
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
                className="h-12 w-full rounded-xl border border-transparent bg-muted px-4 transition-colors focus-visible:border-primary focus-visible:bg-card focus-visible:ring-0"
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
                className="h-12 w-full rounded-xl border border-transparent bg-muted px-4 transition-colors focus-visible:border-primary focus-visible:bg-card focus-visible:ring-0"
              />
            </FormField>

            {errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
                className="h-12 w-full rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-brand-700"
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
        </div>
      </motion.div>
    </div>
  )
}

const Login = () => (
  <Suspense fallback={null}>
    <LoginForm />
  </Suspense>
)

export default Login
