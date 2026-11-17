"use client";

import dynamic from "next/dynamic";

// BlockNote needs the browser (DOM, selection APIs), so the editor is loaded on the client only.
// This wrapper exists because `ssr: false` is only allowed inside a client component, and the
// workspace page is a server component.
export const DocEditor = dynamic(
  () => import("@/components/DocEditor").then((mod) => mod.DocEditor),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-sm text-muted-foreground">Loading document…</div>
    ),
  },
);
