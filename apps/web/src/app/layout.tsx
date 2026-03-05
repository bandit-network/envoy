import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { EnvoyAuthProvider } from "@/components/providers/auth-context";
import { ToastProvider } from "@/components/providers/toast-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Envoy",
  description: "Human-owned agent identities trusted by platforms everywhere",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <SolanaWalletProvider>
            <EnvoyAuthProvider>{children}</EnvoyAuthProvider>
          </SolanaWalletProvider>
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
