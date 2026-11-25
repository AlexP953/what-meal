"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useHydrated } from "../use-hydrated";

export default function LoginForm({ registered = false }: { registered?: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email")?.toString() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    if (!email.includes("@")) {
      setError("El email no es válido");
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      const res = await signIn("credentials", { redirect: false, redirectTo: "/", email, password });
      if (res?.status === 429) setError("Demasiados intentos. Espera antes de volver a iniciar sesión.");
      else if (res?.status === 503) setError("Servicio temporalmente no disponible. Inténtalo más tarde.");
      else if (!res?.ok || res.error) setError("Email o contraseña incorrectos");
      else { router.push("/"); router.refresh(); }
    } catch {
      setError("No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-2xl bg-white border shadow-sm p-8">
        <div className="flex justify-center mb-6">
          <div className="text-5xl font-extrabold tracking-tight leading-none">
            <span className="align-middle">
              <Image width={220} height={60} src="/logo.svg" alt="WhatMeal" loading="eager" className="ml-8" />
            </span>
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold text-gray-900">
          ¡Bienvenido!
        </h1>
        {registered && <p role="status" className="mt-4 text-sm text-green-800">Cuenta creada. Inicia sesión para continuar.</p>}

        <form method="post" onSubmit={handleSubmit} className="mt-8 space-y-4" aria-busy={loading} aria-describedby={error ? "login-error" : undefined}>
          <div className="relative">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-900">
              Correo electrónico
            </label>
            <div className="flex items-center gap-3 rounded-xl border bg-white px-3 py-3 focus-within:ring-2 focus-within:ring-green-500">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5 flex-none text-gray-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 7.5v9a2.25 2.25 0 0 1-2.25 2.25H4.5A2.25 2.25 0 0 1 2.25 16.5v-9M21.75 7.5l-8.954 5.97a2.25 2.25 0 0 1-2.592 0L1.25 7.5m20.5 0A2.25 2.25 0 0 0 19.5 5.25H4.5A2.25 2.25 0 0 0 2.25 7.5"
                />
              </svg>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@ejemplo.com"
                className="w-full bg-transparent text-base text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>
          </div>

          <div className="relative">
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-900">
              Contraseña
            </label>
            <div className="flex items-center gap-3 rounded-xl border bg-white px-3 py-3 focus-within:ring-2 focus-within:ring-green-500">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5 flex-none text-gray-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V7a4.5 4.5 0 1 0-9 0v3.5M6.75 10.5h10.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H6.75A1.5 1.5 0 0 1 5.25 18v-6a1.5 1.5 0 0 1 1.5-1.5z"
                />
              </svg>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="•••••"
                className="w-full bg-transparent text-base text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>

          </div>

          {error && <p id="login-error" role="alert" className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={!hydrated || loading}
            className="mt-2 w-full h-11 rounded-xl bg-green-700 text-white font-semibold hover:bg-green-800 active:bg-green-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Iniciar sesión"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm"><Link href="/register" className="text-green-800 underline">Crear una cuenta</Link></p>
      </section>
    </main>
  );
}
