"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export { toBase64, fromBase64 };

/**
 * Syncs a Y.Doc (and cursor awareness) between everyone in a room over Supabase Realtime
 * broadcast. Nothing is stored by Supabase: on joining, a client asks the room for what it is
 * missing (by sending its state vector) and peers reply with the difference. Persistence is
 * separate (the doc's Yjs state is saved to Postgres).
 *
 * Remote changes are applied with this provider as the transaction origin, so listeners can tell
 * them apart from local edits.
 */
export class SupabaseYjsProvider {
  readonly awareness: Awareness;
  private readonly channel: RealtimeChannel;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly doc: Y.Doc,
    room: string,
  ) {
    this.awareness = new Awareness(doc);

    this.channel = supabase
      .channel(room, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "update" }, ({ payload }) => {
        Y.applyUpdate(this.doc, fromBase64(payload.update), this);
      })
      .on("broadcast", { event: "sync-request" }, ({ payload }) => {
        // Reply with only what the requester is missing, plus who is here.
        const diff = Y.encodeStateAsUpdate(this.doc, fromBase64(payload.stateVector));
        this.send("update", { update: toBase64(diff) });
        this.sendAwareness([this.doc.clientID]);
      })
      .on("broadcast", { event: "awareness" }, ({ payload }) => {
        applyAwarenessUpdate(this.awareness, fromBase64(payload.update), this);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.send("sync-request", {
            stateVector: toBase64(Y.encodeStateVector(this.doc)),
          });
          this.sendAwareness([this.doc.clientID]);
        }
      });

    doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
    window.addEventListener("beforeunload", this.onUnload);
  }

  private send(event: string, payload: Record<string, string>) {
    void this.channel.send({ type: "broadcast", event, payload });
  }

  private sendAwareness(clients: number[]) {
    this.send("awareness", { update: toBase64(encodeAwarenessUpdate(this.awareness, clients)) });
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    // Don't echo changes that came from the room.
    if (origin !== this) this.send("update", { update: toBase64(update) });
  };

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin !== this) this.sendAwareness([...added, ...updated, ...removed]);
  };

  // Tells the others to drop this cursor right away, rather than after awareness times out.
  private onUnload = () => {
    removeAwarenessStates(this.awareness, [this.doc.clientID], "unload");
  };

  destroy() {
    this.onUnload();
    window.removeEventListener("beforeunload", this.onUnload);
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.destroy();
    void this.supabase.removeChannel(this.channel);
  }
}
