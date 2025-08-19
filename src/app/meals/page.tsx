"use client";

import { useEffect, useMemo, useState } from "react";
import { MealLean } from "../types";
import { useSession, signOut } from "next-auth/react";
import AddMealModal from "./AddMealModal";
import EditMealModal from "./EditMealModal";
import { FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";

type Reaction = "good" | "neutral" | "bad";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const typeLabels: Record<MealLean["type"], string> = {
  breakfast: "Desayuno",
  lunch: "Comida",
  dinner: "Cena",
  snack: "Snack",
};

export default function MealsPage() {
  const { data: session, status } = useSession();
  const [meals, setMeals] = useState<MealLean[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Crear
  const [openCreate, setOpenCreate] = useState(false);

  // Editar
  const [openEdit, setOpenEdit] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealLean | null>(null);

  // Filtros
  const [openFilters, setOpenFilters] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]); 
  const [type, setType] = useState<MealType | "">("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  function formatDate(date: string): string {
    if (!date) return "";
    const [y, m, d] = date.split("-");
    return `${d}-${m}-${y}`;
  }
  
  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated" || !session?.user?.id) {
      setLoading(false);
      return;
    }

    async function fetchMeals() {
      try {
        const res = await fetch(`/api/users/${session!.user!.id}`);
        if (!res.ok) throw new Error("Error en la petición");

        const data = await res.json();
        const rawMeals = Array.isArray(data.user?.meals) ? data.user.meals : [];
        setMeals(rawMeals.filter(Boolean));
      } catch (err) {
        setError("No se pudieron cargar las comidas");
      } finally {
        setLoading(false);
      }
    }

    fetchMeals();
  }, [session?.user?.id, status]);

  // Crear
  function handleCreated(newMeal: MealLean | undefined) {
    if (!newMeal || !newMeal._id || !newMeal.reaction) return;
    setMeals((prev) => [newMeal, ...prev.filter(Boolean)]);
    setOpenCreate(false);
  }

  // Editar
  function openEditModal(meal: MealLean) {
    setSelectedMeal(meal);
    setOpenEdit(true);
  }

  function handleUpdated(updated: MealLean) {
    setMeals((prev) =>
      prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m))
    );
    setOpenEdit(false);
    setSelectedMeal(null);
  }

  function handleDeleted(mealId: string) {
    setMeals((prev) => prev.filter((m) => m._id !== mealId));
  }

  const filteredMeals = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;

    return [...meals]
      .filter((m) => {
        if (reactions.length && !reactions.includes(m.reaction as Reaction))
          return false;

        if (type && m.type !== type) return false;

        if (from || to) {
          const md = new Date(m.date);
          if (from && md < from) return false;
          if (to) {
            const toEnd = new Date(to);
            toEnd.setHours(23, 59, 59, 999);
            if (md > toEnd) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return sortDir === "desc" ? db - da : da - db;
      });
  }, [meals, reactions, type, dateFrom, dateTo, sortDir]);

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

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Tus comidas</h1>

        <button
          onClick={() => setOpenFilters(true)}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100"
          title="Filtros"
        >
          <FunnelIcon className="h-5 w-5" />
          Filtros
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {reactions.length > 0 && (
          <span className="rounded-full bg-gray-200 px-3 py-1">
            Reacción: {reactions.join(", ")}
          </span>
        )}
        {type && (
          <span className="rounded-full bg-gray-200 px-3 py-1">
            Tipo: {type}
          </span>
        )}
        {(dateFrom || dateTo) && (
          <span className="rounded-full bg-gray-200 px-3 py-1">
            Fecha: {dateFrom || "–"} → {dateTo || "–"}
          </span>
        )}
        <span className="rounded-full bg-gray-100 px-3 py-1">
          Orden: {sortDir === "desc" ? "Más nuevas" : "Más antiguas"}
        </span>
        {(reactions.length || type || dateFrom || dateTo) && (
          <button
            onClick={clearFilters}
            className="ml-2 text-gray-600 underline decoration-dotted hover:text-gray-800"
          >
            Limpiar
          </button>
        )}
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-red-500">{error}</p>}

      <div className="space-y-3">
        {filteredMeals.map((meal) => (
          <button
            key={meal._id}
            onClick={() => openEditModal(meal)}
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
                  {typeLabels[meal.type]} • {formatDate(meal.date)}
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
        {!loading && filteredMeals.length === 0 && (
          <p className="text-gray-500">
            No hay resultados con los filtros actuales.
          </p>
        )}
      </div>

      {status === "authenticated" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
          <button
            onClick={() => setOpenCreate(true)}
            className="px-6 py-3 rounded-full bg-green-600 text-white font-semibold shadow-lg hover:bg-green-700 active:bg-green-800 transition"
          >
            + Añadir comida
          </button>
        </div>
      )}

      <AddMealModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={handleCreated}
        userId={session?.user?.id ?? ""}
      />

      <EditMealModal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        meal={selectedMeal}
        onUpdated={handleUpdated}
        onDeleted={() => selectedMeal && handleDeleted(selectedMeal._id)}
      />

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
      {status === "authenticated" && (
        <span className="flex justify-end">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-20 px-3 py-1 my-8 rounded-lg border bg-white hover:bg-gray-50 text-sm text-gray-700"
          >
            Logout
          </button>
        </span>
      )}
    </div>
  );
}
