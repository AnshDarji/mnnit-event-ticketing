"use client";
import { LoadingIndicator } from "@/components/loading-indicator";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { post } from "@/lib/api";
import type { Role, Session } from "@/lib/types";
import { roleLabel } from "@/lib/format";

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (options: { client_id: string; callback: (response: { credential: string }) => void; hd: string; auto_select: boolean }) => void;
      renderButton: (element: HTMLElement, options: { theme: string; size: string; shape: string; width: number; text: string }) => void;
    } } };
  }
}
const roles: Role[] = ["attendee", "organizer", "gate_staff", "admin"];

export function GoogleLogin({ onSession }: { onSession: (session: Session) => void }) {
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [demoRole, setDemoRole] = useState<Role>("attendee");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const authenticate = useCallback(async (credential: string) => {
    setPending(true); setError("");
    try { onSession(await post<Session>("/auth/google", { credential })); }
    catch (error) { setError(error instanceof Error ? error.message : "Sign-in failed. Try again."); }
    finally { setPending(false); }
  }, [onSession]);
  useEffect(() => {
    if (!clientId) return;
    let live = true;
    const render = () => {
      if (!live || !window.google || !button.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => void authenticate(credential), hd: "mnnit.ac.in", auto_select: false });
      window.google.accounts.id.renderButton(button.current, { theme: "outline", size: "large", shape: "rectangular", width: Math.min(300, Math.max(200, button.current.clientWidth)), text: "signin_with" });
    };
    if (window.google) render();
    else {
      const existing = document.querySelector<HTMLScriptElement>("script[data-google-identity]");
      if (existing) existing.addEventListener("load", render, { once: true });
      else {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.dataset.googleIdentity = "true";
        script.onload = render;
        script.onerror = () => { if (live) setError("Google sign-in couldn't load. Check your connection and reopen this dialog."); };
        document.head.appendChild(script);
      }
    }
    return () => { live = false; };
  }, [authenticate, clientId]);
  async function demo() {
    setPending(true); setError("");
    try { onSession(await post<Session>("/auth/demo", { role: demoRole })); }
    catch (error) { setError(error instanceof Error ? error.message : "Demo sign-in failed."); }
    finally { setPending(false); }
  }
  return <div className="login-body">
    <div className="login-mark"><ShieldCheck size={32} /></div>
    <h3>Your campus. Your pass.</h3><p>Sign in with your <strong>@mnnit.ac.in</strong> Google account to reserve seats and manage your tickets.</p>
    {clientId ? <div className={pending ? "google-button disabled" : "google-button"} ref={button} /> : <div className="inline-note">Institute sign-in is awaiting Google configuration. The project owner needs to add the Google client ID.</div>}
    {pending && <p className="muted flex-center"><LoadingIndicator compact />Signing you in…</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && <div className="demo-login"><span><Sparkles size={15} /> Local demo access</span><div className="demo-controls"><select aria-label="Demo role" value={demoRole} onChange={event => setDemoRole(event.target.value as Role)}>{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select><button className="button button-secondary" disabled={pending} onClick={demo}>Try demo</button></div><small>Uses synthetic accounts for local evaluation.</small></div>}
    <small className="login-footnote">Coursework pilot · Synthetic events · Free admission</small>
  </div>;
}
