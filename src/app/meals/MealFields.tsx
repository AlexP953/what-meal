import { mealReactions, mealTypes } from "@/shared/meal";
import type { DiaryMeal } from "./diary-client";
import { reactionLabels, typeLabels } from "./labels";

export default function MealFields({ meal, nameInvalid }: { meal?: DiaryMeal; nameInvalid: boolean }) {
  return (
    <>
      <label htmlFor="meal-name">
        Nombre
        <input id="meal-name" name="name" defaultValue={meal?.name} className="app-field" required
          aria-invalid={nameInvalid} aria-describedby={nameInvalid ? "meal-form-error" : undefined} />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label htmlFor="meal-date" className="min-w-0">
          Fecha
          <input type="date" id="meal-date" name="date" defaultValue={meal?.date} className="app-field" required />
        </label>

        <label htmlFor="meal-type">
          Tipo
          <select id="meal-type" name="type" defaultValue={meal?.type ?? "dinner"} className="app-field" required>
            {mealTypes.map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </select>
        </label>
      </div>

      <label htmlFor="meal-reaction">
        Reacción
        <select id="meal-reaction" name="reaction" defaultValue={meal?.reaction ?? "neutral"} className="app-field" required>
          {mealReactions.map(reaction => <option key={reaction} value={reaction}>{reactionLabels[reaction]}</option>)}
        </select>
      </label>

      <label htmlFor="meal-place">
        Lugar <span className="app-muted font-normal">(opcional)</span>
        <input id="meal-place" name="place" defaultValue={meal?.place ?? ""} className="app-field" />
      </label>

      <label htmlFor="meal-notes">
        Notas <span className="app-muted font-normal">(opcional)</span>
        <textarea id="meal-notes" name="notes" defaultValue={meal?.notes ?? ""} rows={3} className="app-field" />
      </label>
    </>
  );
}
