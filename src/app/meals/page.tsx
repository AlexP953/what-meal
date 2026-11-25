"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import MealFormDialog from "./MealFormDialog";
import DiaryFiltersDialog from "./DiaryFiltersDialog";
import { reactionLabels, typeLabels } from "./labels";
import {
  applyDiaryChange, defaultDiaryFilters, formatMealDate, hasDiaryFilters, readDiary, watchDiaryExpiry,
  type DiaryChange, type DiaryFilters, type DiaryMeal, type DiarySnapshot,
} from "./diary-client";
import { FunnelIcon, Bars3Icon, PlusIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { announceSessionChange, postAuth, watchSessionChange } from "../session-client";
import AccessScreen from "../components/AccessScreen";
import { notificationsEnabled } from "@/shared/config";
import EnableNotifications from "../components/EnableNotifications";

export default function MealsPage() {
  const { data: session, status } = useSession();
  const [sessionChanged, setSessionChanged] = useState(false);
  useEffect(() => watchSessionChange(() => setSessionChanged(true)), []);

  if (sessionChanged) return <SessionLost />;
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
  const [reviewingMutation, setReviewingMutation] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ message: string }>();
  const signOutPending = useRef(false);
  const [logout, setLogout] = useState<"pending" | "error">();
  const sessionExpired = diary === null;
  const [request, setRequest] = useState({ filters: defaultDiaryFilters });
  const pendingRequest = useRef<AbortController>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  const [mealForm, setMealForm] = useState<DiaryMeal | "create">();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (!menuOpen) return;
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  const expireSession = useCallback(() => {
    pendingRequest.current?.abort();
    setDiary(null);
    setMealForm(undefined);
    setFiltersOpen(false);
  }, []);

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
        setReviewingMutation(false);
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

  function checkMutation() {
    setMealForm(undefined);
    setReviewingMutation(true);
    refresh(defaultDiaryFilters);
  }

  function confirmChange(change: DiaryChange, message: string) {
    if (!(expiresAt > Date.now())) {
      expireSession();
      return;
    }
    setDiary(current => current && {
      ...current, meals: applyDiaryChange(current.meals, current.filters, change),
    });
    setConfirmation({ message });
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
  const filtered = hasDiaryFilters(filters);
  const filterSummary = [
    filters.type && typeLabels[filters.type],
    filters.reactions.map(reaction => reactionLabels[reaction]).join(" / "),
    filters.dateFrom && `Desde ${formatMealDate(filters.dateFrom)}`,
    filters.dateTo && `Hasta ${formatMealDate(filters.dateTo)}`,
  ].filter(Boolean).join(" · ");
  const empty = diary?.meals.length === 0 && !filtered;

  return (
    <main className="app-surface">
      <div className="diary-shell">
        <header className="diary-header">
          <span className="diary-brand">What<span>Meal</span></span>
          <div ref={menuRef} className="relative" onKeyDown={event => {
            if (event.key === "Escape" && menuOpen) {
              setMenuOpen(false);
              menuButton.current?.focus();
            }
          }}>
            <button
              ref={menuButton}
              type="button"
              onClick={() => setMenuOpen(open => !open)}
              className="app-button dialog-icon"
              aria-label="Menú de cuenta"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "diary-account-actions" : undefined}
            >
              <Bars3Icon aria-hidden="true" className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div id="diary-account-actions" className="diary-account-actions">
                {notificationsEnabled && <EnableNotifications onDone={() => {
                  setMenuOpen(false);
                  menuButton.current?.focus();
                }} />}
                <button type="button" onClick={() => void closeSession()} className="app-link">Cerrar sesión</button>
              </div>
            )}
          </div>
        </header>

        <section className="diary-intro" aria-labelledby="diary-title">
          <div className="min-w-0">
            <h1 ref={title} id="diary-title" tabIndex={-1} className="app-title">Tus comidas</h1>
            <p className="app-muted">
              {empty ? "Empieza por añadir tu primera comida y anota cómo te sentó." : "Consulta y registra tus comidas."}
            </p>
          </div>
          {diary && (
            <button ref={createButton} className="app-button app-button-primary shrink-0" aria-disabled={reviewingMutation} onClick={event => {
              if (reviewingMutation) return;
              event.currentTarget.focus();
              setMealForm("create");
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
            <p role="alert">{reviewingMutation
              ? "No se pudieron consultar las comidas. Reintenta antes de hacer cambios."
              : error}</p>
            <button type="button" onClick={() => {
              title.current?.focus();
              refresh();
            }} className="app-link">Reintentar consulta</button>
          </div>
        )}

        <div role="status">
          {confirmation && <p className="app-feedback mt-4">{confirmation.message}</p>}
        </div>

        {diary && (
          <div className="diary-toolbar">
            <button
              ref={filterButton}
              type="button"
              aria-disabled={reviewingMutation}
              onClick={event => {
                if (reviewingMutation) return;
                event.currentTarget.focus();
                setFiltersOpen(true);
              }}
              className="app-button"
            >
              <FunnelIcon aria-hidden="true" className="h-5 w-5" />
              Filtros
            </button>
            <div className="app-muted text-sm">
              <p>{filters.sortDir === "asc" ? "Más antiguas primero" : "Más nuevas primero"}</p>
              {filtered && <p>Filtros aplicados · {filterSummary}</p>}
            </div>
          </div>
        )}

        {diary?.meals.length ? (
          <ul className="diary-list" aria-label="Comidas">
            {diary.meals.map(meal => (
              <li key={meal.id}>
                <button
                  type="button"
                  className="diary-row"
                  aria-disabled={reviewingMutation}
                  onClick={event => {
                    if (reviewingMutation) return;
                    event.currentTarget.focus();
                    setMealForm(meal);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{meal.name}</span>
                    <span className="app-muted block text-sm">
                      {typeLabels[meal.type]} · <time dateTime={meal.date}>{formatMealDate(meal.date)}</time>
                    </span>
                    {meal.place && <span className="app-muted mt-1 block text-sm">{meal.place}</span>}
                    {meal.notes && <span className="app-muted mt-1 block text-sm italic">{meal.notes}</span>}
                  </span>
                  <span className="diary-reaction" data-reaction={meal.reaction}>
                    {reactionLabels[meal.reaction]}
                  </span>
                  <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : filtered && !loading && !error && (
          <div className="diary-no-matches">
            <p>No hay comidas que coincidan con estos filtros.</p>
            <button type="button" className="app-link" onClick={() => {
              filterButton.current?.focus();
              refresh(defaultDiaryFilters);
            }}>Limpiar filtros</button>
          </div>
        )}
      </div>

      {mealForm && (
        <MealFormDialog
          meal={mealForm === "create" ? undefined : mealForm}
          onClose={() => setMealForm(undefined)}
          fallbackFocus={createButton}
          userId={userId}
          onConfirmed={confirmChange}
          onCheckDiary={checkMutation}
          onSessionLost={expireSession}
        />
      )}
      {filtersOpen && (
        <DiaryFiltersDialog filters={request.filters} onClose={() => setFiltersOpen(false)} onApply={next => {
          refresh(next);
          setFiltersOpen(false);
        }} />
      )}
    </main>
  );
}
