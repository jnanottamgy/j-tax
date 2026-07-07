import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemedToaster } from "@/components/theme/themed-toaster";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "J-TACS | Tax · Compliance · Intelligence",
  description:
    "The operating system for modern CA firms. From lead to compliance — one platform.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/branding/jtacs-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/branding/jtacs-full-logo.png",
  },
  openGraph: {
    title: "J-TACS | Tax · Compliance · Intelligence",
    description:
      "The operating system for modern CA firms. From lead to compliance — one platform.",
    images: ["/branding/jtacs-full-logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "J-TACS | Tax · Compliance · Intelligence",
    description: "The operating system for modern CA firms.",
    images: ["/branding/jtacs-full-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes applies the stored theme class to
    // <html> before hydration — the server can't know the user's preference.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body className="min-h-svh flex flex-col selection:bg-primary/25">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
