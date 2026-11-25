"use client";

import { useEffect, useRef, useState } from "react";

import { EXPECTED_MEAL_ACCOUNT_HEADER, type ListedMeal, type MealReaction as Reaction, type MealType } from "@/shared/meal";
import { isDiarySessionLost } from "./diary-client";

export default function AddMealModal({
  onClose,
  onCreated,
  onSessionLost,
  userId,
}: {
  onSessionLost: () => void;
  onClose: () => void;
  onCreated: (meal: ListedMeal) => void;
  userId: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const date = String(fd.get("date") || "");
    const type = String(fd.get("type") || "dinner") as MealType;
    const reaction = String(fd.get("reaction") || "neutral") as Reaction;
    const place = String(fd.get("place") || "").trim() || undefined;
    const notes = String(fd.get("notes") || "").trim() || undefined;

    if (!name) return setError("El nombre es obligatorio");
    if (!date) return setError("La fecha es obligatoria");
    if (!type) return setError("El tipo es obligatorio");
    if (!reaction) return setError("La reacción es obligatoria");

    setSubmitting(true);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json", [EXPECTED_MEAL_ACCOUNT_HEADER]: userId },
        body: JSON.stringify({
          name,
          date,
          type,
          reaction,
          place,
          notes,
        }),
      });

      if (isDiarySessionLost(res)) {
        onSessionLost();
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo crear la comida");
      const meal = json as ListedMeal | null;
      if (!meal?.id || !meal.user) throw new Error("La respuesta del alta está incompleta");
      if (meal.user !== userId) {
        onSessionLost();
        return;
      }

      onCreated(meal);
      onClose(); 
    } catch (err) {
      setError((err instanceof Error ? err.message : "") || "No se pudo crear el meal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
      onClick={submitting ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        ref={dialogRef}
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-xl mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Añadir comida</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-8 w-8 grid place-items-center rounded-full hover:bg-gray-100"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre *
            </label>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Pizza Margarita"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha *
              </label>
              <input
                type="date"
                name="date"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Momento *
              </label>
              <select
                name="type"
                defaultValue="dinner"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="breakfast">Desayuno</option>
                <option value="lunch">Comida</option>
                <option value="dinner">Cena</option>
                <option value="snack">Snack</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Reacción *
            </label>
            <select
              name="reaction"
              defaultValue="neutral"
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="good">Bien</option>
              <option value="neutral">Neutral</option>
              <option value="bad">Mal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Lugar
            </label>
            <input
              name="place"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Restaurante Italiano"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notas
            </label>
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
              placeholder="¿Síntomas, sensaciones, etc.?"
            />
          </div>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
            disabled={submitting}
              className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !userId}
              className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 active:bg-green-800 disabled:opacity-60"
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
