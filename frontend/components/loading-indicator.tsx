import { Ticket } from "lucide-react";

export function LoadingIndicator({ compact = false, label = "Loading" }: { compact?: boolean; label?: string }) {
  return <span className={`pass-loader ${compact ? "pass-loader-small" : ""}`} role="status" aria-label={label}><span className="pass-loader-track" /><span className="pass-loader-orbit" /><Ticket size={compact ? 10 : 20} strokeWidth={1.5} aria-hidden="true" /></span>;
}
