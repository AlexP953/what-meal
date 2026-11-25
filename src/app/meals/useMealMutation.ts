import { useLayoutEffect, useRef, useState } from "react";
import { mutateMeal } from "./mutation-client";
import type { DiaryChange } from "./diary-client";

export default function useMealMutation(userId: string, onConfirmed: (change: DiaryChange) => void, onSessionLost: () => void) {
  const pending = useRef<AbortController>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);

  useLayoutEffect(() => () => pending.current?.abort(), []);

  async function submit(operation: Parameters<typeof mutateMeal>[0]) {
    if (pending.current || uncertain) return;
    const controller = new AbortController();
    pending.current = controller;
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
      setUncertain(true);
    }

    pending.current = null;
    setSubmitting(false);
  }

  return { submit, submitting, error, setError, uncertain };
}
