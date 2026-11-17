"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import * as Y from "yjs";
import type { Block } from "@blocknote/core";
import { withCollaboration } from "@blocknote/core/yjs";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { saveDocContent } from "@/actions/doc";
import type { Prisma } from "@/lib/generated/prisma/client";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { fromBase64, toBase64 } from "@/lib/base64";
import { outpostDarkTheme } from "@/lib/blocknote-theme";
import { SupabaseYjsProvider } from "@/lib/supabase-yjs-provider";
import { colorForUser } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 1000;
const FRAGMENT = "document-store";

type DocEditorProps = {
  workspaceId: string;
  /** BlockNote JSON (`Doc.content`), used to seed a doc that has no Yjs state yet. */
  initialContent: Block[] | null;
  /** The saved Yjs document (`Doc.yjsState`), base64-encoded. */
  initialState: string | null;
};

type Session = { doc: Y.Doc; provider: SupabaseYjsProvider };

// Applies a base64 Yjs state to a fresh doc, or returns null if it can't be decoded (a failed
// apply can leave a doc half-written, so each attempt gets its own).
function tryLoad(state: unknown) {
  if (typeof state !== "string" || !state) return null;
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, fromBase64(state));
    return doc;
  } catch {
    doc.destroy();
    return null;
  }
}

function loadDoc(initialState: string | null, initialContent: unknown) {
  return (
    tryLoad(initialState) ??
    // An earlier bug saved with the arguments swapped: the Yjs state ended up in `content`
    // (as base64) and junk in `yjsState`. Recover the real document from there.
    tryLoad(initialContent) ??
    new Y.Doc()
  );
}

/**
 * The collaborative doc. Opens once peers have sent any unsaved edits (or after a short wait
 * when alone), so a seed from saved blocks never duplicates what someone else already has.
 */
export function DocEditor({ workspaceId, initialContent, initialState }: DocEditorProps) {
  const { user, isLoaded } = useUser();
  const [session, setSession] = useState<Session | null>(null);

  // The saved state matters only when the doc first opens. Later server re-renders (e.g. after a
  // rename) bring newer props, and reloading from them would throw away unsaved edits.
  const [initial] = useState({ initialState, initialContent });

  // Created in an effect so React's dev double-mount gets its own provider each time, rather
  // than reusing one that the first cleanup already disconnected.
  useEffect(() => {
    const doc = loadDoc(initial.initialState, initial.initialContent);
    const provider: SupabaseYjsProvider = new SupabaseYjsProvider(doc, workspaceId, () =>
      setSession({ doc, provider }),
    );
    return () => {
      provider.destroy();
      doc.destroy();
      setSession(null);
    };
  }, [workspaceId, initial]);

  const seedBlocks = Array.isArray(initial.initialContent) ? initial.initialContent : null;

  if (!isLoaded || !session) {
    return <div className="p-8 text-sm text-muted-foreground">Loading document…</div>;
  }

  return (
    <CollaborativeDocEditor
      key={session.doc.guid}
      workspaceId={workspaceId}
      session={session}
      seedBlocks={seedBlocks}
      userName={user?.fullName || user?.username || "Anonymous"}
      userColor={colorForUser(user?.id ?? "anonymous")}
    />
  );
}

function CollaborativeDocEditor({
  workspaceId,
  session: { doc, provider },
  seedBlocks,
  userName,
  userColor,
}: {
  workspaceId: string;
  session: Session;
  seedBlocks: Block[] | null;
  userName: string;
  userColor: string;
}) {
  const { setDocEditor } = useWorkspaceEditors();

  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        fragment: doc.getXmlFragment(FRAGMENT),
        user: { name: userName, color: userColor },
        provider,
        showCursorLabels: "activity",
      },
    }),
    [doc, provider],
  );

  // A doc saved before collaboration existed has blocks but no Yjs state: copy them in once.
  // Safe here: peers have already synced, so an empty fragment really is empty for everyone.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !seedBlocks?.length || doc.getXmlFragment(FRAGMENT).length > 0) return;
    seeded.current = true;
    editor.replaceBlocks(editor.document, seedBlocks);
  }, [doc, editor, seedBlocks]);

  // Lets the agent panel and the Share dialog reach this editor.
  useEffect(() => {
    setDocEditor(editor);
    return () => setDocEditor(null);
  }, [editor, setDocEditor]);

  // Save local edits to Postgres; changes from the room are saved by whoever made them.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === provider) return;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const yjsState = toBase64(Y.encodeStateAsUpdate(doc));
        // JSON round-trip: blocks can hold undefined fields, which Prisma's Json type rejects.
        const content = JSON.parse(JSON.stringify(editor.document)) as Prisma.InputJsonArray;
        saveDocContent(workspaceId, yjsState, content).catch(() => {
          // A failed autosave is retried by the next edit; the room still has the change.
        });
      }, SAVE_DEBOUNCE_MS);
    };
    doc.on("update", onUpdate);
    return () => {
      clearTimeout(timeout);
      doc.off("update", onUpdate);
    };
  }, [doc, editor, provider, workspaceId]);

  return (
    <div className="h-full overflow-y-auto pt-6">
      <BlockNoteView editor={editor} theme={outpostDarkTheme} />
    </div>
  );
}
