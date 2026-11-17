"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, FileDown, Link2, RefreshCw, Share2 } from "lucide-react";
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

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<"doc" | "canvas" | null>(null);
  const { fn: setSharingFn, loading: savingSharing } = useFetch(setWorkspaceSharing);
  const { docEditor, canvasEditor } = useWorkspaceEditors();
  const openUpgrade = useUpgradeDialog();

  // window.location only exists in the browser; the link field renders once it's known.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const shareUrl = shareToken && origin ? `${origin}/shared/${shareToken}` : "";

  const updateSharing = async (enabled: boolean) => {
    if (enabled && !canShare) return openUpgrade(UPGRADE_REASONS.sharing);
    const result = await setSharingFn(workspaceId, enabled);
    if (!result) return;
    if ("limit" in result) return openUpgrade(UPGRADE_REASONS[result.limit]);
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
    if (!canExportPdf) return openUpgrade(UPGRADE_REASONS.pdfExport);
    if (!docEditor) return;
    setExporting("doc");
    try {
      // Loaded on demand: the exporter and its fonts are large and only needed here.
      const { PDFExporter, typstDefaultSchemaMappings } = await import(
        "@blocknote/xl-pdf-exporter"
      );
      const exporter = new PDFExporter(docEditor.schema, typstDefaultSchemaMappings);
      const result = await exporter.toPDF(docEditor.document, {
        title: workspaceName,
        lang: "en",
        tryDeclarePdfUA: false,
      });
      if (result.error) throw new Error(result.error);
      download(result.blob, fileName(workspaceName, "doc"));
    } catch {
      toast.error("Couldn't export the doc. Try again.");
    } finally {
      setExporting(null);
    }
  };

  const exportCanvas = async () => {
    if (!canExportPdf) return openUpgrade(UPGRADE_REASONS.pdfExport);
    if (!canvasEditor) return;
    const shapeIds = [...canvasEditor.getCurrentPageShapeIds()];
    if (shapeIds.length === 0) return toast.info("The canvas is empty.");

    setExporting("canvas");
    try {
      const { blob, width, height } = await canvasEditor.toImage(shapeIds, {
        format: "png",
        background: true,
        padding: 32,
        scale: 2,
        darkMode: false,
      });
      const { jsPDF } = await import("jspdf");
      // One page sized to the drawing, so nothing is cropped or shrunk onto A4.
      const pdf = new jsPDF({
        orientation: width >= height ? "landscape" : "portrait",
        unit: "px",
        format: [width, height],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(await blobToDataUrl(blob), "PNG", 0, 0, width, height);
      download(pdf.output("blob"), fileName(workspaceName, "canvas"));
    } catch {
      toast.error("Couldn't export the canvas. Try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Dialog>
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
            <Switch
              checked={!!shareToken}
              onCheckedChange={updateSharing}
              disabled={!!savingSharing}
              aria-label="Public link"
            />
          </div>

          {shareUrl && (
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
              onClick={exportDoc}
              disabled={exporting !== null || (canExportPdf && !docEditor)}
              title={canExportPdf && !docEditor ? "Switch to a view with the doc to export it" : undefined}
            >
              {exporting === "doc" ? "Exporting…" : "Doc"}
            </Button>
            <Button
              variant="outline"
              onClick={exportCanvas}
              disabled={exporting !== null || (canExportPdf && !canvasEditor)}
              title={
                canExportPdf && !canvasEditor
                  ? "Switch to a view with the canvas to export it"
                  : undefined
              }
            >
              {exporting === "canvas" ? "Exporting…" : "Canvas"}
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
