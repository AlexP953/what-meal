"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { flushSync } from "react-dom";
import MealFormDialog from "./MealFormDialog";
import DiaryFiltersDialog from "./DiaryFiltersDialog";
import { reactionLabels, typeLabels } from "./labels";
import {
  applyDiaryChange, defaultDiaryFilters, formatMealDate, hasDiaryFilters, readDiary, watchDiaryExpiry,
  type DiaryChange, type DiaryFilters, type DiaryMeal, type DiarySnapshot,
} from "./diary-client";
import { FunnelIcon, Bars3Icon, PlusIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import type { DiaryDraft, MealDraft } from "./diary-draft";
import { holdDiaryLock, postAuth, readSession, sameSession, watchSessionChange, type SessionCheck, type VerifiedSession } from "../session-client";
import SessionUnavailable from "./SessionUnavailable";
import AccessScreen from "../components/AccessScreen";
import { notificationsEnabled } from "@/shared/config";
import EnableNotifications from "../components/EnableNotifications";

type SessionDraft = { session: VerifiedSession; draft?: DiaryDraft };

export default function MealsPage() {
  const [{ session, draft }, setView] = useState<{ session?: SessionCheck; draft?: DiaryDraft }>({});
  const committedView = useRef<(() => SessionDraft) | null>(null);
  const saved = useRef<SessionDraft>(undefined);
  const seenAuthAttempts = useRef(new Set<string>());
  const [attempt, setAttempt] = useState(0);
  const releaseDiary = useRef<() => void>(undefined);

  useEffect(() => {
    const lifetime = new AbortController();
    const { signal } = lifetime;
    const released = new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    releaseDiary.current = () => lifetime.abort();
    let holdingLock = false;
    let checking = false;
    let suspended = false;

    async function verify() {
      if (!holdingLock || checking || signal.aborted) return;
      checking = true;
      const result = await readSession(signal);
      checking = false;
      if (signal.aborted) return;

      const previous = saved.current;
      if (result.status === "verified" && previous) {
        if (sameSession(previous.session, result)) {
          flushSync(() => setView({ session: result, draft: previous.draft }));
        } else {
          setView({ session: { status: "absent" } });
          lifetime.abort();
        }
      } else {
        setView({ session: result });
      }
      if (result.status !== "unavailable") saved.current = undefined;
    }

    function hide() {
      saved.current = committedView.current?.() ?? saved.current;
      flushSync(() => setView({}));
      lifetime.abort();
    }

    function invalidate(authAttempt: string) {
      if (seenAuthAttempts.current.has(authAttempt) || (signal.aborted && !suspended)) return;
      seenAuthAttempts.current.add(authAttempt);
      if (suspended) return;
      hide();
      setAttempt(value => value + 1);
    }

    function suspend() {
      if (signal.aborted) return;
      suspended = true;
      hide();
    }

    function verifyVisible() {
      if (document.visibilityState !== "visible") return;
      if (suspended) {
        suspended = false;
        setAttempt(value => value + 1);
      } else {
        void verify();
      }
    }

    const stopWatching = watchSessionChange(invalidate);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", verifyVisible);
    document.addEventListener("freeze", suspend);
    document.addEventListener("resume", verifyVisible);
    document.addEventListener("visibilitychange", verifyVisible);
    window.addEventListener("focus", verifyVisible);

    void holdDiaryLock(signal, async () => {
      if (signal.aborted) return;
      holdingLock = true;
      await verify();
      await released;
    }).catch(() => {
      if (!signal.aborted) setView({ session: { status: navigator.locks ? "unavailable" : "unsupported" } });
    });

    return () => {
      lifetime.abort();
      stopWatching();
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", verifyVisible);
      document.removeEventListener("freeze", suspend);
      document.removeEventListener("resume", verifyVisible);
      document.removeEventListener("visibilitychange", verifyVisible);
      window.removeEventListener("focus", verifyVisible);
    };
  }, [attempt]);

  if (!session) return <main className="app-surface p-6"><p role="status">Comprobando sesión…</p></main>;
  if (session.status === "unsupported") return (
    <AccessScreen title="Diario de comidas" description="Abre el diario con un navegador compatible con Web Locks.">
      <p role="alert" className="app-feedback app-error mt-4">Usa Chrome en HTTPS o en localhost para proteger los cambios de sesión entre pestañas.</p>
    </AccessScreen>
  );
  if (session.status === "unavailable") return <SessionUnavailable retry={() => {
    setView({});
    setAttempt(value => value + 1);
  }} />;
  if (session.status !== "verified") return <SessionLost />;
  return <AccountMeals
    key={`${session.userId}:${session.expiresAt}`}
    session={session}
    initialDraft={draft}
    captureRef={committedView}
    onSignOut={() => releaseDiary.current?.()}
  />;
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

function AccountMeals({ session, initialDraft, captureRef, onSignOut }: {
  session: VerifiedSession;
  initialDraft?: DiaryDraft;
  captureRef: RefObject<(() => SessionDraft) | null>;
  onSignOut: () => void;
}) {
  const { userId, expiresAt } = session;
  const captureDialog = useRef<(() => DiaryDraft) | null>(null);
  useLayoutEffect(() => {
    captureRef.current = () => ({ session, draft: captureDialog.current?.() });
    return () => { captureRef.current = null; };
  }, [captureRef, session]);
  const [diary, setDiary] = useState<DiarySnapshot | null>();
  const [loading, setLoading] = useState(true);
  const [reviewingMutation, setReviewingMutation] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ id: number; message: string }>();
  const confirmationId = useRef(0);
  const signOutPending = useRef(false);
  const [logout, setLogout] = useState<"pending" | "error">();
  const sessionExpired = diary === null;
  const [request, setRequest] = useState({ filters: defaultDiaryFilters });
  const pendingRequest = useRef<AbortController>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  const [mealForm, setMealForm] = useState<{ meal?: DiaryMeal; restored?: MealDraft } | undefined>(
    initialDraft?.kind === "meal" ? { meal: initialDraft.meal, restored: initialDraft } : undefined,
  );
  const [filterDraft, setFilterDraft] = useState(initialDraft?.kind === "filters" ? initialDraft.filters : undefined);

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
    setFilterDraft(undefined);
  }, []);

  async function closeSession() {
    if (signOutPending.current) return;
    signOutPending.current = true;
    flushSync(() => {
      expireSession();
      setLogout("pending");
    });
    onSignOut();
    try {
      const response = await postAuth("signout", new URLSearchParams({ callbackUrl: "/login" }), async (reply, signal) => {
        if (!reply.ok) throw new Error("Sign-out failed");
        const { url } = await reply.json();
        if (typeof url !== "string" || new URL(url).pathname !== "/login") throw new Error("Sign-out failed");
        if ((await readSession(signal)).status !== "absent") throw new Error("Sign-out failed");
      });
      if (!response) throw new Error("Sign-out failed");
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
    setConfirmation({ id: ++confirmationId.current, message });
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
                {notificationsEnabled && <EnableNotifications userId={userId} onDone={() => {
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
              setMealForm({});
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
          {confirmation && <p key={confirmation.id} className="app-feedback mt-4">{confirmation.message}</p>}
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
                setFilterDraft(request.filters);
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
                    setMealForm({ meal });
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
          meal={mealForm.meal}
          initialDraft={mealForm.restored}
          captureRef={captureDialog}
          onClose={() => setMealForm(undefined)}
          fallbackFocus={createButton}
          userId={userId}
          onStart={() => setConfirmation(undefined)}
          onConfirmed={confirmChange}
          onCheckDiary={checkMutation}
          onSessionLost={expireSession}
        />
      )}
      {filterDraft && (
        <DiaryFiltersDialog filters={filterDraft} captureRef={captureDialog} onClose={() => setFilterDraft(undefined)} onApply={next => {
          refresh(next);
          setFilterDraft(undefined);
        }} />
      )}
    </main>
  );
}
