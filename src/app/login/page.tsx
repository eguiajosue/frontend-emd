"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

const LoginForm = () => {
  const [errors, setErrors] = useState<string[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionMessage = searchParams.get('message')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors([]);
    setSubmitting(true);

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
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <div className="hidden md:flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center px-8 py-6">
          <h1 className="text-6xl lg:text-8xl font-extrabold text-gray-100">
            EMD Bordados
          </h1>
          <p className="text-lg mt-4 font-medium">Sistema de gestión de pedidos e inventario</p>
          <p className="text-sm mt-2 opacity-80">Versión 1.0.0</p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-gray-900 md:bg-white p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center md:hidden">
            <h1 className="text-4xl font-extrabold text-white">EMD Bordados</h1>
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-4xl font-bold text-white md:text-gray-800">Iniciar Sesión</h2>
            <p className="text-gray-300 md:text-gray-600 mt-2">Ingrese su nombre de usuario y contraseña para acceder a la plataforma</p>
          </div>

          {sessionMessage && (
            <div className="rounded-lg border border-pink-500/40 bg-pink-500/10 text-pink-300 md:text-pink-700 text-sm px-4 py-3 text-center">
              {sessionMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-200 md:text-gray-700 font-medium">Nombre de Usuario</Label>
              <Input
                id="username"
                placeholder="Ingrese su nombre de usuario"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 transition duration-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-200 md:text-gray-700 font-medium">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingrese su contraseña"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 transition duration-300"
              />
            </div>

            {errors.length > 0 && (
              <div className="text-red-400 md:text-red-500 text-sm space-y-2">
                <ul>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:hover:scale-100 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>

          <div>
            <p className="text-gray-300 md:text-gray-600 text-center">
              ¿No tienes una cuenta?{' '}
              <span className="text-pink-500 md:text-pink-600 font-medium">
                Consulta con un administrador para dar la alta de su usuario
              </span>
            </p>
          </div>
        </div>
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
