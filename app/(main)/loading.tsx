import { Loader2 } from "lucide-react";

// Shown while the dashboard, board or a workspace loads its data (nested routes use the nearest
// loading file).
export default function Loading() {
  return (
    <div role="status" className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  );
}
