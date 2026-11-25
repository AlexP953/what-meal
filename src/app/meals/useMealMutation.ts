import { useLayoutEffect, useRef, useState } from "react";
import { mutateMeal } from "./mutation-client";
import type { DiaryChange } from "./diary-client";

export default function useMealMutation(userId: string, onConfirmed: (change: DiaryChange) => void, onSessionLost: () => void, onStart: () => void, initialUncertain = false) {
  const pending = useRef<AbortController>(null);
  const uncertainRef = useRef(initialUncertain);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(initialUncertain);

  useLayoutEffect(() => () => pending.current?.abort(), []);

  async function submit(operation: Parameters<typeof mutateMeal>[0]) {
    if (pending.current || uncertainRef.current) return;
    const controller = new AbortController();
    pending.current = controller;
    onStart();
    setSubmitting(true);
    setError("");

    const result = await mutateMeal(operation, userId, controller.signal);
    if (controller.signal.aborted) return;

    if (result.status === "session-lost") {
      onSessionLost();
    } else if (result.status === "confirmed") {
      onConfirmed(result.change);
    } else if (result.status === "rejected") {
      setError(result.error);
    } else if (result.status === "uncertain") {
      uncertainRef.current = true;
      setUncertain(true);
    }

    pending.current = null;
    setSubmitting(false);
  }

  return { submit, submitting, error, setError, uncertain, pending, uncertainRef };
}
