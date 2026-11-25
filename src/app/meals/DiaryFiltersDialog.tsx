import { useLayoutEffect, useState, type RefObject } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { mealReactions, mealTypes, type MealType } from "@/shared/meal";
import type { DiaryDraft } from "./diary-draft";
import DiaryDialog from "./DiaryDialog";
import { dateRangeError, defaultDiaryFilters, type DiaryFilters } from "./diary-client";
import { reactionLabels, typeLabels } from "./labels";

export default function DiaryFiltersDialog({ filters, captureRef, onClose, onApply }: {
  filters: DiaryFilters;
  captureRef: RefObject<(() => DiaryDraft) | null>;
  onClose: () => void;
  onApply: (filters: DiaryFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  useLayoutEffect(() => {
    captureRef.current = () => ({ kind: "filters", filters: draft });
    return () => { captureRef.current = null; };
  }, [captureRef, draft]);

  const rangeError = dateRangeError(draft.dateFrom, draft.dateTo);

  return (
    <DiaryDialog titleId="diary-filter-title" onClose={onClose}>
      <header className="dialog-header">
        <h2 id="diary-filter-title">Filtros</h2>
        <button type="button" className="app-button dialog-icon" aria-label="Cerrar" onClick={onClose}>
          <XMarkIcon aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>
      <form className="app-form" onSubmit={event => {
        event.preventDefault();
        if (!rangeError) onApply(draft);
      }}>
        <label htmlFor="diary-filter-type">
          Tipo
          <select id="diary-filter-type" className="app-field" value={draft.type}
            onChange={event => setDraft({ ...draft, type: event.target.value as MealType | "" })}>
            <option value="">Todos</option>
            {mealTypes.map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </select>
        </label>

        <fieldset>
          <legend className="font-semibold">Reacción</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {mealReactions.map(reaction => {
              const active = draft.reactions.includes(reaction);
              return (
                <button key={reaction} type="button" className="app-button" aria-pressed={active}
                  onClick={() => setDraft({
                    ...draft,
                    reactions: active ? draft.reactions.filter(value => value !== reaction) : [...draft.reactions, reaction],
                  })}>
                  {reactionLabels[reaction]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([{ field: "dateFrom", label: "Desde" }, { field: "dateTo", label: "Hasta" }] as const).map(({ field, label }) => (
            <label key={field} htmlFor={field}>
              {label}
              <input type="date" id={field} className="app-field" value={draft[field]}
                aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? "diary-filter-date-error" : undefined}
                onChange={event => setDraft({ ...draft, [field]: event.target.value })} />
            </label>
          ))}
        </div>
        {rangeError && <p id="diary-filter-date-error" role="alert" className="app-feedback app-error">{rangeError}</p>}

        <label htmlFor="diary-filter-order">
          Orden por fecha
          <select id="diary-filter-order" className="app-field" value={draft.sortDir}
            onChange={event => setDraft({ ...draft, sortDir: event.target.value === "asc" ? "asc" : "desc" })}>
            <option value="desc">Más nuevas primero</option>
            <option value="asc">Más antiguas primero</option>
          </select>
        </label>

        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" onClick={() => onApply(defaultDiaryFilters)} className="app-link">Limpiar filtros</button>
          <button type="submit" disabled={Boolean(rangeError)} className="app-button app-button-primary">Aplicar filtros</button>
        </div>
      </form>
    </DiaryDialog>
  );
}
