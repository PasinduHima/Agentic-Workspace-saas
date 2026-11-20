import Link from "next/link";
import { Button } from "@/components/ui/button";

// Unknown routes, workspaces the visitor can't open, and dead share links all land here.
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Nothing here</h1>
      <p className="max-w-md text-muted-foreground">
        This page doesn&apos;t exist, or you don&apos;t have access to it. Shared links stop working
        when sharing is turned off or the link is reset.
      </p>
      <Button variant="outline" asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
