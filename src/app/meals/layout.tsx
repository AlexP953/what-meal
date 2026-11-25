import { redirect } from "next/navigation";
import SessionUnavailable from "./SessionUnavailable";
import { requireSession } from "@/lib/authz";

export default async function MealsLayout({ children }: { children: React.ReactNode }) {
  const { session, error } = await requireSession();
  if (!session) {
    if (error.status === 503) return <SessionUnavailable />;
    redirect("/login");
  }
  return children;
}
