"use client";

import type { RefObject } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import DiaryDialog from "./DiaryDialog";
import MealFields from "./MealFields";
import type { DiaryChange, DiaryMeal } from "./diary-client";
import { readMealFields } from "./mutation-client";
import useMealMutation from "./useMealMutation";

const missingName = "Escribe el nombre de la comida.";

export default function MealFormDialog({ meal, onClose, onConfirmed, fallbackFocus, onCheckDiary, onSessionLost, userId }: {
  meal?: DiaryMeal;
  onClose: () => void;
  onConfirmed: (change: DiaryChange, message: string) => void;
  fallbackFocus: RefObject<HTMLButtonElement | null>;
  onCheckDiary: () => void;
  onSessionLost: () => void;
  userId: string;
}) {
  const { submit, submitting, error, setError, uncertain } = useMealMutation(userId, change => {
    const message = "id" in change ? "Comida eliminada." : meal ? "Cambios guardados." : "Comida añadida.";
    onConfirmed(change, message);
    onClose();
  }, onSessionLost);

  return (
    <DiaryDialog titleId="meal-dialog-title" onClose={onClose} submitting={submitting} fallbackFocus={fallbackFocus}>
      <header className="dialog-header">
        <h2 id="meal-dialog-title">{meal ? "Editar comida" : "Añadir comida"}</h2>
        <button type="button" className="app-button dialog-icon" aria-label="Cerrar" onClick={onClose} disabled={submitting}>
          <XMarkIcon aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>
      <form className="app-form" aria-busy={submitting} aria-describedby={error ? "meal-form-error" : undefined} onSubmit={event => {
        event.preventDefault();
        const fields = readMealFields(event.currentTarget);
        if (!fields.name) {
          setError(missingName);
          return;
        }
        void submit(meal ? { method: "PATCH", meal, fields } : { method: "POST", fields });
      }}>
        <MealFields meal={meal} nameInvalid={error === missingName} />
        {error && <p id="meal-form-error" role="alert" className="app-feedback app-error">{error}</p>}
        {uncertain && (
          <p role="alert" className="app-feedback app-error">
            {meal
              ? "No pudimos confirmar los cambios. Consulta el diario y comprueba los datos actuales de la comida antes de repetir la operación."
              : "No pudimos confirmar el alta. Consulta el diario para comprobar si ya se añadió la comida antes de repetirla."}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          {meal && !uncertain && (
            <button type="button" disabled={submitting} className="app-link text-red-800" onClick={() => {
              if (window.confirm("¿Seguro que quieres eliminar esta comida?")) void submit({ method: "DELETE", meal });
            }}>Eliminar</button>
          )}
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} disabled={submitting} className="app-button">Cancelar</button>
            {uncertain ? (
              <button type="button" onClick={onCheckDiary} className="app-button app-button-primary">Consultar diario</button>
            ) : (
              <button type="submit" disabled={submitting} className="app-button app-button-primary">
                {submitting ? "Guardando…" : meal ? "Guardar cambios" : "Guardar comida"}
              </button>
            )}
          </div>
        </div>
      </form>
      <p role="status" className="sr-only">{submitting ? "Guardando comida…" : ""}</p>
    </DiaryDialog>
  );
}
