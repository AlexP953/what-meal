"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { submitRegistration } from "./submit";

export default function RegisterPage() {
  const router = useRouter();
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await submitRegistration(new FormData(event.currentTarget));
      if (result.ok) router.push("/login?registered=1");
      else setError(result.error);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border px-3 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600";
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-2xl bg-white border shadow-sm p-8 text-gray-900">
        <h1 className="text-center text-2xl font-bold">Crear cuenta</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-busy={loading} aria-describedby={error ? "registration-error" : undefined}>
          <div><label htmlFor="name">Nombre (opcional)</label><input id="name" name="name" autoComplete="name" maxLength={100} className={inputClass} /></div>
          <div><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" required className={inputClass} /></div>
          <div><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} aria-describedby="password-help" className={inputClass} />
            <p id="password-help" className="mt-2 text-sm text-gray-600">Al menos 12 caracteres y máximo 72 bytes UTF-8. Las letras acentuadas y los emojis ocupan varios bytes.</p></div>
          {error && <p id="registration-error" role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-green-700 py-3 text-white font-semibold hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">{loading ? "Creando cuenta…" : "Crear cuenta"}</button>
        </form>
        <p className="mt-5 text-center text-sm"><Link href="/login" className="text-green-800 underline">Ya tengo cuenta. Iniciar sesión</Link></p>
      </section>
    </main>
  );
}
