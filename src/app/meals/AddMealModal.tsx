"use client";

import { useEffect, useRef, useState } from "react";
import { MealLean } from "../types";

type Reaction = "good" | "neutral" | "bad";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export default function AddMealModal({
  open,
  onClose,
  onCreated,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (meal: MealLean) => void;
  userId: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, 
          name,
          date,
          type,
          reaction,
          place,
          notes,
        }),
      });

      const raw = await res.text(); 
      let json: any = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        if (!res.ok) throw new Error(raw || `HTTP ${res.status}`);
      }

      if (!res.ok) {
        const msg = json?.error || json?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const m = json?.meal ?? {};
      const created: MealLean = {
        _id: String(m._id),
        userId: String(m.userId ?? userId),
        name: String(m.name ?? name),
        date: String(m.date ?? date),
        type: (m.type ?? type) as MealLean["type"],
        reaction: (m.reaction ?? reaction) as MealLean["reaction"],
        place: m.place ?? place,
        notes: m.notes ?? notes,
      };

      if (!created._id || !created.userId || !created.reaction) {
        throw new Error("Objeto creado incompleto");
      }

      onCreated(created); 
      onClose(); 
    } catch (err: any) {
      setError(err?.message || "No se pudo crear el meal");
      console.error("Create meal error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
      onClick={onClose} 
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
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
