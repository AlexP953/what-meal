"use client";

import DiaryDialog from "./DiaryDialog";
import MealFields from "./MealFields";
import type { DiaryChange } from "./diary-client";
import { readMealFields } from "./mutation-client";
import useMealMutation from "./useMealMutation";

const missingName = "Escribe el nombre de la comida.";

export default function AddMealModal({ onClose, onCreated, onCheckDiary, onSessionLost, userId }: {
  onClose: () => void;
  onCreated: (change: DiaryChange) => void;
  onCheckDiary: () => void;
  onSessionLost: () => void;
  userId: string;
}) {
  const { submit, submitting, error, setError, uncertain } = useMealMutation(userId, change => {
    onCreated(change);
    onClose();
  }, onSessionLost);

  return (
    <DiaryDialog titleId="add-meal-title" onClose={onClose} submitting={submitting}>
      <h2 id="add-meal-title" className="dialog-heading">Añadir comida</h2>
      <form className="app-form" aria-busy={submitting} onSubmit={event => {
        event.preventDefault();
        const fields = readMealFields(event.currentTarget);
        if (!fields.name) {
          setError(missingName);
          return;
        }
        void submit({ method: "POST", fields });
      }}>
        <MealFields nameInvalid={error === missingName} />
        {error && <p id="meal-form-error" role="alert" className="app-feedback app-error">{error}</p>}
        {uncertain && (
          <p role="alert" className="app-feedback app-error">
            No pudimos confirmar el alta. Consulta el diario para comprobar si ya se añadió la comida antes de repetirla.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="app-button">Cancelar</button>
          {uncertain ? (
            <button type="button" onClick={onCheckDiary} className="app-button app-button-primary">Consultar diario</button>
          ) : (
            <button type="submit" disabled={submitting} className="app-button app-button-primary">
              {submitting ? "Guardando…" : "Guardar comida"}
            </button>
          )}
        </div>
      </form>
      <p role="status" className="sr-only">{submitting ? "Guardando comida…" : ""}</p>
    </DiaryDialog>
  );
}
