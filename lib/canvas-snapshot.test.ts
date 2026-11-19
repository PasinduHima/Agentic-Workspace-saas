import { describe, expect, it } from "vitest";
import { createTLStore, defaultShapeUtils } from "tldraw";
import { isCanvasSnapshot } from "./canvas-snapshot";

describe("isCanvasSnapshot", () => {
  it("accepts a real tldraw snapshot after the client's JSON round-trip", () => {
    const store = createTLStore({ shapeUtils: defaultShapeUtils });
    const snapshot = JSON.parse(JSON.stringify({ document: store.getStoreSnapshot(), session: {} }));
    expect(isCanvasSnapshot(snapshot)).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "snapshot"],
    ["an array", [{ document: {} }]],
    ["no document", { session: {} }],
    ["a document without a store", { document: { schema: {} } }],
    ["a document without a schema", { document: { store: {} } }],
    ["an array store", { document: { store: [], schema: {} } }],
  ])("rejects %s", (_label, value) => {
    expect(isCanvasSnapshot(value)).toBe(false);
  });
});
