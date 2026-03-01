import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Contexta - Context-Aware Voice Agent",
  description: "Real-time, context-driven AI voice conversations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${jetbrainsMono.variable}`}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="bg-background flex min-h-screen flex-col items-center justify-start gap-6 p-8">
            <header className="z-20 mx-auto flex w-full max-w-7xl items-center justify-between opacity-80">
              <div className="flex items-center space-x-2">
                <div className="bg-primary size-4" />
                <span className="text-xs font-medium tracking-[0.2em] uppercase">
                  <Link href="/">Contexta AI</Link>
                </span>
              </div>
              <div className="flex items-center space-x-6">
                <ThemeToggle />
              </div>
            </header>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
