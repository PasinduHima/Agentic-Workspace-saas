import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fromBase64, toBase64 } from "@/lib/base64";

const PEER_SYNC_WAIT_MS = 500;

// The bytes of a broadcast's `{ update: base64 }` payload, or null if it isn't one.
function decodePayload(payload: unknown): Uint8Array | null {
  const update = (payload as { update?: unknown } | null)?.update;
  if (typeof update !== "string" || !update) return null;
  try {
    return fromBase64(update);
  } catch {
    return null;
  }
}

// Syncs a Yjs document between everyone viewing the same doc, over a Supabase Realtime channel.
// Three broadcast events: "update" (doc changes), "awareness" (cursors/names) and "sync-request"
// (a newcomer asking peers for their full state, to catch up on unsaved edits).
//
// The channel is private: Supabase Realtime Authorization checks the user's Clerk session token
// against the policies in supabase/realtime-doc-channel-policies.sql (workspace access; viewers
// can receive but not send). If joining is refused, the editor still opens with the saved state.
export class SupabaseYjsProvider {
  readonly awareness: Awareness;
  private channel: RealtimeChannel;
  private subscribed = false;
  private isReady = false;
  private readyTimeout?: ReturnType<typeof setTimeout>;

  // onReady fires once, shortly after joining (giving peers a moment to send unsaved edits),
  // or right away if Realtime can't connect, so the editor still opens with the saved state.
  constructor(
    private doc: Y.Doc,
    roomId: string,
    private onReady: () => void
  ) {
    this.awareness = new Awareness(doc);
    this.channel = supabase.channel(`doc:${roomId}`, {
      config: { private: true, broadcast: { self: false } },
    });

    // Messages come from a public channel, so anything malformed is dropped instead of throwing
    // inside every open editor. (This doesn't stop well-formed but unwanted edits; that needs a
    // private channel, see above.)
    this.channel
      .on("broadcast", { event: "update" }, ({ payload }) => {
        const update = decodePayload(payload);
        if (!update) return;
        try {
          // decodeUpdate validates the whole update first, so a bad one never half-applies.
          Y.decodeUpdate(update);
          Y.applyUpdate(this.doc, update, this);
        } catch {
          // Not a Yjs update: ignore it.
        }
      })
      .on("broadcast", { event: "awareness" }, ({ payload }) => {
        const update = decodePayload(payload);
        if (!update) return;
        try {
          applyAwarenessUpdate(this.awareness, update, this);
        } catch {
          // Not an awareness update: ignore it.
        }
      })
      .on("broadcast", { event: "sync-request" }, () => {
        this.sendFullState();
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") {
          this.subscribed = false;
          this.markReady();
          return;
        }
        this.subscribed = true;
        // Share anything we already have, then ask peers for what we're missing.
        this.sendFullState();
        this.send("sync-request", {});
        this.readyTimeout ??= setTimeout(this.markReady, PEER_SYNC_WAIT_MS);
      });

    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);
  }

  // Remote updates are applied with `this` as the origin, so they aren't echoed back out.
  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this) this.send("update", { update: toBase64(update) });
  };

  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === this) return;
    const changed = [...added, ...updated, ...removed];
    this.send("awareness", { update: toBase64(encodeAwarenessUpdate(this.awareness, changed)) });
  };

  private markReady = () => {
    clearTimeout(this.readyTimeout);
    if (this.isReady) return;
    this.isReady = true;
    this.onReady();
  };

  private sendFullState() {
    this.send("update", { update: toBase64(Y.encodeStateAsUpdate(this.doc)) });
    this.send("awareness", {
      update: toBase64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])),
    });
  }

  private send(event: string, payload: Record<string, unknown>) {
    if (!this.subscribed) return;
    this.channel.send({ type: "broadcast", event, payload });
  }

  destroy() {
    clearTimeout(this.readyTimeout);
    this.isReady = true;
    // Tell peers our cursor is gone before leaving.
    removeAwarenessStates(this.awareness, [this.doc.clientID], "destroy");
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.awareness.destroy();
    supabase.removeChannel(this.channel);
  }
}