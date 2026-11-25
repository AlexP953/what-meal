"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import AccessScreen from "../components/AccessScreen";
import { useHydrated } from "../use-hydrated";
import { submitRegistration } from "./submit";

export default function RegisterPage() {
  const hydrated = useHydrated();
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<Extract<Awaited<ReturnType<typeof submitRegistration>>, { ok: false }>>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setFailure(undefined);

    const result = await submitRegistration(new FormData(event.currentTarget));
    if (result.ok) {
      window.location.replace("/login?registered=1");
      return;
    }

    setFailure(result);
    submitting.current = false;
    setLoading(false);
  }

  return (
    <AccessScreen title="Crear una cuenta" description="Registra tus comidas y cómo te sientan.">
      <form method="post" onSubmit={handleSubmit} className="app-form" aria-busy={loading} aria-describedby={failure ? "registration-error" : undefined}>
        <label htmlFor="name">
          Nombre <span className="app-muted font-normal">(opcional)</span>
          <input id="name" name="name" autoComplete="name" maxLength={100} readOnly={loading} className="app-field" />
        </label>
        <label htmlFor="email">
          Correo electrónico
          <input id="email" name="email" type="email" autoComplete="email" aria-invalid={failure?.duplicate} aria-describedby={failure?.duplicate ? "registration-error" : undefined} readOnly={loading} className="app-field" required />
        </label>
        <div>
          <label htmlFor="password">Contraseña</label>
          <input
            id="password" name="password" type="password" autoComplete="new-password" minLength={12} required readOnly={loading} className="app-field"
            aria-invalid={failure?.field === "password"}
            aria-describedby={failure?.field === "password" ? "password-help registration-error" : "password-help"}
          />
          <p id="password-help" className="app-muted mt-2 text-sm">
            Al menos 12 caracteres y máximo 72 bytes UTF-8. Las letras acentuadas y los emojis ocupan varios bytes.
          </p>
        </div>
        <button type="submit" disabled={!hydrated || loading} className="app-button app-button-primary">
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
      <p role="status" className="sr-only">{loading ? "Creando cuenta…" : ""}</p>
      {failure && <p id="registration-error" role="alert" className="app-feedback app-error mt-3">{failure.error}</p>}
      <p className="mt-3 text-sm"><Link href="/login" className="app-link">Iniciar sesión</Link></p>
    </AccessScreen>
  );
}
