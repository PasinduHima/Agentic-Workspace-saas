import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: { userId: "user_me", orgId: null as string | null, orgRole: null as string | null },
  workspace: null as null | { clerkOrgId: string | null; creator: { clerkId: string } },
  memberships: [] as { role: string }[],
  membershipQuery: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => state.session,
  clerkClient: async () => ({
    organizations: {
      getOrganizationMembershipList: async (params: unknown) => {
        state.membershipQuery(params);
        return { data: state.memberships };
      },
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { workspace: { findUnique: async () => state.workspace } },
}));

vi.mock("@/lib/billing", () => ({ workspaceOwnerSelect: {} }));

const { canAccessWorkspace, canEditWorkspace } = await import("./workspace-access");

const orgWorkspace = { clerkOrgId: "org_a", creator: { clerkId: "user_other" } };

describe("workspace access", () => {
  beforeEach(() => {
    state.session = { userId: "user_me", orgId: null, orgRole: null };
    state.workspace = null;
    state.memberships = [];
    state.membershipQuery.mockReset();
  });

  it("denies a missing workspace", async () => {
    expect(await canAccessWorkspace("w")).toBe(false);
  });

  it("limits a personal workspace to its creator", async () => {
    state.workspace = { clerkOrgId: null, creator: { clerkId: "user_me" } };
    expect(await canEditWorkspace("w")).toBe(true);
    state.workspace = { clerkOrgId: null, creator: { clerkId: "user_other" } };
    expect(await canAccessWorkspace("w")).toBe(false);
  });

  it("lets members of the active org edit", async () => {
    state.workspace = orgWorkspace;
    state.session = { userId: "user_me", orgId: "org_a", orgRole: "org:member" };
    expect(await canEditWorkspace("w")).toBe(true);
    expect(state.membershipQuery).not.toHaveBeenCalled();
  });

  it("lets viewers open but not edit", async () => {
    state.workspace = orgWorkspace;
    state.session = { userId: "user_me", orgId: "org_a", orgRole: "org:viewer" };
    expect(await canAccessWorkspace("w")).toBe(true);
    expect(await canEditWorkspace("w")).toBe(false);
  });

  it("looks up the one membership for a workspace in another org", async () => {
    state.workspace = orgWorkspace;
    state.session = { userId: "user_me", orgId: "org_b", orgRole: "org:admin" };
    state.memberships = [{ role: "org:viewer" }];

    expect(await canAccessWorkspace("w")).toBe(true);
    expect(await canEditWorkspace("w")).toBe(false);
    expect(state.membershipQuery).toHaveBeenCalledWith({ organizationId: "org_a", userId: ["user_me"] });
  });

  it("denies non-members of another org", async () => {
    state.workspace = orgWorkspace;
    state.session = { userId: "user_me", orgId: "org_b", orgRole: "org:admin" };
    expect(await canAccessWorkspace("w")).toBe(false);
  });
});
