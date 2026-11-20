import { afterEach, describe, expect, it, vi } from "vitest";
import { savePendingPrompt, takePendingPrompt } from "./pending-prompt";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

describe("pending prompt hand-off", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the saved prompt once, for its own workspace only", () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    const longPrompt = "Design a schema ".repeat(1000);

    expect(savePendingPrompt("ws_1", longPrompt)).toBe(true);
    expect(takePendingPrompt("ws_2")).toBeNull();
    expect(takePendingPrompt("ws_1")).toBe(longPrompt);
    expect(takePendingPrompt("ws_1")).toBeNull();
  });

  it("reports failure instead of throwing when storage is blocked", () => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    vi.stubGlobal("sessionStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });

    expect(savePendingPrompt("ws_1", "hi")).toBe(false);
    expect(takePendingPrompt("ws_1")).toBeNull();
  });
});
