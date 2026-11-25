import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authz";

export default async function MealsLayout({ children }: { children: React.ReactNode }) {
  const { session, error } = await requireSession();
  if (!session) {
    if (error.status === 503) {
      return (
        <main className="space-y-2 p-6">
          <p role="alert">Servicio temporalmente no disponible.</p>
          <form action="/meals">
            <button type="submit" className="underline">Volver a comprobar la sesión</button>
          </form>
        </main>
      );
    }
    redirect("/login");
  }
  return children;
}
