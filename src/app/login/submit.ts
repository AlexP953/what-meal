import { postAuth } from "../session-client";

type LoginOutcome = "limited" | "service" | "invalid" | "ok";

export async function submitLogin(form: FormData): Promise<LoginOutcome> {
  let outcome: LoginOutcome = "service";
  await postAuth("callback/credentials", new URLSearchParams({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    callbackUrl: "/meals",
  }), async response => {
    if (response.status === 429) {
      outcome = "limited";
      return;
    }
    if (!response.ok) return;
    const { url } = await response.json();
    if (typeof url !== "string") return;
    const destination = new URL(url);
    const error = destination.searchParams.get("error");
    if (error === "CredentialsSignin") outcome = "invalid";
    else if (!error && destination.pathname === "/meals") outcome = "ok";
  });
  return outcome;
}
