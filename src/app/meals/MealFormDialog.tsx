"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocus = useRef(false);
  const { submit, submitting, error, setError, uncertain } = useMealMutation(userId, change => {
    const message = "id" in change ? "Comida eliminada." : meal ? "Cambios guardados." : "Comida añadida.";
    onConfirmed(change, message);
    onClose();
  }, onSessionLost);

  useLayoutEffect(() => {
    if (confirmDelete) cancelDelete.current?.focus();
    else if (restoreDeleteFocus.current) deleteButton.current?.focus();
  }, [confirmDelete]);

  function close() {
    if (confirmDelete && !uncertain) {
      restoreDeleteFocus.current = true;
      setError("");
      setConfirmDelete(false);
    } else {
      onClose();
    }
  }

  const title = confirmDelete ? "Eliminar comida" : meal ? "Editar comida" : "Añadir comida";
  const uncertainMessage = confirmDelete
    ? "No pudimos confirmar el borrado. Consulta el diario y comprueba si la comida sigue allí antes de repetir la operación."
    : meal
      ? "No pudimos confirmar los cambios. Consulta el diario y comprueba los datos actuales de la comida antes de repetir la operación."
      : "No pudimos confirmar el alta. Consulta el diario para comprobar si ya se añadió la comida antes de repetirla.";

  return (
    <DiaryDialog titleId="meal-dialog-title" onClose={close} submitting={submitting} fallbackFocus={fallbackFocus}>
      <header className="dialog-header">
        <h2 id="meal-dialog-title">{title}</h2>
        <button type="button" className="app-button dialog-icon" aria-label="Cerrar" onClick={close} disabled={submitting}>
          <XMarkIcon aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>

      <form className={confirmDelete ? "hidden" : "app-form"} aria-busy={submitting} aria-describedby={error && !confirmDelete ? "meal-form-error" : undefined}
        onSubmit={event => {
          event.preventDefault();
          if (confirmDelete || submitting || uncertain) return;
          const fields = readMealFields(event.currentTarget);
          if (!fields.name) {
            setError(missingName);
            return;
          }
          void submit(meal ? { method: "PATCH", meal, fields } : { method: "POST", fields });
        }}>
        <MealFields meal={meal} nameInvalid={error === missingName} />
        {!confirmDelete && error && <p id="meal-form-error" role="alert" className="app-feedback app-error">{error}</p>}
        {!confirmDelete && uncertain && <p role="alert" className="app-feedback app-error">{uncertainMessage}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          {meal && !uncertain && (
            <button ref={deleteButton} type="button" disabled={submitting} className="app-link app-danger-link" onClick={() => {
              setError("");
              setConfirmDelete(true);
            }}>Eliminar</button>
          )}
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} disabled={submitting} className="app-button">Cancelar</button>
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

      {confirmDelete && meal && (
        <div className="mt-4 space-y-4">
          <p className="wrap-anywhere">¿Quieres eliminar <strong>{meal.name}</strong> de tu diario?</p>
          {error && <p role="alert" className="app-feedback app-error">{error}</p>}
          {uncertain && <p role="alert" className="app-feedback app-error">{uncertainMessage}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button ref={cancelDelete} type="button" className="app-button" disabled={submitting} onClick={close}>Cancelar</button>
            {uncertain ? (
              <button type="button" onClick={onCheckDiary} className="app-button app-button-primary">Consultar diario</button>
            ) : (
              <button type="button" className="app-button app-button-danger" disabled={submitting}
                onClick={() => void submit({ method: "DELETE", meal })}>
                {submitting ? "Eliminando…" : "Eliminar comida"}
              </button>
            )}
          </div>
        </div>
      )}
      <p role="status" className="sr-only">{submitting ? confirmDelete ? "Eliminando comida…" : "Guardando comida…" : ""}</p>
    </DiaryDialog>
  );
}
