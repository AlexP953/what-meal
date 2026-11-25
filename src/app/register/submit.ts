export async function submitRegistration(form: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const name = String(form.get("name") ?? "").trim();
    const response = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password"), ...(name ? { name } : {}) }),
    });
    if (response.status === 201) return { ok: true };
    const messages: Record<number, string> = {
      400: "Comprueba el correo, el nombre y la contraseña: mínimo 12 caracteres y máximo 72 bytes UTF-8.",
      409: "Ese correo ya está registrado. Puedes iniciar sesión.",
      429: "Se alcanzó el límite de registros. Inténtalo más tarde.",
    };
    return { ok: false, error: messages[response.status] ?? "No se pudo crear la cuenta. Inténtalo más tarde." };
  } catch {
    return { ok: false, error: "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo." };
  }
}
