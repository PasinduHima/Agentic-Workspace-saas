import type { ComponentType } from "react";
import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BoardMock, CanvasMock, DocsMock } from "./_components/landing-mocks";
import Image from "next/image";
import {
  audience,
  closingCta,
  features,
  footer,
  hero,
  howItWorks,
  pricing,
  type FeatureMock,
} from "./_data/landing";

const mocks: Record<FeatureMock, ComponentType> = {
  canvas: CanvasMock,
  docs: DocsMock,
  board: BoardMock,
};

const eyebrowClass =
  "flex items-center gap-2.5 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase";

function Diamond({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rotate-45 bg-primary", className)}
    />
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="topo-bg flex flex-col items-center px-6 pt-24 pb-28 text-center sm:pt-32">
        <p className={eyebrowClass}>
          <Diamond />
          {hero.eyebrow}
        </p>

        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl md:text-7xl">
          {hero.headline.before}
          <span className="text-primary">{hero.headline.highlight}</span>
          {hero.headline.after}
        </h1>

        <p className="mt-6 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
          {hero.subtitle}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11 px-5 text-base">
            <Link href={hero.primaryCta.href}>{hero.primaryCta.label}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 px-5 text-base"
          >
            <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
          </Button>
        </div>

        {/* survey-frame sits on the wrapper: the card's overflow-hidden would clip the marks. */}
        <div className="survey-frame scroll-tilt mt-28 w-full max-w-5xl">
          <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/50">
            <video
              className="block aspect-video w-full object-cover"
              poster="/videos/hero-poster.jpg"
              width={1600}
              height={900}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={hero.videoLabel}
            >
              <source src="/videos/hero.webm" type="video/webm" />
              <source src="/videos/hero.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      <section className="border-y px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-x-10 gap-y-4 md:flex-row md:justify-center">
          <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {audience.label}
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
            {audience.items.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <Diamond className="size-1" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="product" className="scroll-mt-18 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center">
            <p className={eyebrowClass}>
              <Diamond />
              {features.eyebrow}
            </p>
            <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              {features.title}
            </h2>
          </div>

          <div className="mt-20 space-y-24 sm:space-y-32">
            {features.rows.map((feature, index) => {
              const Mock = mocks[feature.mock];
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="grid items-center gap-10 md:grid-cols-2 md:gap-16"
                >
                  <div className={cn(index % 2 === 1 && "md:order-last")}>
                    <span className="flex size-10 items-center justify-center rounded-lg border bg-accent text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-pretty text-muted-foreground">
                      {feature.description}
                    </p>
                    <ul className="mt-6 space-y-3 text-sm">
                      {feature.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-baseline gap-3">
                          <Diamond className="-translate-y-0.5" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Mock />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-18 border-t px-6 py-24 sm:py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center">
            <p className={eyebrowClass}>
              <Diamond />
              {howItWorks.eyebrow}
            </p>
            <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              {howItWorks.title}
            </h2>
          </div>

          {/* Waypoints on a route: numbered markers joined by a dashed line, which runs
              down the left on mobile and across the top from md up. */}
          <ol className="mt-20 grid md:grid-cols-3">
            {howItWorks.steps.map((step, index) => {
              const isLast = index === howItWorks.steps.length - 1;

              return (
                <li
                  key={step.title}
                  className="relative pb-12 pl-16 last:pb-0 md:pr-10 md:pb-0 md:pl-0"
                >
                  {!isLast && (
                    <span
                      aria-hidden
                      className="absolute top-10 bottom-0 left-5 border-l border-dashed border-primary/50 md:top-5 md:right-0 md:bottom-auto md:left-10 md:border-t md:border-l-0"
                    />
                  )}
                  <span
                    className={cn(
                      "absolute top-0 left-0 flex size-10 items-center justify-center rounded-full border border-primary font-mono text-xs md:static",
                      isLast
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-primary",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="pt-2 text-xl font-semibold tracking-tight md:mt-6 md:pt-0">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-pretty text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section
        id="pricing"
        className="scroll-mt-18 border-t px-6 py-24 sm:py-32"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center">
          <p className={eyebrowClass}>
            <Diamond />
            {pricing.eyebrow}
          </p>
          <h2 className="mt-5 text-center text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {pricing.title}
          </h2>
          <p className="mt-5 text-center text-base text-pretty text-muted-foreground">
            {pricing.subtitle}
          </p>

          {/* One tab per Clerk payer type. Plans, prices and checkout come from Clerk Billing. */}
          <Tabs
            defaultValue={pricing.tabs[0].for}
            className="mt-8 w-full items-center gap-8"
          >
            <TabsList>
              {pricing.tabs.map((tab) => (
                <TabsTrigger
                  key={tab.for}
                  value={tab.for}
                  className="px-4 data-active:bg-primary data-active:text-primary-foreground"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {pricing.tabs.map((tab) => (
              <TabsContent
                key={tab.for}
                value={tab.for}
                // Personal has fewer plans than Teams, so it gets a narrower row; at full
                // width Clerk stretches each card and leaves them mostly empty.
                className={cn("w-full", tab.for === "user" && "max-w-3xl")}
              >
                <PricingTable for={tab.for} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <section className="topo-bg flex flex-col items-center border-t px-6 py-28 text-center sm:py-36">
        <Image
          src="/brand/mascot-dark.png"
          alt={closingCta.mascotAlt}
          width={1975}
          height={1975}
          sizes="112px"
          className="size-28"
        />
        <h2 className="mt-8 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {closingCta.title}
        </h2>
        <p className="mt-5 max-w-md text-pretty text-muted-foreground sm:text-lg">
          {closingCta.subtitle}
        </p>
        <Button asChild size="lg" className="mt-10 h-11 px-5 text-base">
          <Link href={closingCta.cta.href}>{closingCta.cta.label}</Link>
        </Button>
      </section>

      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        {footer.credit}
      </footer>
    </main>
  );
}
