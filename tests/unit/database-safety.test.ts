import { expect, it, vi } from "vitest";
const dropDatabase = vi.hoisted(() => vi.fn());
vi.mock("mongoose", () => ({ default: {
  connection: { readyState: 1, name: "whatmeal", dropDatabase },
  disconnect: async () => undefined,
} }));
import { isolatedDatabase } from "../helpers/database";

it("refuses cleanup when the connection points at development data", async () => {
  await expect(isolatedDatabase().cleanup()).rejects.toThrow("Unsafe test database cleanup refused");
  expect(dropDatabase).not.toHaveBeenCalled();
});
