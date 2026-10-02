"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Keyboard, LoaderCircle, ScanLine, StopCircle } from "lucide-react";
import { post } from "@/lib/api";
import type { CampusEvent, CheckIn } from "@/lib/types";
import { date, time } from "@/lib/format";

export function Scanner({ events }: { events: CampusEvent[] }) {
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [payload, setPayload] = useState("");
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckIn | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  const scanGeneration = useRef(0);
  const processing = useRef(false);
  const latestEventId = useRef(eventId);
  latestEventId.current = eventId;
  function stop() {
    scanGeneration.current++;
    controls.current?.stop(); controls.current = null;
    if (video.current?.srcObject instanceof MediaStream) video.current.srcObject.getTracks().forEach(track => track.stop());
    setRunning(false); setStarting(false);
  }
  useEffect(() => () => {
    scanGeneration.current++;
    controls.current?.stop();
    if (video.current?.srcObject instanceof MediaStream) video.current.srcObject.getTracks().forEach(track => track.stop());
  }, []);
  async function submit(raw: string) {
    if (processing.current) return;
    if (!latestEventId.current || !raw.trim()) { setError("Choose an event and enter a ticket QR value."); return; }
    processing.current = true; setBusy(true); setError(""); setResult(null);
    stop();
    try {
      setResult(await post<CheckIn>("/tickets/check-in", { event_id: latestEventId.current, qr_payload: raw.trim() }));
      setPayload("");
    } catch (error) { setError(error instanceof Error ? error.message : "The ticket couldn't be checked in."); }
    finally { processing.current = false; setBusy(false); }
  }
  async function start() {
    setError(""); setResult(null); setStarting(true);
    const generation = ++scanGeneration.current;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Camera scanning requires HTTPS or localhost. You can paste the ticket QR value below.");
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (generation !== scanGeneration.current || !video.current) return;
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, video.current, (decoded, _error, activeControls) => {
        if (decoded && generation === scanGeneration.current && !processing.current) {
          activeControls.stop();
          void submit(decoded.getText());
        }
      });
      if (generation !== scanGeneration.current) { scanner.stop(); return; }
      controls.current = scanner; setRunning(true);
    } catch (error) {
      stop();
      setError(error instanceof Error && error.name === "NotAllowedError" ? "Camera access was denied. Allow camera permission or paste the ticket QR value below." : error instanceof Error ? error.message : "Camera unavailable. Paste the ticket QR value below.");
    } finally { if (generation === scanGeneration.current) setStarting(false); }
  }
  const selected = events.find(event => event.id === eventId);
  return <div className="scanner-grid"><section className="panel scanner-panel">
    <div className="section-kicker"><ScanLine size={16} /> GATE CHECK-IN</div><h2>One scan. You’re in.</h2><p className="muted">Select the event, then scan the attendee’s CampusPass.</p>
    <label className="field">Event<select value={eventId} onChange={event => { stop(); setEventId(event.target.value); setError(""); setResult(null); }}><option value="">Choose an event</option>{events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
    {selected && <p className="scanner-event-date">{date(selected.starts_at)} · {time(selected.starts_at)} · {selected.venue}</p>}
    <div className={`camera-frame ${running || starting ? "camera-active" : ""}`}><video ref={video} muted playsInline aria-label="Live camera view for QR scanning" />{!running && !starting && <div className="camera-placeholder"><ScanLine size={54} strokeWidth={1.2} /><p>Ready for your next attendee</p><small>The rear camera works best on a phone</small></div>}<div className="scan-corners" /></div>
    <button className="button button-primary button-full" disabled={!eventId || busy || starting} onClick={running ? stop : start}>{starting ? <LoaderCircle className="spin" size={18} /> : running ? <StopCircle size={18} /> : <Camera size={18} />}{starting ? "Starting camera…" : running ? "Stop camera" : "Open camera"}</button>
    {busy && <p className="flex-center muted"><LoaderCircle className="spin" size={18} /> Checking ticket…</p>}
    {error && <div className="form-error scan-result" role="alert">{error}</div>}
    {result && <div className="success-result" role="status"><CheckCircle2 size={25} /><div><strong>{result.attendee_name || "Attendee"} is checked in</strong><p>{result.message} · {time(result.checked_in_at)}</p></div></div>}
  </section><aside className="scanner-side"><div className="panel"><div className="section-kicker"><Keyboard size={16} /> MANUAL ENTRY</div><h3>Camera unavailable?</h3><p className="muted">Ask the attendee to open their ticket and copy the QR value.</p><form onSubmit={event => { event.preventDefault(); void submit(payload); }}><label className="field">Ticket QR value<textarea rows={4} value={payload} onChange={event => setPayload(event.target.value)} placeholder="Paste the complete signed QR value" autoCapitalize="none" spellCheck={false} /></label><button className="button button-secondary button-full" disabled={busy || !eventId || !payload.trim()} type="submit">{busy ? "Checking…" : "Verify & check in"}</button></form></div><div className="gate-guide"><span className="round-icon"><ShieldIcon /></span><h3>Every entry is verified</h3><p>Only a valid ticket for the selected event can enter. Cancelled tickets and repeat scans are rejected.</p></div></aside></div>;
}

function ShieldIcon() { return <CheckCircle2 size={23} />; }
