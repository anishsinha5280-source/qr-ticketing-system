import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "@/components/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CampusPass — Event Ticketing with Signed QR Check-In",
    template: "%s · CampusPass",
  },
  description:
    "Campus event ticketing system with automated confirmation emails, cryptographically signed QR tickets and real-time anti-duplicate entry check-in.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-slate-200 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
