import type { Metadata } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "AITalented — verified AI/ML talent index",
  description:
    "A structured, verified index of AI/ML engineers. Recruiters search evidenced skills; candidates build a portfolio that proves them.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en">
      <body>
        <TopBar user={user ? { email: user.email, role: user.role } : null} />
        {children}
      </body>
    </html>
  );
}
