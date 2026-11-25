"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { announceSessionChange } from "../session-client";
import { submitLogin } from "./submit";
import AccessScreen from "../components/AccessScreen";
import { useHydrated } from "../use-hydrated";

export default function LoginForm({ registered = false }: { registered?: boolean }) {
  const hydrated = useHydrated();
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const form = new FormData(event.currentTarget);
    submitting.current = true;
    setLoading(true);
    setError("");

    try {
      const result = await submitLogin(form);
      if (result === "limited") {
        setError("Demasiados intentos. Espera antes de volver a iniciar sesión.");
      } else if (result === "service") {
        setError("Servicio temporalmente no disponible. Inténtalo más tarde.");
      } else if (result === "invalid") {
        setError("Correo electrónico o contraseña incorrectos.");
      } else {
        announceSessionChange();
        window.location.replace("/meals");
        return;
      }
    } catch {
      setError("No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.");
    }

    submitting.current = false;
    setLoading(false);
  }

  return (
    <AccessScreen title="Iniciar sesión" description="Accede a tu diario de comidas.">
      {registered && <p role="status" className="app-feedback mt-4">Cuenta creada. Inicia sesión para continuar.</p>}
      <form method="post" onSubmit={handleSubmit} className="app-form" aria-busy={loading} aria-describedby={error ? "login-error" : undefined}>
        <label htmlFor="email">
          Correo electrónico
          <input id="email" name="email" type="email" autoComplete="email" className="app-field" required />
        </label>
        <label htmlFor="password">
          Contraseña
          <input id="password" name="password" type="password" autoComplete="current-password" className="app-field" required />
        </label>
        <button type="submit" disabled={!hydrated || loading} className="app-button app-button-primary">
          {loading ? "Iniciando sesión…" : "Iniciar sesión"}
        </button>
      </form>
      <p role="status" className="sr-only">{loading ? "Iniciando sesión…" : ""}</p>
      {error && <p id="login-error" role="alert" className="app-feedback app-error mt-3">{error}</p>}
      <p className="mt-3 text-sm"><Link href="/register" className="app-link">Crear una cuenta</Link></p>
    </AccessScreen>
  );
}
