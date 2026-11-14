import { FileText, SquareKanban, Workflow, type LucideIcon } from "lucide-react";

/** All landing page copy lives here; app/page.tsx only handles layout. */

export const hero = {
  eyebrow: "Early Access",
  // The headline is split so the page can color the highlighted word.
  headline: {
    before: "An ",
    highlight: "outpost",
    after: " for whatever you're building",
  },
  subtitle:
    "Docs and canvases in one workspace, with an AI agent that draws and writes alongside you and your team, live.",
  primaryCta: { label: "Start building free", href: "/sign-up" },
  secondaryCta: { label: "See how it works", href: "#how-it-works" },
  videoLabel: "Outpost product demo",
};

export const audience = {
  label: "Built for",
  items: [
    "Product teams",
    "Founders",
    "Solo builders",
    "Agencies",
    "Consultants",
  ],
};

export type FeatureMock = "canvas" | "docs" | "board";

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: [string, string, string];
  /** Which static mock to render next to the row. */
  mock: FeatureMock;
};

export const features: {
  eyebrow: string;
  title: string;
  rows: Feature[];
} = {
  eyebrow: "The workspace",
  title: "One agent, one workspace, your whole team",
  rows: [
    {
      icon: Workflow,
      title: "Canvas",
      description:
        "An infinite whiteboard where the agent draws flowcharts, ERDs, architecture diagrams and org charts shape by shape, and edits them in place when you ask.",
      bullets: [
        "Flowcharts, ERDs, architecture diagrams and org charts",
        "Drawn shape by shape, so you can watch and steer",
        "Ask for a change and it edits the diagram in place",
      ],
      mock: "canvas",
    },
    {
      icon: FileText,
      title: "Docs",
      description:
        "A block editor where the agent turns a diagram into a written spec, and rewrites or summarizes sections on command.",
      bullets: [
        "Turn any diagram into a written spec",
        "Rewrite a section on command",
        "Summarize a section when it runs long",
      ],
      mock: "docs",
    },
    {
      icon: SquareKanban,
      title: "Team board",
      description:
        "A kanban board of every workspace in your org, with live cursors so teammates can jump in together.",
      bullets: [
        "Every workspace in your org on one board",
        "Live cursors show who is where",
        "Jump into a workspace together",
      ],
      mock: "board",
    },
  ],
};

export type Step = { title: string; description: string };

export const howItWorks: { eyebrow: string; title: string; steps: Step[] } = {
  eyebrow: "How it works",
  title: "From a sentence to a shared plan",
  steps: [
    {
      title: "Describe it",
      description:
        "Tell the agent what you need in plain language: a signup flow, a database schema, a system architecture.",
    },
    {
      title: "Watch the agent draw",
      description:
        "It lays the diagram out on the canvas shape by shape, so you can see it take form and steer as it goes.",
    },
    {
      title: "Keep iterating together",
      description:
        "Ask for changes, turn the diagram into a spec, and bring teammates in to refine it live.",
    },
  ],
};

// Plans themselves come from Clerk Billing (see <PricingTable /> in app/page.tsx); only the
// surrounding copy and the tab labels live here.
export const pricing: {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** One tab per Clerk payer type: "user" plans are personal, "organization" plans are per team. */
  tabs: { for: "user" | "organization"; label: string }[];
} = {
  eyebrow: "Pricing",
  title: "Start free, upgrade when your team grows",
  subtitle: "Upgrade just yourself or your whole team. Billed per member.",
  tabs: [
    { for: "user", label: "Personal" },
    { for: "organization", label: "Teams" },
  ],
};

export const closingCta = {
  title: "Set up your outpost",
  subtitle:
    "Start with a sentence and let the agent map out the rest with you.",
  cta: hero.primaryCta,
  mascotAlt: "Outpost mascot",
};

export const footer = {
  credit: "Made By Pasindu Himal",
};
