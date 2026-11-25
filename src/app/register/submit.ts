export async function submitRegistration(form: FormData): Promise<{ ok: true } | { ok: false; error: string; duplicate?: boolean; field?: "password" }> {
  const password = String(form.get("password") ?? "");
  if (Array.from(password).length < 12 || new TextEncoder().encode(password).length > 72) {
    return { ok: false, field: "password", error: "Usa al menos 12 caracteres y un máximo de 72 bytes UTF-8." };
  }
  try {
    const name = String(form.get("name") ?? "").trim();
    const response = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password, ...(name ? { name } : {}) }),
    });
    if (response.status === 201) return { ok: true };
    if (response.status === 409) return { ok: false, duplicate: true, error: "Ese correo ya está registrado." };
    const messages: Record<number, string> = {
      400: "Comprueba el correo, el nombre y la contraseña: mínimo 12 caracteres y máximo 72 bytes UTF-8.",
      429: "Se alcanzó el límite de registros. Inténtalo más tarde.",
    };
    return { ok: false, error: messages[response.status] ?? "No se pudo crear la cuenta. Inténtalo más tarde." };
  } catch {
    return { ok: false, error: "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo." };
  }
}
