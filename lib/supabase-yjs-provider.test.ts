import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate } from "y-protocols/awareness";

type Handler = (message: { payload: unknown }) => void;

const channel = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
}));

vi.mock("@/lib/supabase", () => {
  const fake = {
    on(_type: string, { event }: { event: string }, handler: Handler) {
      channel.handlers.set(event, handler);
      return fake;
    },
    subscribe() {
      return fake;
    },
    send: vi.fn(),
  };
  return { supabase: { channel: () => fake, removeChannel: vi.fn() } };
});

const { SupabaseYjsProvider } = await import("./supabase-yjs-provider");
const { toBase64 } = await import("./base64");

const receive = (event: string, payload: unknown) => channel.handlers.get(event)!({ payload });

describe("SupabaseYjsProvider incoming broadcasts", () => {
  let doc: Y.Doc;

  beforeEach(() => {
    channel.handlers.clear();
    doc = new Y.Doc();
    new SupabaseYjsProvider(doc, "room", () => {});
  });

  it("applies a valid update from a peer", () => {
    const peer = new Y.Doc();
    peer.getText("t").insert(0, "hello");
    receive("update", { update: toBase64(Y.encodeStateAsUpdate(peer)) });
    expect(doc.getText("t").toString()).toBe("hello");
  });

  it.each([
    ["no payload", null],
    ["a non-string update", { update: 42 }],
    ["an empty update", { update: "" }],
    ["invalid base64", { update: "%%%not-base64%%%" }],
    ["bytes that aren't a Yjs update", { update: toBase64(new Uint8Array([255, 255, 255, 255])) }],
  ])("ignores %s without throwing", (_label, payload) => {
    expect(() => receive("update", payload)).not.toThrow();
    expect(() => receive("awareness", payload)).not.toThrow();
    expect(doc.getText("t").toString()).toBe("");
  });

  it("applies a valid awareness update from a peer", () => {
    const peerDoc = new Y.Doc();
    const peer = new Awareness(peerDoc);
    peer.setLocalState({ user: { name: "Ada" } });
    receive("awareness", { update: toBase64(encodeAwarenessUpdate(peer, [peerDoc.clientID])) });
    expect(() => receive("awareness", { update: toBase64(new Uint8Array([9, 9])) })).not.toThrow();
  });
});
