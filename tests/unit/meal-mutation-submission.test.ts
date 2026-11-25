import { afterEach, expect, it, vi } from "vitest";
import useMealMutation from "@/app/meals/useMealMutation";

vi.mock("react", () => ({
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, vi.fn()],
  useLayoutEffect: () => {},
}));

afterEach(() => vi.unstubAllGlobals());

it("submits only once when the same form handler runs twice before the first response", async () => {
  const response = Promise.withResolvers<Response>();
  const fetcher = vi.fn().mockReturnValue(response.promise);
  vi.stubGlobal("fetch", fetcher);
  const onStart = vi.fn();
  const { submit } = useMealMutation("account-1", vi.fn(), vi.fn(), onStart);
  const operation = {
    method: "POST",
    fields: { name: "Sopa", date: "2024-02-29", type: "lunch", reaction: "neutral", place: "", notes: "" },
  } as const;

  const first = submit(operation);
  const repeated = submit(operation);

  try {
    expect(fetcher).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledOnce();
  } finally {
    response.resolve(Response.json({ error: "Datos no válidos" }, { status: 400 }));
    await Promise.all([first, repeated]);
  }
});
