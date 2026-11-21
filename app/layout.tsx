import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/AppShell";
import { Toaster } from "sonner";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Outpost: Agentic Workspace";
const description = "An AI agent that draws and writes alongside you and your team, Live";
const ogImage = { url: "/social/og-image.png", width: 1200, height: 630, alt: "Outpost" };

export const metadata: Metadata = {
  // Makes the share-image URL absolute; without it Next falls back to localhost (or the Vercel URL).
  metadataBase: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : undefined,
  title,
  description,
  manifest: "/manifest.json",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  openGraph: { title, description, images: [ogImage], type: "website" },
  twitter: { card: "summary_large_image", title, description, images: [ogImage.url] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      appearance={{
        theme: dark,
        variables: { colorPrimary: "oklch(0.74 0.16 55)" },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>

          <Toaster richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
