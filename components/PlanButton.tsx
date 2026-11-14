"use client";

import { useAuth } from "@clerk/nextjs";
import {
  SubscriptionDetailsButton,
  useSubscription,
} from "@clerk/nextjs/experimental";
import { Button } from "@/components/ui/button";
import { useUpgradeDialog } from "@/components/UpgradeDialog";

/**
 * Header button for signed-in users. On a paid plan it shows the plan's name and opens Clerk's
 * subscription details; otherwise it is an "Upgrade" button that opens the pricing dialog.
 * The plan follows the active context: the selected org's, or the user's own without one.
 */
const PlanButton = () => {
  const { orgId } = useAuth();
  const payer = orgId ? "organization" : "user";
  const { data: subscription, isLoading } = useSubscription({ for: payer });
  const openUpgrade = useUpgradeDialog();

  // Render nothing while loading, so paid users don't see "Upgrade" flash first.
  if (isLoading) return null;

  const paidPlan = subscription?.subscriptionItems.find(
    (item) =>
      item.plan.hasBaseFee &&
      (item.status === "active" || item.status === "past_due"),
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

  return (
    <Button size="sm" onClick={() => openUpgrade()}>
      Upgrade
    </Button>
  );
};

export default PlanButton;
