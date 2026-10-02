import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusPass · MNNIT Events",
  description: "Discover campus events, reserve your seat, and enter with your CampusPass. MNNIT coursework pilot.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
