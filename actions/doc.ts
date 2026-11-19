"use server";

import * as Y from "yjs";
import { canEditWorkspace } from "@/lib/workspace-access";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

// Whether bytes decode as a Yjs update. Saving bytes that don't would leave a doc nobody can open.
function isYjsUpdate(bytes: Uint8Array) {
  try {
    Y.decodeUpdate(bytes);
    return true;
  } catch {
    return false;
  }
}

// Called from the client on a debounce — no revalidatePath, since the editor already holds
// the latest content locally and a refetch would just overwrite in-flight local edits.
export async function saveDocContent(
  workspaceId: string,
  yjsState: string,
  content: Prisma.InputJsonValue
) {
  if (!(await canEditWorkspace(workspaceId))) throw new Error("Workspace not found");

  // Checked at runtime too: a caller passing these in the wrong order type-checks (JSON values
  // are `any`) but would overwrite the doc with junk.
  if (typeof yjsState !== "string" || !Array.isArray(content)) {
    throw new Error("Invalid doc save");
  }
  const incoming = new Uint8Array(Buffer.from(yjsState, "base64"));
  if (!isYjsUpdate(incoming)) throw new Error("Invalid doc save");

  // Merge into the stored state instead of overwriting it, with the row locked, so two
  // collaborators saving at the same moment can't drop each other's edits.
  await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ yjsState: Uint8Array | null }[]>`
      SELECT "yjsState" FROM "Doc" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
    // A stored state that can't be decoded (left by an earlier bug) is replaced, not merged:
    // the incoming update is the client's full document.
    const merged =
      row?.yjsState && isYjsUpdate(row.yjsState)
        ? Y.mergeUpdates([row.yjsState, incoming])
        : incoming;

    await tx.doc.update({
      where: { workspaceId },
      data: { yjsState: Uint8Array.from(merged), content },
    });
  });
}
