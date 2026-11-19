"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, FileDown, Link2, Lock, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { setWorkspaceSharing } from "@/actions/workspace";
import { useFetch } from "@/hooks/use-fetch";
import { useUpgradeDialog } from "@/components/UpgradeDialog";
import { useWorkspaceEditors } from "@/components/WorkspaceEditorsContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { UPGRADE_REASONS } from "@/lib/plan-limits";

// "Checkout flow / v2" -> "Checkout-flow-v2", safe as a file name on every OS.
function fileName(name: string, suffix: string) {
  const base = name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "workspace";
  return `${base}-${suffix}.pdf`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Give the browser a moment to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const noopSubscribe = () => () => {};

/**
 * Header "Share" dialog: a public read-only link (paid), and PDF export of the doc and the canvas
 * (paid). Export uses the live editors, so a surface hidden by the current view can't be exported
 * until it's shown again.
 */
export function ShareDialog({
  workspaceId,
  workspaceName,
  initialShareToken,
  canShare,
  canExportPdf,
}: {
  workspaceId: string;
  workspaceName: string;
  initialShareToken: string | null;
  canShare: boolean;
  canExportPdf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<"doc" | "canvas" | null>(null);
  const { fn: setSharingFn, loading: savingSharing } = useFetch(setWorkspaceSharing);
  const { docEditor, canvasEditor } = useWorkspaceEditors();
  const openUpgrade = useUpgradeDialog();

  // window.location only exists in the browser; the link field renders once it's known.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const shareUrl = shareToken && origin ? `${origin}/shared/${shareToken}` : "";

  // Close this dialog first, so the upgrade dialog isn't stacked on top of it.
  const upgrade = (reason: (typeof UPGRADE_REASONS)[keyof typeof UPGRADE_REASONS]) => {
    setOpen(false);
    openUpgrade(reason);
  };

  const updateSharing = async (enabled: boolean) => {
    if (enabled && !canShare) return upgrade(UPGRADE_REASONS.sharing);
    const result = await setSharingFn(workspaceId, enabled);
    if (!result) return;
    if ("limit" in result) return upgrade(UPGRADE_REASONS[result.limit]);
    setShareToken(result.shareToken);
    setCopied(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  };

  const exportDoc = async () => {
    if (!canExportPdf) return upgrade(UPGRADE_REASONS.pdfExport);
    if (!docEditor) return;
    setExporting("doc");
    try {
      // Loaded on demand: the exporter, react-pdf and their fonts are large and only needed here.
      const [{ PDFExporter, pdfDefaultSchemaMappings }, { pdf }] = await Promise.all([
        import("@blocknote/xl-pdf-exporter/react-pdf"),
        import("@react-pdf/renderer"),
      ]);
      const exporter = new PDFExporter(docEditor.schema, pdfDefaultSchemaMappings);
      const document = await exporter.toReactPDFDocument(docEditor.document);
      download(await pdf(document).toBlob(), fileName(workspaceName, "doc"));
    } catch (error) {
      console.error("Doc PDF export failed", error);
      toast.error("Couldn't export the doc. Try again.");
    } finally {
      setExporting(null);
    }
  };

  const exportCanvas = async () => {
    if (!canExportPdf) return upgrade(UPGRADE_REASONS.pdfExport);
    if (!canvasEditor) return;
    const shapeIds = [...canvasEditor.getCurrentPageShapeIds()];
    if (shapeIds.length === 0) return toast.info("The canvas is empty.");

    setExporting("canvas");
    try {
      const [{ url, width, height }, { jsPDF }] = await Promise.all([
        canvasEditor.toImageDataUrl(shapeIds, {
          format: "png",
          background: true,
          padding: 32,
          scale: 2,
          darkMode: false,
        }),
        import("jspdf"),
      ]);
      // One page the same size as the image, so nothing is cropped or shrunk onto A4.
      const pdf = new jsPDF({
        orientation: width >= height ? "landscape" : "portrait",
        unit: "px",
        format: [width, height],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(url, "PNG", 0, 0, width, height);
      download(pdf.output("blob"), fileName(workspaceName, "canvas"));
    } catch (error) {
      console.error("Canvas PDF export failed", error);
      toast.error("Couldn't export the canvas. Try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share &ldquo;{workspaceName}&rdquo;</DialogTitle>
          <DialogDescription>
            Team members in this workspace&apos;s organization can already open it.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Link2 className="size-4" />
                Public link
              </p>
              <p className="mt-1 text-muted-foreground">
                Anyone with the link can view the doc and canvas, read-only.
                {!canShare && " Available on paid plans."}
              </p>
            </div>
            {canShare ? (
              <Switch
                checked={!!shareToken}
                onCheckedChange={updateSharing}
                disabled={!!savingSharing}
                aria-label="Public link"
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => upgrade(UPGRADE_REASONS.sharing)}
              >
                <Lock className="size-3.5" />
                Upgrade
              </Button>
            )}
          </div>

          {canShare && shareUrl && (
            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Share link"
              />
              <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                {copied ? <Check className="text-primary" /> : <Copy />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateSharing(true)}
                disabled={!!savingSharing}
                aria-label="Reset link"
                title="Reset link: the current link stops working"
              >
                <RefreshCw />
              </Button>
            </div>
          )}
        </section>

        <Separator />

        <section className="grid gap-3">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <FileDown className="size-4" />
              Export as PDF
            </p>
            <p className="mt-1 text-muted-foreground">
              {canExportPdf
                ? "Downloads what's in the workspace right now."
                : "Available on paid plans."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={exportDoc}
              disabled={exporting !== null || (canExportPdf && !docEditor)}
              title={canExportPdf && !docEditor ? "Switch to a view with the doc to export it" : undefined}
            >
              {!canExportPdf && <Lock className="size-3.5" />}
              {exporting === "doc" ? "Exporting…" : "Doc"}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={exportCanvas}
              disabled={exporting !== null || (canExportPdf && !canvasEditor)}
              title={
                canExportPdf && !canvasEditor
                  ? "Switch to a view with the canvas to export it"
                  : undefined
              }
            >
              {!canExportPdf && <Lock className="size-3.5" />}
              {exporting === "canvas" ? "Exporting…" : "Canvas"}
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
