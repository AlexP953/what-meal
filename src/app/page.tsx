import { requireSession } from "@/lib/authz";
import LoginPage from "@/app/login/page";
import MealsPage from "@/app/meals/page";

export default async function Home() {
  const { session, error } = await requireSession();

  return <> {session ? <MealsPage/> : <LoginPage/>}</>;
}
