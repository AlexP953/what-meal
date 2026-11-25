"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MealLean } from "../types";
import { useSession, signOut } from "next-auth/react";
import AddMealModal from "./AddMealModal";
import EditMealModal from "./EditMealModal";
import { diarySearch, formatMealDate, readDiary } from "./diary-client";
import { FunnelIcon, XMarkIcon, Bars3Icon } from "@heroicons/react/24/outline";
import EnableNotifications from "../components/EnableNotifications";

import type { MealReaction as Reaction, MealType } from "@/shared/meal";

const typeLabels: Record<MealLean["type"], string> = {
  breakfast: "Desayuno",
  lunch: "Comida",
  dinner: "Cena",
  snack: "Snack",
};

export default function MealsPage() {
  const { data: session, status, update } = useSession();
  if (status === "loading") return <p className="p-6" role="status">Cargando...</p>;
  const userId = session?.user?.id;
  if (status !== "authenticated" || !userId) {
    return (
      <div className="flex gap-4 p-6">
        <button type="button" className="underline" onClick={() => void update()}>Volver a comprobar la sesión</button>
        <Link href="/login" className="underline">Iniciar sesión</Link>
      </div>
    );
  }
  return <AccountMeals key={userId} userId={userId} />;
}

function AccountMeals({ userId }: { userId: string }) {
  const [meals, setMeals] = useState<MealLean[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [revision, setRevision] = useState(0);
  const pendingRequest = useRef<AbortController>(null);

  const [openCreate, setOpenCreate] = useState(false);

  const [selectedMeal, setSelectedMeal] = useState<MealLean | null>(null);

  const [openFilters, setOpenFilters] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [type, setType] = useState<MealType | "">("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("click", handleClickOutside);
    } else {
      document.removeEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [menuOpen]);

  const expireSession = useCallback(() => {
    pendingRequest.current?.abort();
    setMeals([]);
    setOpenCreate(false);
    setSelectedMeal(null);
    setSessionExpired(true);
  }, []);

  const search = diarySearch({ type, reactions, dateFrom, dateTo, sortDir }).toString();
  useEffect(() => {
    if (sessionExpired) return;
    const controller = new AbortController();
    const { signal } = controller;
    pendingRequest.current = controller;

    async function load() {
      try {
        const result = await readDiary(search, userId, signal);
        if (signal.aborted) return;
        if (result === null) {
          expireSession();
          return;
        }
        setMeals(result);
        setError("");
      } catch {
        if (!signal.aborted) setError("No se pudieron cargar las comidas");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [search, revision, sessionExpired, userId, expireSession]);

  function refresh() {
    pendingRequest.current?.abort();
    setRevision(value => value + 1);
  }

  function toggleReaction(r: Reaction) {
    setReactions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  }

  function clearFilters() {
    setReactions([]);
    setType("");
    setDateFrom("");
    setDateTo("");
    setSortDir("desc");
  }

  if (sessionExpired) {
    return (
      <div className="p-6">
        <p role="alert">La sesión ya no está disponible.</p>
        <Link href="/login" className="underline">Iniciar sesión</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col relative pb-32">
      <div className="mb-4 flex items-center justify-between relative z-10">
        <h1 className="text-2xl font-bold text-gray-800">Tus comidas</h1>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpenFilters(true)}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 relative z-20"
            style={{ color: "#473f3f" }}
            title="Filtros"
          >
            <FunnelIcon className="h-5 w-5" />
            Filtros
          </button>

          <div className="relative z-30" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-green-700"
              aria-label="Menú"
              aria-expanded={menuOpen}
            >
              <Bars3Icon className="h-6 w-6 text-gray-700" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 pb-2 border-b border-gray-100">
                  <EnableNotifications onDone={() => setMenuOpen(false)} />
                </div>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: "/login" });
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && <p style={{ color: "#473f3f" }}>Cargando...</p>}
      {error && <p className="text-red-500" role="alert">{error}</p>}

      <div className="space-y-3 mt-4">
        {meals.map((meal) => (
          <button
            key={meal._id}
            onClick={() => setSelectedMeal(meal)}
            className={`w-full text-left rounded-xl border bg-white px-4 py-3 shadow-sm transition hover:shadow ${
              meal.reaction === "good"
                ? "border-green-200 bg-green-50"
                : meal.reaction === "bad"
                ? "border-red-200 bg-red-50"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">{meal.name}</p>
                <p className="text-sm text-gray-500">
                  {typeLabels[meal.type]} • {formatMealDate(meal.date)}
                </p>
                {meal.place && (
                  <p className="text-sm text-gray-400">{meal.place}</p>
                )}
                {meal.notes && (
                  <p className="text-sm text-gray-400 italic">“{meal.notes}”</p>
                )}
              </div>

              <span
                className={`text-sm font-semibold ${
                  meal.reaction === "good"
                    ? "text-green-600"
                    : meal.reaction === "bad"
                    ? "text-red-600"
                    : "text-gray-400"
                }`}
              >
                {meal.reaction === "good"
                  ? "✅ Bien"
                  : meal.reaction === "bad"
                  ? "❌ Mal"
                  : "• Neutral"}
              </span>
            </div>
          </button>
        ))}
        {!loading && !error && meals.length === 0 && (
          <p className="text-gray-500">
            No hay resultados con los filtros actuales.
          </p>
        )}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
        <button
          onClick={() => setOpenCreate(true)}
          className="px-6 py-3 rounded-full bg-green-600 text-white font-semibold shadow-lg hover:bg-green-700 active:bg-green-800 transition"
        >
          + Añadir comida
        </button>
      </div>

      {openCreate && (
        <AddMealModal
          onClose={() => setOpenCreate(false)}
          onCreated={refresh}
          onSessionLost={expireSession}
          userId={userId}
        />
      )}
      {selectedMeal && (
        <EditMealModal
          onClose={() => setSelectedMeal(null)}
          meal={selectedMeal}
          onUpdated={refresh}
          onDeleted={refresh}
          onSessionLost={expireSession}
        />
      )}
      {openFilters && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenFilters(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-xl mx-0 sm:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
              <button
                onClick={() => setOpenFilters(false)}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Reacción
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["good", "neutral", "bad"] as Reaction[]).map((r) => {
                    const active = reactions.includes(r);
                    const label =
                      r === "good" ? "Bien" : r === "bad" ? "Mal" : "Neutral";
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleReaction(r)}
                        className={`px-3 py-1 rounded-full text-sm border transition ${
                          active
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MealType | "")}
                  className="w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Todos</option>
                  <option value="breakfast">Desayuno</option>
                  <option value="lunch">Comida</option>
                  <option value="dinner">Cena</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Orden por fecha
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSortDir("desc")}
                    className={`px-3 py-1 rounded-lg border text-sm ${
                      sortDir === "desc"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    Más nuevas
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortDir("asc")}
                    className={`px-3 py-1 rounded-lg border text-sm ${
                      sortDir === "asc"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    Más antiguas
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 underline decoration-dotted hover:text-gray-800"
              >
                Limpiar filtros
              </button>
              <button
                onClick={() => setOpenFilters(false)}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 active:bg-green-800"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
