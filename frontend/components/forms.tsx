"use client";
import { useState } from "react";
import { ArrowRight, Info, LoaderCircle, ShieldCheck } from "lucide-react";
import { api, post } from "@/lib/api";
import type { CampusEvent, Role, Session, User } from "@/lib/types";
import { list, roleLabel } from "@/lib/format";

export const classifications = ["Institute-level", "Departmental", "Club / Society", "Open / Cross-department", "Restricted"];
const roles: Role[] = ["attendee", "organizer", "gate_staff", "admin"];

export function ProfileForm({ user, onSave }: { user: User; onSave: (session: Session) => void }) {
  const [role, setRole] = useState(user.role);
  const [department, setDepartment] = useState(user.department || "");
  const [program, setProgram] = useState(user.program || "");
  const [batch, setBatch] = useState(user.batch || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      onSave(await api<Session>("/auth/me", { method: "PUT", body: JSON.stringify({ role, department: department.trim().toUpperCase(), program: program.trim().toUpperCase(), batch: batch.trim() }) }));
    } catch (error) { setError(error instanceof Error ? error.message : "Profile couldn't be saved."); }
    finally { setBusy(false); }
  }
  return <form className="form-stack" onSubmit={submit}><div className="identity-card"><div className="avatar">{user.name.slice(0, 1)}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div><div className="inline-note"><ShieldCheck size={18} /><span>Roles are self-selected in this coursework pilot. Choose a role to try its workflow.</span></div><label className="field">Your role<select value={role} onChange={event => setRole(event.target.value as Role)}>{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label><div><h3 className="form-subtitle">Academic profile</h3><p className="muted text-small">These details determine eligibility for restricted events. Use the exact values shown in an event’s requirements.</p></div><div className="form-row"><label className="field">Department<input value={department} onChange={event => setDepartment(event.target.value)} placeholder="e.g. CSED" maxLength={40} /></label><label className="field">Program<input value={program} onChange={event => setProgram(event.target.value)} placeholder="e.g. B.TECH" maxLength={40} /></label></div><label className="field">Admission batch<input value={batch} onChange={event => setBatch(event.target.value)} placeholder="e.g. 2024" pattern="20[0-9]{2}" inputMode="numeric" maxLength={4} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button button-primary button-full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}{busy ? "Saving…" : "Save profile"}</button></form>;
}

export function CreateEventForm({ onCreate }: { onCreate: (event: CampusEvent) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) || "").trim();
    try {
      const starts = new Date(value("starts_at"));
      const ends = new Date(value("ends_at"));
      const deadline = new Date(value("registration_deadline"));
      if (ends <= starts) throw new Error("The event must end after it starts.");
      if (deadline > starts) throw new Error("Registration must close before or at the event start.");
      onCreate(await post<CampusEvent>("/events", {
        title: value("title"), description: value("description"), venue: value("venue"), capacity: Number(value("capacity")),
        starts_at: starts.toISOString(), ends_at: ends.toISOString(), registration_deadline: deadline.toISOString(),
        classification: value("classification"), department_rules: list(value("department_rules")).map(item => item.toUpperCase()),
        program_rules: list(value("program_rules")).map(item => item.toUpperCase()), batch_rules: list(value("batch_rules")),
      }));
    } catch (error) { setError(error instanceof Error ? error.message : "The event couldn't be published."); }
    finally { setBusy(false); }
  }
  return <form className="form-stack" onSubmit={submit}><div className="inline-note"><Info size={18} /><span>This pilot publishes free, synthetic campus events immediately.</span></div><label className="field">Event title<input name="title" required minLength={3} maxLength={160} placeholder="Give your event a memorable name" /></label><label className="field">Description<textarea name="description" required minLength={10} maxLength={5000} rows={3} placeholder="What should attendees look forward to?" /></label><div className="form-row"><label className="field">Venue<input name="venue" required minLength={2} maxLength={160} placeholder="e.g. MP Hall, MNNIT" /></label><label className="field">Capacity<input name="capacity" type="number" required min={1} max={10000} placeholder="e.g. 120" /></label></div><label className="field">Event classification<select name="classification">{classifications.map(item => <option key={item}>{item}</option>)}</select></label><div className="form-row"><label className="field">Starts at<input name="starts_at" type="datetime-local" required /></label><label className="field">Ends at<input name="ends_at" type="datetime-local" required /></label></div><label className="field">Registration closes<input name="registration_deadline" type="datetime-local" required /></label><p className="muted text-small">Times use your device’s timezone and are stored with an explicit timezone.</p><details className="eligibility-details"><summary>Optional eligibility rules</summary><p className="muted text-small">Enter comma-separated values. Attendees must match every rule you configure. Leave all fields blank for an open event.</p><div className="form-row"><label className="field">Departments<input name="department_rules" placeholder="CSED, ECED" maxLength={500} /></label><label className="field">Programs<input name="program_rules" placeholder="B.TECH, M.TECH" maxLength={500} /></label></div><label className="field">Admission batches<input name="batch_rules" placeholder="2023, 2024" maxLength={200} /></label></details>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button button-primary button-full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}{busy ? "Publishing…" : "Publish event"}</button></form>;
}
