import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { workspaceOwnerSelect } from "@/lib/billing";

// Org members with this role can open a workspace but not change it.
export const VIEWER_ROLE = "org:viewer";

/**
 * The signed-in user's role on a workspace: "creator" for their own personal workspace, their
 * Clerk org role for an org workspace, or null when they have no access (or it doesn't exist).
 */
async function getWorkspaceRole(workspaceId: string): Promise<string | null> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return null;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: workspaceOwnerSelect,
  });
  if (!workspace) return null;

  if (!workspace.clerkOrgId) return workspace.creator.clerkId === userId ? "creator" : null;
  if (workspace.clerkOrgId === orgId) return orgRole ?? null;

  // The session only knows the active org, so look up this one membership for links into another
  // org (a single filtered request, rather than paging through every org the user belongs to).
  const clerk = await clerkClient();
  const { data: memberships } = await clerk.organizations.getOrganizationMembershipList({
    organizationId: workspace.clerkOrgId,
    userId: [userId],
  });
  return memberships[0]?.role ?? null;
}

// Org workspaces are open to every member of that org; personal (org-less) ones only to their creator.
export async function canAccessWorkspace(workspaceId: string) {
  return (await getWorkspaceRole(workspaceId)) !== null;
}

// Changing a workspace (its doc, canvas, name, board position, sharing, or running the agent on
// it) needs access and a role other than viewer.
export async function canEditWorkspace(workspaceId: string) {
  const role = await getWorkspaceRole(workspaceId);
  return role !== null && role !== VIEWER_ROLE;
}
                                                                                                                                                      