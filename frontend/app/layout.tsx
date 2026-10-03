import type { Metadata } from "next";
import { Inter, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./premium.css";

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const displayFont = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const monoFont = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "CampusPass · MNNIT Events",
  description: "Discover campus events, reserve your seat, and enter with your CampusPass. MNNIT coursework pilot.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}><body>{children}</body></html>;
}
