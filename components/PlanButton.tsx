"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  SubscriptionDetailsButton,
  useSubscription,
} from "@clerk/nextjs/experimental";
import { getMyPromptUsage } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { useUpgradeDialog } from "@/components/UpgradeDialog";
import { UPGRADE_REASONS } from "@/lib/plan-limits";

/** Fired by the agent panel after each prompt, so usage-aware UI can refresh. */
export const PROMPT_USED_EVENT = "outpost:prompt-used";

// The active context's prompt usage, refreshed after each agent prompt.
function usePromptUsage(enabled: boolean, payer: string) {
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof getMyPromptUsage>>>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      getMyPromptUsage()
        .then((next) => !cancelled && setUsage(next))
        .catch(() => {});
    load();
    window.addEventListener(PROMPT_USED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PROMPT_USED_EVENT, load);
    };
    // payer: reload when switching between personal and an org.
  }, [enabled, payer]);

  return usage;
}

/**
 * Header button for signed-in users. On a paid plan it shows the plan's name and opens Clerk's
 * subscription details; otherwise it's an "Upgrade" button that opens the pricing dialog.
 * With `upgradeOnlyWhenOut` (the workspace header), free users only see it once this month's
 * agent prompts are used up, so it doesn't crowd the editor before it's needed.
 * The plan follows the active context: the selected org's, or the user's own without one.
 */
export function PlanButton({ upgradeOnlyWhenOut = false }: { upgradeOnlyWhenOut?: boolean }) {
  const { orgId } = useAuth();
  const payer = orgId ? "organization" : "user";
  const { data: subscription, isLoading } = useSubscription({ for: payer });
  const usage = usePromptUsage(upgradeOnlyWhenOut, payer);
  const openUpgrade = useUpgradeDialog();

  // Render nothing while loading, so paid users don't see "Upgrade" flash first.
  if (isLoading) return null;

  const paidPlan = subscription?.subscriptionItems.find(
    (item) =>
      item.plan.hasBaseFee && (item.status === "active" || item.status === "past_due"),
  )?.plan;

  if (paidPlan) {
    return (
      <SubscriptionDetailsButton for={payer}>
        <Button variant="outline" size="sm">
          {paidPlan.name}
        </Button>
      </SubscriptionDetailsButton>
    );
  }

  if (upgradeOnlyWhenOut) {
    if (!usage || usage.used < usage.limit) return null;
    return (
      <Button size="sm" onClick={() => openUpgrade(UPGRADE_REASONS.prompts)}>
        Out of prompts · Upgrade
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={() => openUpgrade()}>
      Upgrade
    </Button>
  );
}

export default PlanButton;
