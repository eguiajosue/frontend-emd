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

  const usernameError = touched.username && username.trim().length === 0 ? 'Ingresá tu nombre de usuario' : undefined
  const passwordError = touched.password && password.length === 0 ? 'Ingresá tu contraseña' : undefined

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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <div className="hidden md:flex items-center justify-center bg-gradient-to-br from-neutral-950 via-brand-950 to-neutral-950 text-white relative overflow-hidden">
        <GradientBlobs variant="login" />
        {/* LoginAmbientScene deshabilitada temporalmente: @react-three/fiber en un
            chunk dynamic(ssr:false) choca con react-dom en prod ("Cannot read
            properties of undefined (reading 'ReactCurrentBatchConfig')").
            Pendiente de arreglar sin bloquear el login. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center px-8 py-6 relative"
        >
          <h1 className="font-heading text-6xl lg:text-8xl font-semibold bg-gradient-to-r from-white via-brand-200 to-brand-400 bg-clip-text text-transparent">
            EMD Bordados
          </h1>
          <p className="text-lg mt-4 font-medium text-neutral-200">
            Sistema de gestión de pedidos e inventario
          </p>
          <p className="text-sm mt-2 opacity-60">Versión 1.0.0</p>
        </motion.div>
      </div>

      <div className="relative flex items-center justify-center overflow-hidden bg-neutral-950 p-8 md:bg-background">
        <GradientBlobs variant="subtle" className="md:hidden" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="space-y-2 text-center md:hidden">
            <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight text-white">EMD Bordados</h1>
          </div>
          <div className="space-y-2 text-center">
            <h2 className="font-heading text-4xl font-semibold leading-tight tracking-tight text-white md:text-foreground">Iniciar Sesión</h2>
            <p className="text-neutral-300 md:text-muted-foreground mt-2">Ingrese su nombre de usuario y contraseña para acceder a la plataforma</p>
          </div>

          {sessionMessage && (
            <div className="rounded-lg border border-brand-500/40 bg-brand-500/10 text-brand-300 md:text-brand-700 text-sm px-4 py-3 text-center">
              {sessionMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <FormField
              label={<span className="text-neutral-200 md:text-foreground">Nombre de Usuario</span>}
              htmlFor="username"
              icon={User}
              error={usernameError}
            >
              <Input
                id="username"
                placeholder="Ingrese su nombre de usuario"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                className="w-full px-4 py-3 h-11 rounded-lg border-2 border-neutral-700 md:border-input bg-transparent focus-visible:ring-0 focus-visible:border-primary transition-colors"
              />
            </FormField>

            <FormField
              label={<span className="text-neutral-200 md:text-foreground">Contraseña</span>}
              htmlFor="password"
              icon={Lock}
              error={passwordError}
            >
              <Input
                id="password"
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                className="w-full px-4 py-3 h-11 rounded-lg border-2 border-neutral-700 md:border-input bg-transparent focus-visible:ring-0 focus-visible:border-primary transition-colors"
              />
            </FormField>

            {errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-red-400 md:text-destructive text-sm space-y-1"
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

            <motion.div {...(submitting ? {} : formButtonMotion)}>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 py-3 bg-primary hover:bg-brand-700 text-primary-foreground rounded-lg transition-colors"
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
