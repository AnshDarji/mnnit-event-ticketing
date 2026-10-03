"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, QrCode, ShieldCheck, Ticket } from "lucide-react";
import { GoogleLogin } from "@/components/google-login";
import { api, saveToken, token } from "@/lib/api";
import type { Session } from "@/lib/types";

export function InstituteSignIn() {
  const router = useRouter();
  useEffect(() => {
    if (token()) void api("/auth/me").then(() => router.replace("/dashboard")).catch(() => {});
  }, [router]);
  function signedIn(session: Session) { saveToken(session.access_token); router.replace("/dashboard"); }
  return <div className="institute-sign-in">
    <header className="site-header"><div className="header-inner"><Link className="brand" href="/" aria-label="CampusPass home"><span className="brand-mark"><Ticket size={23} /></span><span>Campus<span className="brand-pass">Pass</span><small>MNNIT ALLAHABAD</small></span></Link><Link href="/" className="back-home"><ArrowLeft size={15} />Back to campus</Link></div></header>
    <main className="sign-in-grid"><section className="sign-in-intro"><span className="edition-stamp">YOUR INSTITUTE. YOUR ACCESS.</span><h1>Welcome to<br /><em>your campus.</em></h1><p>One institute account connects your events, reservations and tickets.</p><div className="sign-in-benefits"><div><CalendarDays size={21} /><span>Discover what’s happening</span></div><div><Ticket size={21} /><span>Reserve your place</span></div><div><QrCode size={21} /><span>Arrive with a signed QR ticket</span></div></div><span className="sign-in-pilot"><ShieldCheck size={14} />MNNIT coursework pilot · Synthetic events</span></section><section className="sign-in-card"><span className="edition-stamp">INSTITUTE SIGN-IN</span><GoogleLogin onSession={signedIn} /></section></main>
  </div>;
}
