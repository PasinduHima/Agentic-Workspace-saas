import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkAPIResponseError } from "@clerk/nextjs/errors";

const state = vi.hoisted(() => ({ subscription: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    billing: { getUserBillingSubscription: state.subscription },
  }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { getEntitlements } = await import("./billing");

describe("getEntitlements", () => {
  beforeEach(() => {
    state.subscription.mockReset();
    vi.restoreAllMocks();
  });

  it("treats a missing subscription as the free plan without logging", async () => {
    state.subscription.mockRejectedValue(new ClerkAPIResponseError("Not found", { data: [], status: 404 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEntitlements("user_1");

    expect(result.isPaid).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it("falls back to free but logs other Clerk failures", async () => {
    state.subscription.mockRejectedValue(new ClerkAPIResponseError("Unavailable", { data: [], status: 503 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getEntitlements("user_1");

    expect(result.isPaid).toBe(false);
    expect(log).toHaveBeenCalledOnce();
  });

  it("reads plan features from an active subscription", async () => {
    state.subscription.mockResolvedValue({
      subscriptionItems: [
        { status: "active", plan: { features: [{ slug: "agent_prompts_500" }, { slug: "pdf_export" }] } },
      ],
    });

    const result = await getEntitlements("user_1");

    expect(result).toMatchObject({ isPaid: true, promptLimit: 500, pdfExport: true, publicSharing: false });
  });
});
