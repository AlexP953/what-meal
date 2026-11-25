"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { isCivilDate } from "@/shared/meal";
import { XMarkIcon } from "@heroicons/react/24/outline";
import DiaryDialog from "./DiaryDialog";
import MealFields from "./MealFields";
import type { DiaryChange, DiaryMeal } from "./diary-client";
import type { DiaryDraft, MealDraft } from "./diary-draft";
import { readMealDraft, readMealFields } from "./mutation-client";
import useMealMutation from "./useMealMutation";

const missingName = "Escribe el nombre de la comida.";
const invalidDate = "Introduce una fecha válida con un año de cuatro cifras.";

export default function MealFormDialog({ meal, initialDraft, captureRef, onClose, onConfirmed, fallbackFocus, onCheckDiary, onSessionLost, onStart, userId }: {
  meal?: DiaryMeal;
  initialDraft?: MealDraft;
  captureRef: RefObject<(() => DiaryDraft) | null>;
  onClose: () => void;
  onConfirmed: (change: DiaryChange, message: string) => void;
  fallbackFocus: RefObject<HTMLButtonElement | null>;
  onCheckDiary: () => void;
  onSessionLost: () => void;
  onStart: () => void;
  userId: string;
}) {
  const [confirmDelete, setConfirmDelete] = useState(initialDraft?.confirmDelete ?? false);
  const form = useRef<HTMLFormElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocus = useRef(false);
  const { submit, submitting, error, setError, uncertain, pending, uncertainRef } = useMealMutation(userId, change => {
    const message = "id" in change ? "Comida eliminada." : meal ? "Cambios guardados." : "Comida añadida.";
    captureRef.current = null;
    onConfirmed(change, message);
    onClose();
  }, () => {
    captureRef.current = null;
    onSessionLost();
  }, onStart, initialDraft?.uncertain);

  useLayoutEffect(() => {
    const element = form.current;
    if (!element) return;
    captureRef.current = () => ({
      kind: "meal", meal, values: readMealDraft(element), confirmDelete,
      // An interrupted request may have committed before its response was discarded.
      uncertain: uncertainRef.current || pending.current !== null,
    });
    return () => { captureRef.current = null; };
  }, [captureRef, meal, confirmDelete, uncertainRef, pending]);

  useLayoutEffect(() => {
    if (confirmDelete) cancelDelete.current?.focus();
    else if (restoreDeleteFocus.current) deleteButton.current?.focus();
  }, [confirmDelete]);

  function close() {
    if (uncertain) {
      onCheckDiary();
    } else if (confirmDelete) {
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

      <form ref={form} noValidate className={confirmDelete ? "hidden" : "app-form"} aria-busy={submitting} aria-describedby={error && !confirmDelete ? "meal-form-error" : undefined}
        onSubmit={event => {
          event.preventDefault();
          if (confirmDelete || submitting || uncertain) return;
          const fields = readMealFields(event.currentTarget);
          if (!fields.name) {
            onStart();
            setError(missingName);
            return;
          }
          if (!isCivilDate(fields.date)) {
            onStart();
            setError(invalidDate);
            return;
          }
          void submit(meal ? { method: "PATCH", meal, fields } : { method: "POST", fields });
        }}>
        <fieldset disabled={submitting} className="grid min-w-0 gap-4">
          <MealFields meal={meal} values={initialDraft?.values} nameInvalid={error === missingName} dateInvalid={error === invalidDate} />
        </fieldset>
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
