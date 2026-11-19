"use server";

import { canEditWorkspace } from "@/lib/workspace-access";
import { prisma } from "@/lib/prisma";
import { isCanvasSnapshot } from "@/lib/canvas-snapshot";
import type { Prisma } from "@/lib/generated/prisma/client";

// Called from the client on a debounce — same reasoning as saveDocContent: no revalidatePath,
// the tldraw store is already the source of truth on the client for the active session.
export async function saveCanvasContent(workspaceId: string, content: Prisma.InputJsonValue) {
  if (!(await canEditWorkspace(workspaceId))) throw new Error("Workspace not found");
  if (!isCanvasSnapshot(content)) throw new Error("Invalid canvas save");

  await prisma.canvas.update({
    where: { workspaceId },
    data: { content },
  });
}
