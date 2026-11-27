import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { GET } from "@/app/android/route";

vi.mock("@/lib/authz", () => ({ requireSession: vi.fn() }));

describe("Android entry", () => {
  beforeEach(() => vi.resetAllMocks());

  it("opens the login page without a valid session", async () => {
    vi.mocked(requireSession).mockResolvedValue({ error: NextResponse.json({}, { status: 401 }) });
    const response = await GET();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/login");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("resumes the diary with a valid session", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: { user: { id: "account", role: "user" }, expires: "2026-12-31T00:00:00Z" },
    });
    const response = await GET();
    expect(response.headers.get("location")).toBe("/meals");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns a service error when session verification is unavailable", async () => {
    vi.mocked(requireSession).mockResolvedValue({ error: NextResponse.json({}, { status: 503 }) });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
