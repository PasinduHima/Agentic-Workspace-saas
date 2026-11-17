import type { Prisma, WorkspaceStatus } from "@/lib/generated/prisma/client";

// Display names for the kanban columns, in board order.
export const WORKSPACE_STATUS_LABELS: Record<WorkspaceStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

export function statusTitle(status: WorkspaceStatus) {
  return WORKSPACE_STATUS_LABELS[status];
}

// The board's columns, left to right.
export const WORKSPACE_STATUSES = (
  Object.keys(WORKSPACE_STATUS_LABELS) as WorkspaceStatus[]
).map((status) => ({ status, title: WORKSPACE_STATUS_LABELS[status] }));

// What a workspace card needs, on the dashboard and on the board.
export const workspaceCardSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  position: true,
  updatedAt: true,
  creator: { select: { name: true, imageUrl: true } },
  doc: { select: { updatedAt: true } },
  canvas: { select: { updatedAt: true } },
} satisfies Prisma.WorkspaceSelect;

type WorkspaceCardRow = Prisma.WorkspaceGetPayload<{
  select: typeof workspaceCardSelect;
}>;

// Editing the doc or canvas doesn't touch the workspace row, so "last activity" is the newest of
// the three timestamps. The result fits WorkspaceCardData in components/WorkspaceCard.tsx.
export function withLastActivity({ doc, canvas, ...workspace }: WorkspaceCardRow) {
  const times = [workspace.updatedAt, doc?.updatedAt, canvas?.updatedAt]
    .filter((date): date is Date => !!date)
    .map((date) => date.getTime());
  return { ...workspace, lastActivity: new Date(Math.max(...times)) };
}
