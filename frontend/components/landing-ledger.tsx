"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, QrCode, ScanLine, Ticket } from "lucide-react";

const steps = [
  { title: "Discover", headline: "Discover", accent: "your campus.", detail: "Find your next campus event.", label: "EVENT DISCOVERY", icon: CalendarDays },
  { title: "Reserve", headline: "A place,", accent: "just for you.", detail: "One place. Reserved for you.", label: "SEAT RESERVATION", icon: Ticket },
  { title: "Arrive", headline: "You’re in.", accent: "Welcome.", detail: "Your ticket. Verified at the gate.", label: "VERIFIED ENTRY", icon: ScanLine },
];

export function LandingLedger() {
  const [active, setActive] = useState(0);
  const step = steps[active];
  const Icon = step.icon;
  return <div className="campus-ledger">
    <div className="ledger-title"><span><i /> THE CAMPUS JOURNEY</span><span>01 → 02 → 03</span></div>
    <div className="ledger-stage" aria-live="polite">
      <span className="ledger-axis axis-horizontal" /><span className="ledger-axis axis-vertical" />
      <div className="ledger-background-pass back-pass-one" aria-hidden="true"><span>EVENT / MNNIT</span><i /><i /><i /><b>ADMIT ONE</b></div>
      <div className="ledger-background-pass back-pass-two" aria-hidden="true"><span>EVENT / MNNIT</span><i /><i /><i /><b>ADMIT ONE</b></div>
      <div className="ledger-main-pass" key={active}>
        <div className="ledger-pass-heading"><span>CAMPUSPASS</span><span>NO. 0{active + 1}</span></div>
        <div className="ledger-pass-content"><Icon size={23} strokeWidth={1.3} /><span>{step.label}</span><h2>{step.headline}<em>{step.accent}</em></h2><p>{step.detail}</p></div>
        <div className="ledger-perforation" />
        <div className="ledger-pass-foot"><span>{active === 2 ? <><Check size={14} /> CHECK-IN VERIFIED</> : active === 1 ? <><Check size={14} /> SEAT RESERVED</> : "MNNIT ALLAHABAD"}</span><QrCode size={35} strokeWidth={1.2} aria-hidden="true" /></div>
      </div>
      <span className="ledger-preview-label">INTERACTIVE PREVIEW · SYNTHETIC PILOT</span>
    </div>
    <div className="ledger-controls" aria-label="Preview the event journey">{steps.map((item, index) => <button key={item.title} aria-pressed={active === index} className={active === index ? "ledger-step-active" : ""} onClick={() => setActive(index)}><span>0{index + 1}</span>{item.title}<ArrowRight size={13} /></button>)}</div>
    <Link className="ledger-open" href="/dashboard"><span>OPEN THE EVENT DASHBOARD</span><ArrowRight size={16} /></Link>
  </div>;
}
