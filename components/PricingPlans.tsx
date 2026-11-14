"use client";

import { SignUpButton, useAuth } from "@clerk/nextjs";
import {
  CheckoutButton,
  usePlans,
  useSubscription,
} from "@clerk/nextjs/experimental";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The plans from Clerk Billing as cards with our own checkout buttons: organization plans when an
 * org is selected, personal plans otherwise. Unlike Clerk's <PricingTable />, this reports when a
 * checkout starts, so a dialog hosting it can close before Clerk's checkout drawer opens.
 */
export function PricingPlans({
  onCheckoutStart,
}: {
  onCheckoutStart?: () => void;
}) {
  const { isSignedIn, orgId } = useAuth();
  const payer = orgId ? "organization" : "user";
  const { data: plans, isLoading } = usePlans({ for: payer });
  const { data: subscription } = useSubscription({ for: payer });

  if (isLoading) {
    return (
      <p className="py-10 text-center text-muted-foreground">Loading plans…</p>
    );
  }

  if (!plans?.length) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        No plans are available yet.
      </p>
    );
  }

  const currentPlanIds = new Set(
    subscription?.subscriptionItems
      .filter((item) => item.status === "active" || item.status === "past_due")
      .map((item) => item.plan.id),
  );

  return (
    <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
      {plans.map((plan) => {
        const isCurrent = currentPlanIds.has(plan.id);
        const isPaid = plan.hasBaseFee;

        return (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col rounded-xl border bg-card p-5",
              isCurrent && "border-primary/60",
            )}
          >
            <h3 className="text-base font-semibold">{plan.name}</h3>
            {plan.description && (
              <p className="mt-1 text-muted-foreground">{plan.description}</p>
            )}

            <p className="mt-5 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">
                {plan.fee
                  ? `${plan.fee.currencySymbol}${plan.fee.amountFormatted}`
                  : "Free"}
              </span>
              {isPaid && (
                <span className="text-muted-foreground">
                  {payer === "organization" ? "per member / month" : "/ month"}
                </span>
              )}
            </p>

            <ul className="mt-5 mb-6 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature.id} className="flex items-baseline gap-2.5">
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 -translate-y-0.5 rotate-45 bg-primary"
                  />
                  {feature.name}
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              {isCurrent ? (
                <Button variant="outline" className="w-full" disabled>
                  Current plan
                </Button>
              ) : !isSignedIn ? (
                <SignUpButton mode="modal">
                  <Button className="w-full" onClick={onCheckoutStart}>
                    Get started
                  </Button>
                </SignUpButton>
              ) : isPaid ? (
                <CheckoutButton planId={plan.id} planPeriod="month" for={payer}>
                  <Button className="w-full" onClick={onCheckoutStart}>
                    Upgrade to {plan.name}
                  </Button>
                </CheckoutButton>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
