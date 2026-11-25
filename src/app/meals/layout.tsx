import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authz";

export default async function MealsLayout({ children }: { children: React.ReactNode }) {
  const { session, error } = await requireSession();
  if (!session) {
    if (error.status === 503) return <main role="alert" className="p-6">Servicio temporalmente no disponible. Inténtalo más tarde.</main>;
    redirect("/login");
  }
  return children;
}
