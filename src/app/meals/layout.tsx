import { redirect } from "next/navigation";
import AccessScreen from "../components/AccessScreen";
import { requireSession } from "@/lib/authz";

export default async function MealsLayout({ children }: { children: React.ReactNode }) {
  const { session, error } = await requireSession();
  if (!session) {
    if (error.status === 503) {
      return (
        <AccessScreen title="Diario de comidas" description="Comprueba tu sesión para volver al diario.">
          <p role="alert" className="app-feedback app-error mt-4">No pudimos verificar tu sesión. El servicio no está disponible en este momento.</p>
          <form action="/meals" className="mt-4">
            <button type="submit" className="app-button app-button-primary">Volver a comprobar la sesión</button>
          </form>
        </AccessScreen>
      );
    }
    redirect("/login");
  }
  return children;
}
