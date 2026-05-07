import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import Providers from "@/components/providers";
import { Toaster } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://agentfoloup.vercel.app"
  ),
  title: "FoloUp",
  description: "AI powered Interviews",
  openGraph: {
    title: "FoloUp",
    description: "AI-powered Interviews",
    siteName: "FoloUp",
    images: [
      {
        url: "/foloup.png",
        width: 800,
        height: 600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/browser-user-icon.ico" />
      </head>
      <body className={inter.className}>
          <Providers>
            <div className="fixed top-4 right-4 z-50">
              <ThemeToggle />
            </div>
            {children}
            <Toaster
              toastOptions={{
                classNames: {
                  toast: "bg-white border-2 border-indigo-400",
                  title: "text-black",
                  description: "text-red-400",
                  actionButton: "bg-indigo-400",
                  cancelButton: "bg-orange-400",
                  closeButton: "bg-lime-400",
                },
              }}
            />
          </Providers>
      </body>
    </html>
  );
}
