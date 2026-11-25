"use client";

import { useEffect, useRef, useState } from "react";
import type { MealLean } from "../types";
import { TrashIcon } from "@heroicons/react/24/outline";

import type { EditedMeal, MealReaction as Reaction, MealType } from "@/shared/meal";

export default function EditMealModal({
  onClose,
  meal,
  onUpdated,
  onDeleted,
  onSessionLost,
}: {
  onSessionLost: () => void;
  onClose: () => void;
  meal: MealLean;
  onUpdated: (meal: EditedMeal) => void;
  onDeleted: (mealId: string) => void;
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
    const type = String(fd.get("type") || "") as MealType;
    const reaction = String(fd.get("reaction") || "") as Reaction;
    const place = String(fd.get("place") || "").trim();
    const notes = String(fd.get("notes") || "").trim();

    if (!name) return setError("El nombre es obligatorio");
    if (!date) return setError("La fecha es obligatoria");
    if (!type) return setError("El tipo es obligatorio");
    if (!reaction) return setError("La reacción es obligatoria");

    setSubmitting(true);
    try {
      const res = await fetch(`/api/meals/${meal._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date, type, reaction, place, notes }),
      });

      if (res.status === 401) {
        onSessionLost();
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo actualizar la comida");
      const updatedMeal = json?.meal as EditedMeal | undefined;
      if (!updatedMeal?.id || !updatedMeal.userId) throw new Error("La respuesta de la edición está incompleta");
      onUpdated(updatedMeal);
      onClose();
    } catch (err) {
      setError((err instanceof Error ? err.message : "") || "No se pudo actualizar el meal");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Seguro que quieres eliminar este meal?")) return;

    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/meals/${meal._id}`, { method: "DELETE" });
      if (res.status === 401) {
        onSessionLost();
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "No se pudo eliminar la comida");
      }
      onDeleted(meal._id);
      onClose();
    } catch (err) {
      setError((err instanceof Error ? err.message : "") || "No se pudo eliminar el meal");
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
          <h2 className="text-lg font-semibold text-gray-900">Editar meal</h2>
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
              defaultValue={meal.name}
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
                defaultValue={meal.date}
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
                defaultValue={meal.type}
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="" disabled>-- Selecciona --</option>
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
              defaultValue={meal.reaction}
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
              defaultValue={meal.place}
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
              defaultValue={meal.notes}
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
              placeholder="¿Síntomas, sensaciones, etc.?"
            />
          </div>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="p-2 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-50"
              title="Eliminar meal"
            >
              <TrashIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
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
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 active:bg-green-800 disabled:opacity-60"
              >
                {submitting ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
