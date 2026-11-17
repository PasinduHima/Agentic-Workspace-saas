"use client";

import { usePathname } from "next/navigation";
import React from "react";
import SiteHeader from "./SiteHeader";
import { UpgradeDialogProvider } from "./UpgradeDialog";

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isFullScreenRoute =
    pathname?.startsWith("/workspace/") || pathname?.startsWith("/shared");

  // The upgrade dialog wraps every route: the site header's plan button opens it, and so do the
  // workspace's own header, agent panel and Share dialog on the full-screen routes.
  return (
    <UpgradeDialogProvider>
      {isFullScreenRoute ? (
        children
      ) : (
        <>
          <SiteHeader />
          <div className="flex flex-1 flex-col pt-18">{children}</div>
        </>
      )}
    </UpgradeDialogProvider>
  );
};

export default AppShell;
