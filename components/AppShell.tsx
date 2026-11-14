"use client";

import { usePathname } from "next/navigation";
import React from "react";
import SiteHeader from "./SiteHeader";
import { UpgradeDialogProvider } from "./UpgradeDialog";

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isFullScreenRoute =
    pathname?.startsWith("/workspace/") || pathname?.startsWith("/shared");

  if (isFullScreenRoute) {
    return <>{children}</>;
  }
  return (
    // The header's plan button opens the upgrade dialog, so the provider wraps both.
    <UpgradeDialogProvider>
      <SiteHeader />
      <div className="flex flex-1 flex-col pt-18">{children}</div>
    </UpgradeDialogProvider>
  );
};

export default AppShell;
