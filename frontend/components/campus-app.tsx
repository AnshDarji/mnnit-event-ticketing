"use client";

import Link from "next/link";
import { TeamFooter } from "@/components/team-footer";
import { Brand } from "@/components/brand";
import { LoadingIndicator } from "@/components/loading-indicator";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, Copy, GraduationCap, LayoutDashboard, LogOut, MapPin, Plus, QrCode, RefreshCw, ScanLine, Search, ShieldCheck, Sparkles, Ticket as TicketIcon, Users, X } from "lucide-react";
import { api, ApiError, post, saveToken, token } from "@/lib/api";
import type { CampusEvent, EventStats, Session, Ticket, User } from "@/lib/types";
import { date, fullDate, roleLabel, time } from "@/lib/format";
import { Modal } from "@/components/modal";
import { GoogleLogin } from "@/components/google-login";
import { CreateEventForm, ProfileForm } from "@/components/forms";
import { Scanner } from "@/components/scanner";

type Toast = { message: string; error?: boolean } | null;

export default function CampusApp({ tab }: { tab: "discover" | "tickets" | "manage" | "scan" }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [ticketsError, setTicketsError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All events");
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<Toast>(null);

  // Handle API errors centrally, including expired authentication sessions.
  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) { setUser(null); setTickets([]); setLoginOpen(true); }
    setToast({ message: error instanceof Error ? error.message : "Something went wrong. Try again.", error: true });
  }, []);

  // Fetch the latest event list from the backend.
  const refreshEvents = useCallback(async () => {
    setLoading(true); setEventsError("");
    try { const response = await api<{ items: CampusEvent[] }>("/events"); setEvents(response.items); }
    catch (error) { setEventsError(error instanceof Error ? error.message : "Events couldn't be loaded."); }
    finally { setLoading(false); }
  }, []);

  // Fetch tickets belonging to the currently signed-in user.
  const refreshTickets = useCallback(async () => {
    setTicketsLoading(true); setTicketsError("");
    try { const response = await api<{ items: Ticket[] }>("/tickets/me"); setTickets(response.items); }
    catch (error) { setTicketsError(error instanceof Error ? error.message : "Tickets couldn't be loaded."); handleError(error); }
    finally { setTicketsLoading(false); }
  }, [handleError]);

  // Restore the saved login session when the app starts.
  const restoreSession = useCallback(async () => {
    setAuthReady(false); setAuthError("");
    try { if (token()) setUser(await api<User>("/auth/me")); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) saveToken(null);
      else setAuthError(error instanceof Error ? error.message : "Your account could not be loaded. Please retry.");
    } finally { setAuthReady(true); }
  }, []);

  // Load events and restore authentication on mount.
  useEffect(() => { void refreshEvents(); void restoreSession(); }, [refreshEvents, restoreSession]);

  // Refresh tickets whenever the authenticated user changes.
  useEffect(() => { if (user) void refreshTickets(); }, [user?.id, refreshTickets]);

  // Automatically dismiss toast notifications after 6.5 seconds.
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 6500); return () => clearTimeout(timer); }, [toast]);

  // Save the session returned by a successful sign-in.
  const onSession = useCallback((session: Session) => {
    saveToken(session.access_token); setUser(session.user); setLoginOpen(false); setProfileOpen(false);
    setToast({ message: `Welcome, ${session.user.name.split(" ")[0]}. You are signed in.` });
  }, []);

  // Build the available category filters and filtered event list.
  const categories = useMemo(() => ["All events", ...Array.from(new Set(events.map(event => event.classification)))], [events]);
  const filteredEvents = useMemo(() => events.filter(event => (category === "All events" || event.classification === category) && `${event.title} ${event.description} ${event.venue}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [events, category, search]);

  const upcoming = events.filter(event => new Date(event.ends_at) > new Date());

  // Determine which features are allowed for the user's role.
  const canManage = user?.role === "organizer" || user?.role === "admin";
  const canScan = user?.role === "gate_staff" || user?.role === "admin" || user?.role === "organizer";
  const activeTickets = tickets.filter(ticket => ticket.status === "active");

  async function book(event: CampusEvent) {
    // Ask the user to sign in before creating a reservation.
    if (!user) { setSelectedEvent(null); setLoginOpen(true); return; }
    setBookingError(""); setBusy(`book-${event.id}`);
    try {
      const ticket = await post<Ticket>("/tickets/book", { event_id: event.id });
      // Update local tickets and open the newly created QR ticket.
      setTickets(previous => [ticket, ...previous.filter(item => item.id !== ticket.id)]); setSelectedEvent(null); setSelectedTicket(ticket);
      setToast({ message: "Reservation confirmed. Your QR ticket is ready." });
    } catch (error) { setBookingError(error instanceof Error ? error.message : "Reservation failed. Please try again."); handleError(error); }
    finally { setBusy(""); }
  }

  async function cancel(ticket: Ticket) {
    setBusy(`cancel-${ticket.id}`);
    try {
      const cancelled = await post<Ticket>(`/tickets/${ticket.id}/cancel`, {});
      // Replace the ticket with its updated cancelled state.
      setTickets(previous => previous.map(item => item.id === ticket.id ? cancelled : item)); setSelectedTicket(null); setCancelTarget(null);
      setToast({ message: "Ticket cancelled. Your seat has been released." });
    } catch (error) { handleError(error); }
    finally { setBusy(""); }
  }

  // Clear the local session and reset user-specific state.
  function logout() { saveToken(null); setUser(null); setTickets([]); setProfileOpen(false); setToast({ message: "You’ve signed out." }); }

  return <>
    <div className="pilot-banner"><ShieldCheck size={14} /><span>Coursework pilot</span><span>· Synthetic events · MNNIT Allahabad</span></div>
    <header className="site-header"><div className="header-inner"><Brand /><nav className="desktop-nav" aria-label="Primary navigation">{([{ key: "discover", href: "/dashboard", label: "Dashboard" }, { key: "tickets", href: "/tickets", label: "My tickets" }, ...(canManage ? [{ key: "manage", href: "/organize", label: "Organize" }] : []), ...(canScan ? [{ key: "scan", href: "/check-in", label: "Gate check-in" }] : [])]).map(item => <Link key={item.key} href={item.href} className={tab === item.key ? "nav-active" : ""} aria-current={tab === item.key ? "page" : undefined}>{item.label}{item.key === "tickets" && activeTickets.length > 0 && <span className="nav-count">{activeTickets.length}</span>}</Link>)}</nav><div className="header-actions">{user ? <button className="profile-button" onClick={() => setProfileOpen(true)}><span className="avatar avatar-small">{user.name.slice(0, 1)}</span><span className="profile-button-name">{user.name.split(" ")[0]}<small>{roleLabel(user.role)}</small></span></button> : <button className="button button-primary" onClick={() => setLoginOpen(true)} disabled={!authReady}>{authReady ? "Sign in" : "Loading…"}<ArrowRight size={16} /></button>}</div></div></header>
    <main className="main-container">
      {authError && <div className="session-error" role="alert"><span>{authError}</span><button className="text-button" onClick={restoreSession}>Retry account connection</button></div>}
      {tab === "discover" && <>
        <section className="dashboard-intro"><div><span className="section-kicker">EVENT WORKSPACE</span><h1>{user ? `Welcome, ${user.name.split(" ")[0]}` : "Campus dashboard"}</h1><p>Discover events, reserve your place and manage your tickets.</p></div><Link href="/tickets" className="button button-secondary"><TicketIcon size={17} />My tickets<ArrowRight size={16} /></Link></section><div className="dashboard-summary"><div><CalendarDays size={20} /><strong>{loading ? "—" : upcoming.length}</strong><span>Upcoming events</span></div><div><TicketIcon size={20} /><strong>{user && !ticketsLoading ? activeTickets.length : "—"}</strong><span>Your active reservations</span></div><div><ShieldCheck size={20} /><strong>Google</strong><span>Institute sign-in</span></div></div>
        <section className="events-section" id="events"><div className="section-heading"><div><div className="section-kicker"><CalendarDays size={15} /> EXPLORE & RESERVE</div><h2>Upcoming events<span className="heading-dot">.</span></h2></div><label className="search-box"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search events, venues…" aria-label="Search events" />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={16} /></button>}</label></div><div className="filters-row"><div className="category-tabs" aria-label="Event classifications">{categories.map(item => <button key={item} className={category === item ? "category-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><button className="icon-button" aria-label="Refresh events" disabled={loading} onClick={refreshEvents}><RefreshCw size={17} className={loading ? "spin" : ""} /></button></div>
          {loading ? <div className="event-grid">{[0, 1, 2].map(key => <div key={key} className="card-skeleton"><div /><span /><span /></div>)}</div> : eventsError ? <div className="empty-state"><CalendarDays size={35} /><h3>Campus services are taking a moment</h3><p>{eventsError}</p><button className="button button-secondary" onClick={refreshEvents}>Try again</button></div> : filteredEvents.length ? <div className="event-grid">{filteredEvents.map((event, index) => <EventCard key={event.id} event={event} index={index} onOpen={() => { setBookingError(""); setSelectedEvent(event); }} booked={activeTickets.some(ticket => ticket.event_id === event.id)} />)}</div> : <div className="empty-state"><Search size={35} /><h3>{search || category !== "All events" ? "No events match just yet" : "The calendar is waiting for its first event"}</h3><p>{search || category !== "All events" ? "Try another search or explore all classifications." : "Organizers can publish a synthetic event to get the pilot started."}</p>{(search || category !== "All events") && <button className="button button-secondary" onClick={() => { setSearch(""); setCategory("All events"); }}>Clear filters</button>}</div>}
        </section>
      </>}
      {tab === "tickets" && user && <section className="workspace-section"><div className="section-heading"><div><div className="section-kicker"><TicketIcon size={16} /> TICKET WALLET</div><h1>My tickets<span className="heading-dot">.</span></h1><p className="muted">View reservations, download QR tickets and manage cancellations.</p></div><button className="button button-secondary" disabled={ticketsLoading} onClick={refreshTickets}><RefreshCw size={16} className={ticketsLoading ? "spin" : ""} />Refresh</button></div>{ticketsLoading ? <div className="empty-state"><LoadingIndicator compact /><p>Finding your tickets…</p></div> : ticketsError ? <div className="empty-state"><TicketIcon size={35} /><h3>Your tickets couldn’t be loaded</h3><p>{ticketsError}</p><button className="button button-secondary" onClick={refreshTickets}>Try again</button></div> : tickets.length ? <div className="ticket-list">{tickets.map(ticket => <div key={ticket.id} className={`my-ticket ${ticket.status === "cancelled" ? "my-ticket-cancelled" : ""}`}><div className="ticket-date"><strong>{new Date(ticket.starts_at).toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" })}</strong><span>{new Date(ticket.starts_at).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</span></div><div className="ticket-info"><div className="ticket-status-line"><span className={`status-badge ${ticket.status === "cancelled" ? "status-cancelled" : ticket.checked_in_at ? "status-checked" : "status-active"}`}>{ticket.status === "cancelled" ? "Cancelled" : ticket.checked_in_at ? "Checked in" : "Ready to go"}</span><span className="muted text-small">FREE ADMISSION</span></div><h3>{ticket.event_title}</h3><div className="ticket-meta"><span><Clock3 size={15} />{time(ticket.starts_at)} IST</span><span><MapPin size={15} />{ticket.venue}</span></div></div><div className="ticket-actions">{ticket.status === "active" && <button className="button button-primary" onClick={() => setSelectedTicket(ticket)}><QrCode size={17} />View pass</button>}{ticket.status === "active" && !ticket.checked_in_at && <button className="text-button" disabled={busy === `cancel-${ticket.id}`} onClick={() => setCancelTarget(ticket)}>{busy === `cancel-${ticket.id}` ? "Cancelling…" : "Cancel ticket"}</button>}</div></div>)}</div> : <div className="empty-state"><TicketIcon size={42} /><h3>No reservations yet</h3><p>Reserve a seat at an event and your CampusPass will appear here.</p><button className="button button-primary" onClick={() => router.push("/dashboard")}>Find an event<ArrowRight size={16} /></button></div>}</section>}
      {tab !== "discover" && !user && <section className="workspace-section"><div className="empty-state"><ShieldCheck size={38} /><h1>{authReady ? "Sign in to your workspace" : "Restoring your session…"}</h1><p>Use your MNNIT Google account to access tickets and event tools.</p>{authReady && <button className="button button-primary" onClick={() => setLoginOpen(true)}>Sign in with Google<ArrowRight size={16} /></button>}</div></section>}
      {user && ((tab === "manage" && !canManage) || (tab === "scan" && !canScan)) && <section className="workspace-section"><div className="empty-state"><ShieldCheck size={38} /><h1>Choose the appropriate pilot role</h1><p>Update your campus profile to use organizer or gate staff tools.</p><button className="button button-primary" onClick={() => setProfileOpen(true)}>Update profile</button></div></section>}
      {tab === "manage" && user && canManage && <ManageEvents user={user} events={events} onCreate={() => setCreateOpen(true)} onError={handleError} />}
      {tab === "scan" && canScan && <section className="workspace-section"><div className="section-heading"><div><div className="section-kicker"><ScanLine size={16} /> ENTRY OPERATIONS</div><h1>Gate check-in<span className="heading-dot">.</span></h1><p className="muted">Validate tickets and record attendance for the selected event.</p></div><span className="pill"><ShieldCheck size={15} />Authorized gate access</span></div><Scanner onSessionExpired={handleError} key={events.map(event => event.id).join("-")} events={user?.role === "organizer" ? events.filter(event => event.organizer_id === user.id) : events} /></section>}
    </main>
    <footer className="site-footer"><div className="footer-overview"><div><span className="footer-brand"><TicketIcon size={19} />CampusPass</span><p>Event registration and ticket management for MNNIT.</p></div><div><span>CampusPass · Coursework pilot</span><small>Software Engineering Coursework Pilot · MNNIT Allahabad</small></div></div><TeamFooter /></footer>
    <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/dashboard" className={tab === "discover" ? "mobile-active" : ""}><CalendarDays size={21} />Dashboard</Link><Link href="/tickets" className={tab === "tickets" ? "mobile-active" : ""}><TicketIcon size={21} />My tickets</Link>{canManage && <Link href="/organize" className={tab === "manage" ? "mobile-active" : ""}><LayoutDashboard size={21} />Organize</Link>}{canScan && <Link href="/check-in" className={tab === "scan" ? "mobile-active" : ""}><ScanLine size={21} />Check-in</Link>}{user && <button onClick={() => setProfileOpen(true)}><GraduationCap size={21} />Profile</button>}</nav>
    {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.error ? <InfoIcon /> : <CheckCircle2 size={20} />}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={17} /></button></div>}
    {loginOpen && <Modal title="Welcome to CampusPass" onClose={() => setLoginOpen(false)}><GoogleLogin onSession={onSession} /></Modal>}
    {profileOpen && user && <Modal title="Your campus profile" onClose={() => setProfileOpen(false)}><ProfileForm user={user} onSave={session => { saveToken(session.access_token); setUser(session.user); setProfileOpen(false); setToast({ message: "Your profile has been updated." }); }} /><button className="sign-out" onClick={logout}><LogOut size={16} />Sign out</button></Modal>}
    {createOpen && <Modal title="Create event" wide onClose={() => setCreateOpen(false)}><CreateEventForm onCreate={event => { setEvents(previous => [event, ...previous]); setCreateOpen(false); setToast({ message: "Event published. Eligible attendees can now reserve seats." }); }} /></Modal>}
    {selectedEvent && <Modal title="Event details" wide onClose={() => setSelectedEvent(null)}><EventDetails event={selectedEvent} user={user} error={bookingError} ticket={activeTickets.find(ticket => ticket.event_id === selectedEvent.id)} busy={busy === `book-${selectedEvent.id}`} onBook={() => book(selectedEvent)} onTicket={ticket => { setSelectedEvent(null); setSelectedTicket(ticket); }} onProfile={() => { setSelectedEvent(null); setProfileOpen(true); }} /></Modal>}
    {cancelTarget && <Modal title="Cancel reservation" onClose={() => setCancelTarget(null)}><p>Cancel your ticket for <strong>{cancelTarget.event_title}</strong>? Your seat will become available to another attendee.</p>{toast?.error && <p className="form-error" role="alert">{toast.message}</p>}<div className="confirm-actions"><button className="button button-secondary" onClick={() => setCancelTarget(null)}>Keep ticket</button><button className="button button-primary" disabled={!!busy} onClick={() => cancel(cancelTarget)}>{busy ? "Cancelling…" : "Confirm cancellation"}</button></div></Modal>}
    {selectedTicket && <Modal title="Your CampusPass" onClose={() => setSelectedTicket(null)}><TicketDetails ticket={selectedTicket} onCopyError={handleError} /></Modal>}
  </>;
}

function InfoIcon() { return <ShieldCheck size={20} />; }

function EventArt({ event }: { event: CampusEvent; index?: number }) {
  // Render a consistent event banner using its category and start date.
  return <div className="event-art event-art-professional" aria-hidden="true"><span className="event-art-class">{event.classification}</span><CalendarDays size={44} strokeWidth={1.2} /><span className="event-art-caption">MNNIT ALLAHABAD · {date(event.starts_at)}</span></div>;
}

function EventCard({ event, index, onOpen, booked }: { event: CampusEvent; index: number; onOpen: () => void; booked: boolean }) {
  // Determine whether registration has passed its deadline.
  const closed = new Date(event.registration_deadline) < new Date();
  return <article className="event-card"><button className="event-art-button" onClick={onOpen} aria-label={`View ${event.title}`}><EventArt event={event} index={index} /><span className="art-date"><strong>{new Date(event.starts_at).toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" })}</strong><small>{new Date(event.starts_at).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</small></span></button><div className="event-card-body"><div className="event-card-top"><span className="classification">{event.classification}</span><span className="free-label">FREE</span></div><button className="event-title-button" onClick={onOpen}><h3>{event.title}</h3></button><p className="event-description">{event.description}</p><div className="event-meta"><span><MapPin size={15} />{event.venue}</span><span><Clock3 size={15} />{time(event.starts_at)} IST</span></div><div className="event-card-bottom"><span>{booked ? <><CheckCircle2 size={15} />You’re on the list</> : closed ? "Registration closed" : <><Users size={15} />{event.capacity} seats</>}</span><button onClick={onOpen}>View event<ArrowRight size={16} /></button></div></div></article>;
}

function EventDetails({ event, user, ticket, busy, error, onBook, onTicket, onProfile }: { event: CampusEvent; user: User | null; ticket?: Ticket; busy: boolean; onBook: () => void; onTicket: (ticket: Ticket) => void; onProfile: () => void; error?: string }) {
  // Determine registration status and evaluate the event's eligibility rules.
  const closed = new Date(event.registration_deadline) < new Date();
  const rules: [string, string[], string | null | undefined][] = [["Department", event.department_rules, user?.department], ["Program", event.program_rules, user?.program], ["Admission batch", event.batch_rules, user?.batch]];
  const configuredRules = rules.filter(([, values]) => values.length);

  // A user must match every configured rule to be eligible to book.
  const eligible = rules.every(([, values, actual]) => !values.length || !!actual && values.map(value => value.toUpperCase()).includes(actual.toUpperCase()));
  return <div className="event-detail"><EventArt event={event} /><div className="event-card-top"><span className="classification">{event.classification}</span><span className="free-label">FREE ADMISSION</span></div><h2>{event.title}</h2><p className="detail-description">{event.description}</p><div className="detail-info-grid"><div><CalendarDays size={20} /><span><strong>{fullDate(event.starts_at)}</strong><small>{time(event.starts_at)}–{time(event.ends_at)} IST</small></span></div><div><MapPin size={20} /><span><strong>{event.venue}</strong><small>MNNIT Allahabad</small></span></div><div><Users size={20} /><span><strong>{event.capacity} seats</strong><small>One ticket per attendee</small></span></div><div><Clock3 size={20} /><span><strong>Registration closes {date(event.registration_deadline)}</strong><small>{time(event.registration_deadline)} IST</small></span></div></div><div className="eligibility-box"><h3><ShieldCheck size={17} />Who can attend?</h3>{configuredRules.length ? <>{configuredRules.map(([label, values, actual]) => <p key={label}><strong>{label}</strong><span>{values.join(", ")}</span>{user && <span className={actual && values.map(value => value.toUpperCase()).includes(actual.toUpperCase()) ? "eligible-match" : "eligible-missing"}>{actual && values.map(value => value.toUpperCase()).includes(actual.toUpperCase()) ? "Matches" : "Update profile"}</span>}</p>)}{user && !eligible && <button className="text-button" onClick={onProfile}>Update your academic profile<ChevronRight size={15} /></button>}</> : <p>This event is open to the MNNIT community.</p>}</div><p className="organized-by">Organized by <strong>{event.organizer_name || "MNNIT organizer"}</strong>{event.is_synthetic && <span>· Synthetic pilot event</span>}</p>{error && <p className="form-error reservation-error" role="alert">{error}</p>}{busy && <p className="reservation-progress" role="status">Preparing your ticket. Free hosting may take a moment to start.</p>}{ticket ? <button className="button button-primary button-full" onClick={() => onTicket(ticket)}><QrCode size={18} />View your CampusPass</button> : <button className="button button-primary button-full" disabled={busy || closed || (!!user && !eligible)} onClick={onBook}>{busy ? <LoadingIndicator compact /> : <TicketIcon size={18} />}{busy ? "Reserving your seat…" : closed ? "Registration has closed" : !user ? "Sign in to reserve your seat" : !eligible ? "Check your eligibility to book" : "Reserve my seat · Free"}</button>}</div>;
}

function TicketDetails({ ticket, onCopyError }: { ticket: Ticket; onCopyError: (error: unknown) => void }) {
  const [copied, setCopied] = useState(false);

  // Copy the QR payload so it can be entered manually if needed.
  async function copy() {
    try {
      await navigator.clipboard.writeText(ticket.qr_payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopyError(new Error("Copy unavailable. Select the QR value below and copy it manually."));
    }
  }

  return <div className="qr-ticket"><span className={`status-badge ${ticket.checked_in_at ? "status-checked" : "status-active"}`}>{ticket.checked_in_at ? "Checked in" : "Ready for entry"}</span><h3>{ticket.event_title}</h3><p>{fullDate(ticket.starts_at)}<br />{time(ticket.starts_at)} IST · {ticket.venue}</p><div className="qr-image"><img src={ticket.qr_data_url} alt={`Signed QR ticket for ${ticket.event_title}`} width={260} height={260} /></div><strong className="qr-instruction">Present this QR code at the gate.</strong><p className="muted text-small">Show this code at the event gate. Keep your ticket private.</p><div className="qr-actions"><a className="button button-secondary" href={ticket.qr_data_url} download={`CampusPass-${ticket.id.slice(0, 8)}.svg`}><ArrowDownToLine size={16} />Save QR</a><button className="button button-secondary" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy value"}</button></div><details className="qr-value"><summary>Show QR value for manual entry</summary><textarea readOnly value={ticket.qr_payload} aria-label="Signed QR value" rows={3} onFocus={event => event.target.select()} /><small>Ticket #{ticket.id.slice(0, 8).toUpperCase()}</small></details></div>;
}

function ManageEvents({ user, events, onCreate, onError }: { user: User; events: CampusEvent[]; onCreate: () => void; onError: (error: unknown) => void }) {
  // Admins can manage all events; organizers can manage only their own.
  const mine = useMemo(() => events.filter(event => user.role === "admin" || event.organizer_id === user.id), [events, user.id, user.role]);
  const [stats, setStats] = useState<Record<string, EventStats>>({});
  const [pending, setPending] = useState(false);
  const [statsError, setStatsError] = useState("");

  const refresh = useCallback(async () => {
    setPending(true); setStatsError("");

    // Fetch each event's statistics concurrently; one failed request won't
    // prevent successful responses for the other events from being collected.
    const responses = await Promise.allSettled(mine.map(async event => [event.id, await api<EventStats>(`/tickets/events/${event.id}/stats`)] as const));
    const next: Record<string, EventStats> = {};
    responses.forEach(response => {
      if (response.status === "fulfilled") next[response.value[0]] = response.value[1];
      else {
        setStatsError(response.reason instanceof Error ? response.reason.message : "Some event counts are unavailable.");
        if (response.reason instanceof ApiError && response.reason.status === 401) onError(response.reason);
      }
    });
    setStats(next); setPending(false);
  }, [mine, onError]);

  // Refresh counts whenever the list of managed events changes.
  useEffect(() => { void refresh(); }, [refresh]);

  // Calculate combined registration and attendance totals.
  const totalRegistrations = Object.values(stats).reduce((sum, item) => sum + item.registrations, 0);
  const totalCheckIns = Object.values(stats).reduce((sum, item) => sum + item.check_ins, 0);

  return <section className="workspace-section"><div className="section-heading"><div><div className="section-kicker"><LayoutDashboard size={16} /> EVENT MANAGEMENT</div><h1>Organizer dashboard<span className="heading-dot">.</span></h1><p className="muted">Publish events and monitor registrations and attendance.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={18} />Create event</button></div><div className="stats-grid"><StatCard label={user.role === "admin" ? "Pilot events" : "Your events"} value={mine.length} icon={<CalendarDays size={23} />} /><StatCard label="Registrations" value={pending ? "…" : totalRegistrations} icon={<TicketIcon size={23} />} /><StatCard label="Checked in" value={pending ? "…" : totalCheckIns} icon={<ScanLine size={23} />} /><StatCard label="Attendance" value={pending ? "…" : `${totalRegistrations ? Math.round(totalCheckIns / totalRegistrations * 100) : 0}%`} icon={<Users size={23} />} /></div><div className="manage-list-head"><h2>{user.role === "admin" ? "All pilot events" : "Your events"}</h2><button className="text-button" onClick={refresh} disabled={pending}><RefreshCw size={15} className={pending ? "spin" : ""} />Refresh counts</button></div>{statsError && <p className="form-error" role="alert">{statsError}</p>}{mine.length ? <div className="manage-events">{mine.map(event => <article className="manage-event" key={event.id}><div className="manage-event-icon"><CalendarDays size={25} /></div><div className="manage-event-info"><span className="classification">{event.classification}</span><h3>{event.title}</h3><p>{date(event.starts_at)} · {time(event.starts_at)} IST · {event.venue}</p></div><div className="manage-event-numbers"><span><strong>{stats[event.id]?.registrations ?? "—"}<small> / {event.capacity}</small></strong>Registered</span><span><strong>{stats[event.id]?.check_ins ?? "—"}</strong>Checked in</span><span><strong>{stats[event.id]?.remaining ?? "—"}</strong>Seats left</span></div><div className="capacity-bar" aria-label={`${stats[event.id]?.registrations ?? 0} of ${event.capacity} seats booked`}><i style={{ width: `${Math.min(100, ((stats[event.id]?.registrations || 0) / event.capacity) * 100)}%` }} /></div></article>)}</div> : <div className="empty-state"><Sparkles size={40} /><h3>Create your first event</h3><p>Publish your first free event. Reservations and attendance will appear here.</p><button className="button button-primary" onClick={onCreate}><Plus size={17} />Create your first event</button></div>}</section>;
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  // Reusable summary card for organizer dashboard statistics.
  return <div className="stat-card"><span className="stat-icon">{icon}</span><strong>{value}</strong><span>{label}</span></div>;
}