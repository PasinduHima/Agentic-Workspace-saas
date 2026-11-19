import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

const state = vi.hoisted(() => ({
  canAccess: true,
  stored: null as Uint8Array | null,
  update: vi.fn(),
}));

vi.mock("@/lib/workspace-access", () => ({
  canEditWorkspace: async () => state.canAccess,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: async () => [{ yjsState: state.stored }],
        doc: { update: state.update },
      }),
  },
}));

const { saveDocContent } = await import("./doc");

function docWith(text: string) {
  const doc = new Y.Doc();
  doc.getText("t").insert(0, text);
  return doc;
}

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

describe("saveDocContent", () => {
  beforeEach(() => {
    state.canAccess = true;
    state.stored = null;
    state.update.mockReset();
  });

  it("rejects callers without access", async () => {
    state.canAccess = false;
    await expect(saveDocContent("w1", toBase64(Y.encodeStateAsUpdate(docWith("a"))), [])).rejects.toThrow(
      "Workspace not found",
    );
    expect(state.update).not.toHaveBeenCalled();
  });

  it("rejects swapped arguments", async () => {
    // @ts-expect-error: deliberately wrong order, as the earlier client bug did
    await expect(saveDocContent("w1", [], "AAA=")).rejects.toThrow("Invalid doc save");
    expect(state.update).not.toHaveBeenCalled();
  });

  it("rejects bytes that aren't a Yjs update", async () => {
    await expect(saveDocContent("w1", toBase64(new Uint8Array([255, 255, 255])), [])).rejects.toThrow(
      "Invalid doc save",
    );
  });

  it("merges into the stored state instead of overwriting it", async () => {
    const theirs = docWith("theirs");
    state.stored = Y.encodeStateAsUpdate(theirs);
    const mine = docWith("mine");

    await saveDocContent("w1", toBase64(Y.encodeStateAsUpdate(mine)), []);

    const saved: Uint8Array = state.update.mock.calls[0][0].data.yjsState;
    const result = new Y.Doc();
    Y.applyUpdate(result, saved);
    const text = result.getText("t").toString();
    expect(text).toContain("theirs");
    expect(text).toContain("mine");
  });

  it("replaces an undecodable stored state", async () => {
    state.stored = new Uint8Array([255, 255, 255]);
    const incoming = Y.encodeStateAsUpdate(docWith("fresh"));

    await saveDocContent("w1", toBase64(incoming), []);

    const result = new Y.Doc();
    Y.applyUpdate(result, state.update.mock.calls[0][0].data.yjsState);
    expect(result.getText("t").toString()).toBe("fresh");
  });
});
