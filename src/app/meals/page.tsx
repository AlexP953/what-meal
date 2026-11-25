"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AddMealModal from "./AddMealModal";
import EditMealModal from "./EditMealModal";
import DiaryDialog from "./DiaryDialog";
import {
  applyDiaryChange, dateRangeError, defaultDiaryFilters, formatMealDate, readDiary, watchDiaryExpiry,
  type DiaryChange, type DiaryFilters, type DiaryMeal, type DiarySnapshot,
} from "./diary-client";
import { FunnelIcon, XMarkIcon, Bars3Icon, PlusIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { announceSessionChange, postAuth, watchSessionChange } from "../session-client";
import AccessScreen from "../components/AccessScreen";
import EnableNotifications from "../components/EnableNotifications";

import type { MealReaction as Reaction, MealType } from "@/shared/meal";

const typeLabels: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Comida",
  dinner: "Cena",
  snack: "Snack",
};

export default function MealsPage() {
  const { data: session, status } = useSession();
  if (status === "loading") return <main className="app-surface p-6"><p role="status">Comprobando sesión…</p></main>;
  const userId = session?.user?.id;
  if (status !== "authenticated" || !userId) return <SessionLost />;
  return <AccountMeals key={`${userId}:${session.expires}`} userId={userId} expiresAt={Date.parse(session.expires)} />;
}

function SessionLost() {
  return (
    <AccessScreen title="Diario de comidas" description="Vuelve a iniciar sesión para ver tus comidas.">
      <p role="alert" className="app-feedback app-error mt-4">La sesión ya no está disponible.</p>
      <div className="mt-3 flex flex-wrap gap-x-4">
        <Link href="/login" className="app-link">Iniciar sesión</Link>
        <form action="/meals">
          <button type="submit" className="app-link">Volver a comprobar la sesión</button>
        </form>
      </div>
    </AccessScreen>
  );
}

function AccountMeals({ userId, expiresAt }: { userId: string; expiresAt: number }) {
  const [diary, setDiary] = useState<DiarySnapshot | null>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const signOutPending = useRef(false);
  const [logout, setLogout] = useState<"pending" | "error">();
  const sessionExpired = diary === null;
  const [request, setRequest] = useState({ filters: defaultDiaryFilters });
  const pendingRequest = useRef<AbortController>(null);
  const createButton = useRef<HTMLButtonElement>(null);

  const [openCreate, setOpenCreate] = useState(false);

  const [selectedMeal, setSelectedMeal] = useState<DiaryMeal | null>(null);
  const [draftFilters, setDraftFilters] = useState<DiaryFilters | null>(null);
  const rangeError = draftFilters ? dateRangeError(draftFilters.dateFrom, draftFilters.dateTo) : "";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("click", handleClickOutside);
    } else {
      document.removeEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [menuOpen]);

  const expireSession = useCallback(() => {
    pendingRequest.current?.abort();
    setDiary(null);
    setOpenCreate(false);
    setSelectedMeal(null);
    setDraftFilters(null);
  }, []);

  useEffect(() => watchSessionChange(expireSession), [expireSession]);

  async function closeSession() {
    if (signOutPending.current) return;
    signOutPending.current = true;
    expireSession();
    setLogout("pending");
    try {
      const response = await postAuth("signout", new URLSearchParams({ callbackUrl: "/login" }));
      if (!response?.ok) throw new Error("Sign-out failed");
      const { url } = await response.json();
      if (typeof url !== "string" || new URL(url).pathname !== "/login") throw new Error("Sign-out failed");
      announceSessionChange();
      window.location.replace("/login");
    } catch {
      setLogout("error");
      signOutPending.current = false;
    }
  }

  useEffect(() => {
    if (!sessionExpired) return watchDiaryExpiry(expiresAt, expireSession);
  }, [expiresAt, expireSession, sessionExpired]);

  useEffect(() => {
    if (sessionExpired || !(expiresAt > Date.now())) return;
    const controller = new AbortController();
    const { signal } = controller;
    pendingRequest.current = controller;

    async function load() {
      try {
        const result = await readDiary(request.filters, userId, signal);
        if (signal.aborted) return;
        if (result === null || !(expiresAt > Date.now())) {
          expireSession();
          return;
        }
        setDiary(current => current !== null && !signal.aborted ? result : current);
        setError("");
      } catch {
        if (signal.aborted) return;
        if (!(expiresAt > Date.now())) {
          expireSession();
          return;
        }
        setError("No se pudieron consultar las comidas.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [request, sessionExpired, userId, expiresAt, expireSession]);

  function refresh(filters?: DiaryFilters) {
    pendingRequest.current?.abort();
    setError("");
    setLoading(true);
    setRequest(current => ({ filters: filters ?? current.filters }));
  }

  function confirmChange(change: DiaryChange) {
    if (!(expiresAt > Date.now())) {
      expireSession();
      return;
    }
    setDiary(current => current && {
      ...current, meals: applyDiaryChange(current.meals, current.filters, change),
    });
    refresh();
  }

  if (logout) {
    return (
      <AccessScreen title="Cerrar sesión" description="Tu diario permanece oculto mientras cierras la sesión.">
        {logout === "pending" ? <p role="status" className="app-feedback mt-4">Cerrando sesión…</p> : (
          <>
            <p role="alert" className="app-feedback app-error mt-4">No se pudo cerrar la sesión. Comprueba tu conexión.</p>
            <button type="button" className="app-button mt-4" onClick={() => void closeSession()}>Reintentar cierre</button>
          </>
        )}
      </AccessScreen>
    );
  }

  if (sessionExpired) return <SessionLost />;

  const filters = diary?.filters ?? defaultDiaryFilters;
  const filtered = Boolean(filters.type || filters.reactions.length || filters.dateFrom || filters.dateTo);
  const empty = diary?.meals.length === 0 && !filtered;

  return (
    <main className="app-surface">
      <div className="diary-shell">
        <header className="diary-header">
          <span className="diary-brand">What<span>Meal</span></span>
          <div className="relative z-30" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-green-700"
              aria-label="Menú"
              aria-expanded={menuOpen}
            >
              <Bars3Icon className="h-6 w-6 text-gray-700" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 pb-2 border-b border-gray-100">
                  <EnableNotifications onDone={() => setMenuOpen(false)} />
                </div>

                <button
                  onClick={() => void closeSession()}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        <section className="diary-intro" aria-labelledby="diary-title">
          <div className="min-w-0">
            <h1 id="diary-title" className="app-title">Tus comidas</h1>
            <p className="app-muted">
              {empty ? "Empieza por añadir tu primera comida y anota cómo te sentó." : "Consulta y registra tus comidas."}
            </p>
          </div>
          {diary && (
            <button ref={createButton} className="app-button app-button-primary shrink-0" onClick={event => {
              event.currentTarget.focus();
              setOpenCreate(true);
            }}>
              <PlusIcon aria-hidden="true" className="h-5 w-5" />
              Añadir comida
            </button>
          )}
        </section>

        <p role="status" className={loading ? "app-feedback mt-4" : "sr-only"}>
          {loading ? diary ? "Actualizando comidas…" : "Cargando comidas…" : ""}
        </p>
        {error && (
          <div className="app-feedback app-error mt-4 flex flex-wrap items-center justify-between gap-x-4">
            <p role="alert">{error}</p>
            <button type="button" onClick={() => refresh()} className="app-link">Reintentar consulta</button>
          </div>
        )}

        {diary && (
          <div className="diary-toolbar">
            <button
              type="button"
              onClick={event => {
                event.currentTarget.focus();
                setDraftFilters(filters);
              }}
              className="app-button"
            >
              <FunnelIcon aria-hidden="true" className="h-5 w-5" />
              Filtros
            </button>
          </div>
        )}

        {diary?.meals.length ? (
          <ul className="diary-list" aria-label="Comidas">
            {diary.meals.map(meal => (
              <li key={meal.id}>
                <button
                  type="button"
                  className="diary-row"
                  onClick={event => {
                    event.currentTarget.focus();
                    setSelectedMeal(meal);
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{meal.name}</p>
                    <p className="app-muted text-sm">
                      {typeLabels[meal.type]} · <time dateTime={meal.date}>{formatMealDate(meal.date)}</time>
                    </p>
                    {meal.place && <p className="app-muted mt-1 text-sm">{meal.place}</p>}
                    {meal.notes && <p className="app-muted mt-1 text-sm italic">{meal.notes}</p>}
                  </div>
                  <span className="diary-reaction" data-reaction={meal.reaction}>
                    {meal.reaction === "good" ? "Bien" : meal.reaction === "bad" ? "Mal" : "Neutral"}
                  </span>
                  <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : filtered && !loading && !error && (
          <p className="app-muted mt-4">No hay resultados con los filtros actuales.</p>
        )}
      </div>

      {openCreate && (
        <AddMealModal
          onClose={() => setOpenCreate(false)}
          onCreated={meal => confirmChange({ meal })}
          onSessionLost={expireSession}
          userId={userId}
        />
      )}
      {selectedMeal && (
        <EditMealModal
          onClose={() => setSelectedMeal(null)}
          meal={selectedMeal}
          fallbackFocus={createButton}
          userId={userId}
          onUpdated={({ userId, ...meal }) => confirmChange({
            meal: { ...meal, user: userId, createdAt: selectedMeal.createdAt },
          })}
          onDeleted={id => confirmChange({ id })}
          onSessionLost={expireSession}
        />
      )}
      {draftFilters && (
        <DiaryDialog titleId="diary-filter-title" onClose={() => setDraftFilters(null)}>
          <div className="flex items-center justify-between mb-3">
            <h2 id="diary-filter-title" className="text-lg font-semibold text-gray-900">Filtros</h2>
            <button
              onClick={() => setDraftFilters(null)}
              className="h-8 w-8 grid place-items-center rounded-full hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p id="diary-filter-reaction" className="text-sm font-medium text-gray-700 mb-2">
                Reacción
              </p>
              <div role="group" aria-labelledby="diary-filter-reaction" className="flex flex-wrap gap-2">
                {(["good", "neutral", "bad"] as Reaction[]).map((r) => {
                  const active = draftFilters.reactions.includes(r);
                  const label =
                    r === "good" ? "Bien" : r === "bad" ? "Mal" : "Neutral";
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDraftFilters({
                        ...draftFilters,
                        reactions: active ? draftFilters.reactions.filter(value => value !== r) : [...draftFilters.reactions, r],
                      })}
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
              <label htmlFor="diary-filter-type" className="block text-sm font-medium text-gray-700 mb-2">
                Tipo
              </label>
              <select
                id="diary-filter-type"
                value={draftFilters.type}
                onChange={(e) => setDraftFilters({ ...draftFilters, type: e.target.value as MealType | "" })}
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
                <label htmlFor="diary-filter-desde" className="block text-sm font-medium text-gray-700">
                  Desde
                </label>
                <input
                  type="date"
                  id="diary-filter-desde"
                  value={draftFilters.dateFrom}
                  aria-invalid={Boolean(rangeError)}
                  aria-describedby={rangeError ? "diary-filter-date-error" : undefined}
                  onChange={(e) => setDraftFilters({ ...draftFilters, dateFrom: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="diary-filter-hasta" className="block text-sm font-medium text-gray-700">
                  Hasta
                </label>
                <input
                  type="date"
                  id="diary-filter-hasta"
                  value={draftFilters.dateTo}
                  aria-invalid={Boolean(rangeError)}
                  aria-describedby={rangeError ? "diary-filter-date-error" : undefined}
                  onChange={(e) => setDraftFilters({ ...draftFilters, dateTo: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {rangeError && <p id="diary-filter-date-error" role="alert" className="text-sm text-red-700">{rangeError}</p>}

            <div>
              <p id="diary-filter-order" className="block text-sm font-medium text-gray-700 mb-2">
                Orden por fecha
              </p>
              <div role="group" aria-labelledby="diary-filter-order" className="flex gap-2">
                <button
                  type="button"
                  aria-pressed={draftFilters.sortDir === "desc"}
                  onClick={() => setDraftFilters({ ...draftFilters, sortDir: "desc" })}
                  className={`px-3 py-1 rounded-lg border text-sm ${
                    draftFilters.sortDir === "desc"
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  Más nuevas
                </button>
                <button
                  type="button"
                  aria-pressed={draftFilters.sortDir === "asc"}
                  onClick={() => setDraftFilters({ ...draftFilters, sortDir: "asc" })}
                  className={`px-3 py-1 rounded-lg border text-sm ${
                    draftFilters.sortDir === "asc"
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
              onClick={() => {
                setDraftFilters(defaultDiaryFilters);
                refresh(defaultDiaryFilters);
              }}
              className="text-sm text-gray-600 underline decoration-dotted hover:text-gray-800"
            >
              Limpiar filtros
            </button>
            <button
              disabled={Boolean(rangeError)}
              onClick={() => {
                refresh(draftFilters);
                setDraftFilters(null);
              }}
              className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 active:bg-green-800 disabled:opacity-60"
            >
              Aplicar
            </button>
          </div>
        </DiaryDialog>
      )}
    </main>
  );
}
