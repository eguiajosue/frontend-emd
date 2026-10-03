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

/** Marca EMD HUB: misma píldora con monograma que la barra superior del panel. */
const BrandMark = () => (
  <div className="inline-flex h-12 items-center gap-2.5 self-start rounded-full border border-border/60 bg-card py-1.5 pl-1.5 pr-5 shadow-soft">
    <span
      aria-hidden
      className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(345_88%_60%)] font-heading text-base font-bold text-primary-foreground shadow-sm shadow-primary/30"
    >
      E
    </span>
    <span className="font-heading text-base font-semibold tracking-tight text-foreground">EMD HUB</span>
  </div>
)

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
    // Lienzo gris + tarjetas blancas, el mismo lenguaje que el panel. Sigue el
    // tema guardado (claro por defecto): el oscuro usa los mismos tokens.
    <div className="grid min-h-dvh w-full grid-cols-1 gap-4 bg-background p-4 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Panel de marca: sólo escritorio. Tarjeta blanca grande con el
          monograma y la propuesta de la herramienta; nada de bloques de color. */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative hidden flex-col justify-between overflow-hidden rounded-[2rem] border border-border/60 bg-card p-10 shadow-soft lg:flex xl:p-14"
      >
        <BrandMark />
        <div>
          <h1 className="font-heading text-6xl font-semibold leading-[0.95] tracking-tight text-foreground xl:text-7xl">
            EMD HUB
          </h1>
          <p className="mt-6 max-w-md text-xl font-medium leading-snug text-foreground/90">
            Imprenta, bordado y marketing: todo tu equipo creativo en un solo lugar.
          </p>
          <p className="mt-3 max-w-md text-base text-muted-foreground">
            De la idea a la entrega, sin perder ningún pedido en el camino.
          </p>
        </div>
        <ul aria-label="Áreas" className="flex flex-wrap gap-2">
          {['Imprenta', 'Bordado', 'Marketing'].map((area) => (
            <li
              key={area}
              className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground"
            >
              {area}
            </li>
          ))}
        </ul>
      </motion.section>

      {/* Formulario: tarjeta blanca centrada sobre el lienzo. */}
      <div className="flex flex-col items-center justify-center py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="w-full max-w-md"
        >
          <div className="mb-6 flex justify-center lg:hidden">
            <BrandMark />
          </div>

          <div className="rounded-[1.75rem] border border-border/60 bg-card p-6 shadow-soft sm:p-9">
          <div className="space-y-2">
            <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              Bienvenido de vuelta
            </h2>
            <p className="text-muted-foreground">
              Ingresar usuario y contraseña para entrar al panel de EMD HUB
            </p>
          </div>

          {sessionMessage && (
            <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-center text-sm text-foreground">
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
                className="h-12 w-full rounded-full border border-transparent bg-muted px-5 transition-colors focus-visible:border-ring focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/20"
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
                className="h-12 w-full rounded-full border border-transparent bg-muted px-5 transition-colors focus-visible:border-ring focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/20"
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
                size="lg"
                className="h-12 w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Iniciando sesión…
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </motion.div>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tienes una cuenta?{' '}
            <span className="font-medium text-foreground">
              Consulta con un administrador para dar la alta de su usuario
            </span>
          </p>
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
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
