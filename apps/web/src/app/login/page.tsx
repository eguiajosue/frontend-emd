"use client"

import { getErrorMessage, getLoginErrorMessage } from "@/lib/errorMessages"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { fieldErrorId } from '@/components/feedback/FieldError'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { Suspense, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Loader2, User, Lock } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useMotionPreset } from '@/lib/motion'
import { DUR, EASE_OUT } from '@/lib/motion'
import { Stagger, StaggerItem } from '@/components/motion/Stagger'
import { BrandLogo } from '@/components/BrandLogo'

/** Los tres cuadros de color del logo EMD, usados como motivo decorativo. */
const BrandSquares = ({ className = '' }: { className?: string }) => (
  <div aria-hidden className={`flex gap-2 ${className}`}>
    <span className="h-3 w-3 rounded-[3px] bg-cyan" />
    <span className="h-3 w-3 rounded-[3px] bg-lime" />
    <span className="h-3 w-3 rounded-[3px] bg-magenta" />
  </div>
)

/** Cuadros grandes translúcidos que flotan despacio en el panel de marca. */
const FloatingSquares = () => {
  const reduced = useReducedMotion()
  const squares = [
    { c: 'bg-cyan/25', pos: 'right-16 top-24 size-24', dy: 10, d: 7 },
    { c: 'bg-lime/20', pos: 'right-40 top-[46%] size-14', dy: -8, d: 6 },
    { c: 'bg-magenta/30', pos: 'bottom-28 right-14 size-32', dy: 12, d: 8 },
  ]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {squares.map((q, i) => (
        <motion.span
          key={i}
          className={`absolute rounded-3xl ${q.c} ${q.pos}`}
          animate={reduced ? undefined : { y: [0, q.dy, 0], rotate: [0, 4, 0] }}
          transition={{ duration: q.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

const LoginForm = () => {
  const [errors, setErrors] = useState<string[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState<{ username?: boolean; password?: boolean }>({})
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
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
    if (!username.trim()) return usernameRef.current?.focus();
    if (!password) return passwordRef.current?.focus();
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
        setErrors([getLoginErrorMessage(responseNextAuth.error)]);
        passwordRef.current?.focus();
        return;
      }

      router.push("/dashboard");
    } catch (error) {
      // signIn() lanza si no hay red: se explica en vez de dejar el botón "mudo".
      setErrors([getErrorMessage(error)]);
    } finally {
      clearTimeout(slowServerTimer);
      setSubmitting(false);
      setSlowServer(false);
    }
  };

  return (
    // Lienzo claro + panel marino de marca a la izquierda (sólo escritorio) y
    // tarjeta de acceso a la derecha. Sigue el tema guardado: el oscuro usa
    // los mismos tokens. Entrada escalonada (fade-up 250ms, 45ms entre pasos).
    <main className="grid min-h-dvh w-full grid-cols-1 gap-4 bg-background p-4 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.slow, ease: EASE_OUT }}
        className="surface-brand relative hidden flex-col justify-between rounded-[1.75rem] p-10 shadow-soft-md lg:flex xl:p-14"
      >
        {/* Trama sutil + cuadros del logo flotando (quietos con reducir movimiento). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <FloatingSquares />

        <BrandLogo onDark priority className="relative h-12 self-start xl:h-14" />

        <Stagger className="relative" step={0.06} delay={0.1}>
          <StaggerItem>
            <div className="brand-bar mb-7 w-24" aria-hidden />
          </StaggerItem>
          <StaggerItem>
            {/* El único h1 de la página es "Bienvenido de vuelta" (el panel de marca
                sólo existe en escritorio): éste es un lema, no el título. */}
            <p className="text-display max-w-xl xl:text-6xl">
              Todo tu equipo creativo, <span className="text-gradient-accent">en un solo lugar.</span>
            </p>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-6 max-w-md text-lg text-white/80">
              Imprenta, bordado y marketing: de la idea a la entrega, sin perder ningún pedido en el camino.
            </p>
          </StaggerItem>
        </Stagger>

        <ul aria-label="Áreas" className="relative flex flex-wrap gap-2">
          {[
            { name: "Imprenta", dot: "bg-cyan" },
            { name: "Bordado", dot: "bg-lime" },
            { name: "Marketing", dot: "bg-magenta" },
          ].map((area) => (
            <li
              key={area.name}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm"
            >
              <span aria-hidden className={`size-2 rounded-[3px] ${area.dot}`} />
              {area.name}
            </li>
          ))}
        </ul>
      </motion.section>

      {/* Formulario: tarjeta centrada sobre el lienzo. */}
      <div className="flex flex-col items-center justify-center py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE_OUT, delay: 0.05 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandLogo className="h-12" priority />
          </div>

          <div className="relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-soft-md sm:p-9">
          <div aria-hidden className="brand-bar absolute inset-x-0 top-0 h-1 rounded-none" />
          <BrandSquares className="mb-5 mt-1" />
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              Bienvenido de vuelta
            </h1>
            <p className="text-muted-foreground">
              Ingresar usuario y contraseña para entrar al panel de EMD
            </p>
          </div>

          {sessionMessage && (
            <div role="status" className="mt-6 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-center text-sm text-foreground">
              {sessionMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate aria-busy={submitting}>
            <FormField label="Nombre de Usuario" htmlFor="username" icon={User} error={usernameError}>
              <Input
                id="username"
                ref={usernameRef}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                aria-required="true"
                placeholder="Ingrese su nombre de usuario"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                className="h-12 w-full rounded-xl px-4"
              />
            </FormField>

            <FormField label="Contraseña" htmlFor="password" icon={Lock} error={passwordError}>
              <div className="relative">
                <Input
                  id="password"
                  ref={passwordRef}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={passwordError ? fieldErrorId('password') : undefined}
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  className="h-12 w-full rounded-xl pl-4 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
            </FormField>

            {errors.length > 0 && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
                role="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-sm text-muted-foreground"
              >
                El servidor estaba inactivo y está despertando, puede tardar
                unos segundos más...
              </motion.p>
            )}

            {/* tabIndex -1: con `whileTap` Framer vuelve enfocable este contenedor y el
                teclado paraba en un `div` mudo antes del botón. */}
            <motion.div tabIndex={-1} {...(submitting ? {} : formButtonMotion)}>
              <Button
                type="submit"
                disabled={submitting}
                size="lg"
                variant="brand"
                className="h-12 w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> Iniciando sesión…
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
    </main>
  )
}

const Login = () => (
  <Suspense fallback={null}>
    <LoginForm />
  </Suspense>
)

export default Login
