"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AddMealModal from "./AddMealModal";
import EditMealModal from "./EditMealModal";
import DiaryFiltersDialog from "./DiaryFiltersDialog";
import { reactionLabels, typeLabels } from "./labels";
import {
  applyDiaryChange, defaultDiaryFilters, formatMealDate, hasDiaryFilters, readDiary, watchDiaryExpiry,
  type DiaryChange, type DiaryFilters, type DiaryMeal, type DiarySnapshot,
} from "./diary-client";
import { FunnelIcon, Bars3Icon, PlusIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { announceSessionChange, postAuth, watchSessionChange } from "../session-client";
import AccessScreen from "../components/AccessScreen";
import EnableNotifications from "../components/EnableNotifications";

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
  const [confirmation, setConfirmation] = useState<{ message: string }>();
  const signOutPending = useRef(false);
  const [logout, setLogout] = useState<"pending" | "error">();
  const sessionExpired = diary === null;
  const [request, setRequest] = useState({ filters: defaultDiaryFilters });
  const pendingRequest = useRef<AbortController>(null);
  const createButton = useRef<HTMLButtonElement>(null);

  const [openCreate, setOpenCreate] = useState(false);

  const [selectedMeal, setSelectedMeal] = useState<DiaryMeal | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    setFiltersOpen(false);
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

  function confirmChange(change: DiaryChange, message?: string) {
    if (!(expiresAt > Date.now())) {
      expireSession();
      return;
    }
    setDiary(current => current && {
      ...current, meals: applyDiaryChange(current.meals, current.filters, change),
    });
    if (message) setConfirmation({ message });
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

        <div role="status">
          {confirmation && <p className="app-feedback mt-4">{confirmation.message}</p>}
        </div>

        {diary && (
          <div className="diary-toolbar">
            <button
              type="button"
              onClick={event => {
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
            <button type="button" className="app-link" onClick={() => refresh(defaultDiaryFilters)}>Limpiar filtros</button>
          </div>
        )}
      </div>

      {openCreate && (
        <AddMealModal
          onClose={() => setOpenCreate(false)}
          onCreated={change => confirmChange(change, "Comida añadida.")}
          onCheckDiary={() => {
            setOpenCreate(false);
            refresh(defaultDiaryFilters);
          }}
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
      {filtersOpen && (
        <DiaryFiltersDialog filters={filters} onClose={() => setFiltersOpen(false)} onApply={next => {
          refresh(next);
          setFiltersOpen(false);
        }} />
      )}
    </main>
  );
}
