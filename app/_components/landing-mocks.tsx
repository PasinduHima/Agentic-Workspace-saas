import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Static, decorative mocks of each product surface for the landing page features section.
   They are illustrations, not screenshots, so they are hidden from assistive tech. */

function MockWindow({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/40"
    >
      <div className="flex items-center gap-1.5 border-b px-4 py-3">
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="ml-3 font-mono text-[0.7rem] text-muted-foreground">
          {title}
        </span>
      </div>
      <div className={cn("aspect-[4/3]", className)}>{children}</div>
    </div>
  );
}

/** A name-tagged pointer, used for the agent and for teammates. */
function Cursor({
  name,
  className,
  tone = "primary",
}: {
  name: string;
  className?: string;
  tone?: "primary" | "neutral";
}) {
  return (
    <div className={cn("absolute flex items-start", className)}>
      <svg
        viewBox="0 0 12 12"
        className={cn(
          "size-3",
          tone === "primary" ? "fill-primary" : "fill-foreground",
        )}
      >
        <path d="M0 0l12 4.5-5 1.8L5 12z" />
      </svg>
      <span
        className={cn(
          "mt-2.5 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium",
          tone === "primary"
            ? "bg-primary text-primary-foreground"
            : "bg-foreground text-background",
        )}
      >
        {name}
      </span>
    </div>
  );
}

export function CanvasMock() {
  const node = "fill-secondary stroke-border";
  const label = "fill-foreground text-[11px] font-medium";
  const edge = "fill-none stroke-muted-foreground/70";

  return (
    <MockWindow
      title="checkout-flow.canvas"
      className="relative bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] bg-size-[18px_18px]"
    >
      <svg viewBox="0 0 400 300" className="size-full">
        <defs>
          <marker
            id="canvas-mock-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0l8 4-8 4z" className="fill-muted-foreground/70" />
          </marker>
        </defs>

        {/* Edges */}
        <g className={edge} strokeWidth="1.5" markerEnd="url(#canvas-mock-arrow)">
          <path d="M200 76v26" />
          <path d="M138 136H80v64" />
          <path d="M262 136h58v64" />
        </g>

        {/* Start */}
        <rect x="140" y="36" width="120" height="40" rx="8" className={node} />
        <text x="200" y="60" textAnchor="middle" className={label}>
          Sign up
        </text>

        {/* Decision */}
        <path d="M200 104l62 32-62 32-62-32z" className={node} />
        <text x="200" y="140" textAnchor="middle" className={label}>
          Verified?
        </text>
        <text
          x="106"
          y="128"
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          no
        </text>
        <text
          x="294"
          y="128"
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          yes
        </text>

        {/* Branches */}
        <rect x="20" y="202" width="120" height="40" rx="8" className={node} />
        <text x="80" y="226" textAnchor="middle" className={label}>
          Send email
        </text>

        {/* The shape the agent is drawing right now */}
        <rect
          x="260"
          y="202"
          width="120"
          height="40"
          rx="8"
          strokeDasharray="5 4"
          strokeWidth="1.5"
          className="fill-accent stroke-primary"
        />
        <text x="320" y="226" textAnchor="middle" className={label}>
          Onboarding
        </text>
      </svg>
      <Cursor name="Agent" className="right-[4%] bottom-[12%]" />
    </MockWindow>
  );
}

function Line({ className }: { className?: string }) {
  return <div className={cn("h-2 rounded-full bg-muted", className)} />;
}

export function DocsMock() {
  return (
    <MockWindow title="checkout-flow.doc" className="flex flex-col gap-4 p-6">
      <div>
        <p className="text-lg font-semibold">Checkout flow spec</p>
        <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
          Generated from checkout-flow.canvas
        </p>
      </div>

      <div className="space-y-2">
        <Line className="w-full" />
        <Line className="w-11/12" />
        <Line className="w-3/5" />
      </div>

      {/* The block the agent is rewriting */}
      <div className="rounded-md border-l-2 border-primary bg-accent/60 py-3 pr-3 pl-4">
        <p className="text-[0.65rem] font-medium text-primary">
          Agent is rewriting this section
        </p>
        <div className="mt-2.5 space-y-2">
          <Line className="w-full bg-primary/25" />
          <Line className="w-4/5 bg-primary/25" />
        </div>
      </div>

      <p className="text-sm font-medium">Verification</p>
      <ul className="space-y-2.5">
        {["w-4/5", "w-2/3", "w-3/4"].map((width) => (
          <li key={width} className="flex items-center gap-2.5">
            <span className="size-1 shrink-0 rounded-full bg-muted-foreground" />
            <Line className={width} />
          </li>
        ))}
      </ul>
    </MockWindow>
  );
}

const boardColumns = [
  {
    name: "Planning",
    cards: [
      { title: "Onboarding revamp", members: ["MK", "JL"] },
      { title: "Pricing page", members: ["AR"] },
    ],
  },
  {
    name: "In progress",
    cards: [
      { title: "Checkout flow", members: ["JL", "AR", "MK"], active: true },
      { title: "Billing ERD", members: ["TS"] },
      { title: "Q3 roadmap", members: ["MK"] },
    ],
  },
  {
    name: "Shipped",
    cards: [{ title: "Auth architecture", members: ["TS", "JL"] }],
  },
];

export function BoardMock() {
  return (
    <MockWindow title="acme / team board" className="relative p-4">
      <div className="grid h-full grid-cols-3 gap-3">
        {boardColumns.map((column) => (
          <div key={column.name} className="rounded-lg bg-muted/40 p-2">
            <p className="flex items-center justify-between px-1 pb-2 text-[0.65rem] font-medium text-muted-foreground">
              {column.name}
              <span className="font-mono">{column.cards.length}</span>
            </p>
            <div className="space-y-2">
              {column.cards.map((card) => (
                <div
                  key={card.title}
                  className={cn(
                    "rounded-md border bg-card p-2",
                    card.active && "border-primary/60",
                  )}
                >
                  <p className="text-[0.7rem] leading-tight font-medium">
                    {card.title}
                  </p>
                  <div className="mt-2 flex -space-x-1">
                    {card.members.map((member) => (
                      <span
                        key={member}
                        className="flex size-4 items-center justify-center rounded-full bg-secondary text-[0.45rem] font-medium ring-1 ring-card"
                      >
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Cursor name="Maya" className="top-[34%] left-[52%]" />
      <Cursor name="Jonas" tone="neutral" className="top-[62%] left-[14%]" />
    </MockWindow>
  );
}
