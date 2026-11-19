import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Block } from "@blocknote/core";
import type { TLEditorSnapshot } from "tldraw";
import { Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getEntitlements, workspaceOwnerId, workspaceOwnerSelect } from "@/lib/billing";
import { isCanvasSnapshot } from "@/lib/canvas-snapshot";
import { DocViewer } from "@/app/_components/DocEditorLoader";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { CanvasViewer } from "./_components/CanvasViewer";

// The workspace behind a share link, or null when the link is unknown or sharing is no longer on
// the owner's plan (so links stop working after a downgrade). Cached so the metadata and the page
// share one lookup per request.
const getSharedWorkspace = cache(async (token: string) => {
  // Tokens are 24 random bytes as base64url (32 chars); anything else can't match.
  if (!/^[\w-]{20,64}$/.test(token)) return null;

  const workspace = await prisma.workspace.findUnique({
    where: { shareToken: token },
    select: {
      name: true,
      ...workspaceOwnerSelect,
      doc: { select: { content: true } },
      canvas: { select: { content: true } },
    },
  });
  if (!workspace) return null;

  const { publicSharing } = await getEntitlements(workspaceOwnerId(workspace));
  return publicSharing ? workspace : null;
});

export async function generateMetadata({ params }: PageProps<"/shared/[token]">): Promise<Metadata> {
  const workspace = await getSharedWorkspace((await params).token);
  return {
    title: workspace ? `${workspace.name} · Outpost` : "Outpost",
    // Share links are private by obscurity; keep them out of search engines.
    robots: { index: false, follow: false },
  };
}

export default async function SharedWorkspacePage({ params }: PageProps<"/shared/[token]">) {
  const workspace = await getSharedWorkspace((await params).token);
  if (!workspace) notFound();

  // The saved copies from Postgres, not the live rooms. Anything malformed shows as empty
  // rather than breaking the page.
  const docContent = workspace.doc?.content;
  const blocks = Array.isArray(docContent) ? (docContent as unknown as Block[]) : null;
  const canvasContent = workspace.canvas?.content;
  const snapshot = isCanvasSnapshot(canvasContent) ? (canvasContent as unknown as TLEditorSnapshot) : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/6 bg-background px-4">
        <Link
          href="/"
          className="flex size-8 items-center justify-center rounded-md transition-opacity hover:opacity-80"
        >
          <Image src="/brand/mascot-dark.png" alt="Outpost home" width={24} height={24} className="size-6" />
        </Link>
        <h1 className="truncate font-medium">{workspace.name}</h1>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/3 px-2.5 py-0.5 text-xs text-muted-foreground">
          <Eye className="size-3.5" />
          View only
        </span>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={35} minSize={20}>
          <DocViewer content={blocks} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={65} minSize={20}>
          <CanvasViewer snapshot={snapshot} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
