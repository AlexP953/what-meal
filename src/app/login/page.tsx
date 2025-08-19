"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email")?.toString() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    if (!email.includes("@")) {
      setError("El email no es válido");
      return;
    }
    if (password.length < 5) {
      setError("La contraseña debe tener al menos 5 caracteres");
      return;
    }

    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setLoading(false);

    if (res?.error) {
      setError("Email o contraseña incorrectos");
    } else {
      window.location.href = "/";
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-2xl bg-white border shadow-sm p-8">
        <div className="flex justify-center mb-6">
          <div className="text-5xl font-extrabold tracking-tight leading-none">
            <span className="align-middle">
              <img src="/logo.svg" alt="WhatMeal" className="h-16 ml-8 w-auto" />
            </span>
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold text-gray-900">
          ¡Bienvenido!
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="relative">
            <label htmlFor="email" className="sr-only">
              Email
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
                required
                placeholder="alexperis95@gmail.com"
                className="w-full bg-transparent text-base text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>
          </div>

          <div className="relative">
            <label htmlFor="password" className="sr-only">
              Password
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
                required
                placeholder="•••••"
                className="w-full bg-transparent text-base text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>

            {/* Forgot password
            <div className="mt-2 text-right">
              <a
                href="#"
                className="text-sm font-medium text-gray-500 hover:text-gray-700 hover:underline"
              >
                Forgot Password?
              </a>
            </div> */}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full h-11 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-800 active:bg-green-800 transition disabled:opacity-50"
          >
            {loading ? "Cargando..." : "LOGIN"}
          </button>
        </form>
      </section>
    </main>
  );
}
