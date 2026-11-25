import { postAuth } from "../session-client";

export async function submitLogin(form: FormData) {
  const response = await postAuth("callback/credentials", new URLSearchParams({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    callbackUrl: "/meals",
  }));

  if (response?.status === 429) return "limited";
  if (!response || !response.ok) return "service";

  const { url } = await response.json();
  if (typeof url !== "string") return "service";
  const destination = new URL(url);
  const error = destination.searchParams.get("error");
  if (error === "CredentialsSignin") return "invalid";
  return !error && destination.pathname === "/meals" ? "ok" : "service";
}
