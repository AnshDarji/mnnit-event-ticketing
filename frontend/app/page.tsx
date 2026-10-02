"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, Copy, GraduationCap, LayoutDashboard, LoaderCircle, LogOut, MapPin, Plus, QrCode, RefreshCw, ScanLine, Search, ShieldCheck, Sparkles, Ticket as TicketIcon, Users, X } from "lucide-react";
import { api, ApiError, post, saveToken, token } from "@/lib/api";
import type { CampusEvent, EventStats, Session, Ticket, User } from "@/lib/types";
import { date, fullDate, roleLabel, time } from "@/lib/format";
import { Modal } from "@/components/modal";
import { GoogleLogin } from "@/components/google-login";
import { CreateEventForm, ProfileForm } from "@/components/forms";
import { Scanner } from "@/components/scanner";

type Tab = "discover" | "tickets" | "manage" | "scan";
type Toast = { message: string; error?: boolean } | null;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [ticketsError, setTicketsError] = useState("");
  const [tab, setTab] = useState<Tab>("discover");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All events");
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<Toast>(null);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) { setUser(null); setTickets([]); setLoginOpen(true); setTab("discover"); }
    setToast({ message: error instanceof Error ? error.message : "Something went wrong. Try again.", error: true });
  }, []);
  const refreshEvents = useCallback(async () => {
    setLoading(true); setEventsError("");
    try { const response = await api<{ items: CampusEvent[] }>("/events"); setEvents(response.items); }
    catch (error) { setEventsError(error instanceof Error ? error.message : "Events couldn't be loaded."); }
    finally { setLoading(false); }
  }, []);
  const refreshTickets = useCallback(async () => {
    setTicketsLoading(true); setTicketsError("");
    try { const response = await api<{ items: Ticket[] }>("/tickets/me"); setTickets(response.items); }
    catch (error) { setTicketsError(error instanceof Error ? error.message : "Tickets couldn't be loaded."); handleError(error); }
    finally { setTicketsLoading(false); }
  }, [handleError]);
  useEffect(() => {
    void refreshEvents();
    if (token()) api<User>("/auth/me").then(setUser).catch(() => saveToken(null)).finally(() => setAuthReady(true));
    else setAuthReady(true);
  }, [refreshEvents]);
  useEffect(() => { if (user) void refreshTickets(); }, [user?.id, refreshTickets]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 6500); return () => clearTimeout(timer); }, [toast]);
  const onSession = useCallback((session: Session) => {
    saveToken(session.access_token); setUser(session.user); setLoginOpen(false); setProfileOpen(false); setTab("discover");
    setToast({ message: `Welcome, ${session.user.name.split(" ")[0]}. Your campus awaits.` });
  }, []);
  const categories = useMemo(() => ["All events", ...Array.from(new Set(events.map(event => event.classification)))], [events]);
  const filteredEvents = useMemo(() => events.filter(event => (category === "All events" || event.classification === category) && `${event.title} ${event.description} ${event.venue}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [events, category, search]);
  const upcoming = events.filter(event => new Date(event.ends_at) > new Date());
  const canManage = user?.role === "organizer" || user?.role === "admin";
  const canScan = user?.role === "gate_staff" || user?.role === "admin" || user?.role === "organizer";
  const activeTickets = tickets.filter(ticket => ticket.status === "active");
  async function book(event: CampusEvent) {
    if (!user) { setSelectedEvent(null); setLoginOpen(true); return; }
    setBusy(`book-${event.id}`);
    try {
      const ticket = await post<Ticket>("/tickets/book", { event_id: event.id });
      setTickets(previous => [ticket, ...previous.filter(item => item.id !== ticket.id)]); setSelectedEvent(null); setSelectedTicket(ticket);
      setToast({ message: "You’re on the list. Your CampusPass is ready!" });
    } catch (error) { handleError(error); }
    finally { setBusy(""); }
  }
  async function cancel(ticket: Ticket) {
    if (!window.confirm(`Cancel your ticket for ${ticket.event_title}? Your seat will become available to another attendee.`)) return;
    setBusy(`cancel-${ticket.id}`);
    try {
      const cancelled = await post<Ticket>(`/tickets/${ticket.id}/cancel`, {});
      setTickets(previous => previous.map(item => item.id === ticket.id ? cancelled : item)); setSelectedTicket(null);
      setToast({ message: "Ticket cancelled. Your seat has been released." });
    } catch (error) { handleError(error); }
    finally { setBusy(""); }
  }
  function logout() { saveToken(null); setUser(null); setTickets([]); setTab("discover"); setProfileOpen(false); setToast({ message: "You’ve signed out." }); }
  function navigate(next: Tab) { if (!user && next !== "discover") setLoginOpen(true); else setTab(next); }
  return <>
    <div className="pilot-banner"><Sparkles size={14} /><span>MNNIT coursework pilot</span><span className="banner-dot">·</span><span>Synthetic events. Real campus possibilities.</span></div>
    <header className="site-header"><div className="header-inner"><button className="brand" aria-label="CampusPass home" onClick={() => setTab("discover")}><span className="brand-mark"><TicketIcon size={23} /></span><span>Campus<span className="brand-pass">Pass</span><small>MNNIT ALLAHABAD</small></span></button><nav className="desktop-nav" aria-label="Primary navigation"><button className={tab === "discover" ? "nav-active" : ""} onClick={() => navigate("discover")}>Discover</button><button className={tab === "tickets" ? "nav-active" : ""} onClick={() => navigate("tickets")}>My tickets{activeTickets.length > 0 && <span className="nav-count">{activeTickets.length}</span>}</button>{canManage && <button className={tab === "manage" ? "nav-active" : ""} onClick={() => navigate("manage")}>Organize</button>}{canScan && <button className={tab === "scan" ? "nav-active" : ""} onClick={() => navigate("scan")}>Gate check-in</button>}</nav><div className="header-actions">{user ? <button className="profile-button" onClick={() => setProfileOpen(true)}><span className="avatar avatar-small">{user.name.slice(0, 1)}</span><span className="profile-button-name">{user.name.split(" ")[0]}<small>{roleLabel(user.role)}</small></span></button> : <button className="button button-primary" onClick={() => setLoginOpen(true)} disabled={!authReady}>{authReady ? "Sign in" : "Loading…"}<ArrowRight size={16} /></button>}</div></div></header>
    <main className="main-container">
      {tab === "discover" && <>
        <section className="hero"><div className="hero-copy"><div className="hero-eyebrow"><span className="status-dot" /> YOUR NEXT CAMPUS MEMORY</div><h1>Good things happen<br />when you <span>show up.</span></h1><p>Find your people, follow your curiosity, and make the most of life at MNNIT. Your next experience is a ticket away.</p><div className="hero-actions"><button className="button button-primary" onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}>Explore events<ArrowRight size={17} /></button><span className="hero-caption"><span className="mini-avatars"><i>A</i><i>M</i><i>S</i></span>Made for the MNNIT community</span></div><div className="hero-stats"><span><strong>{upcoming.length.toString().padStart(2, "0")}</strong>Upcoming experiences</span><span><strong>100%</strong>Free to attend</span><span><strong><ShieldCheck size={22} /></strong>Institute sign-in</span></div></div><div className="hero-visual" aria-hidden="true"><div className="visual-grid" /><span className="hero-sticker sticker-top"><Sparkles size={16} /> A LITTLE MORE CAMPUS LIFE</span><div className="illustration-orbit orbit-one" /><div className="illustration-orbit orbit-two" /><div className="hero-ticket"><div className="hero-ticket-top"><span className="ticket-wordmark">CampusPass</span><span className="mini-pill">ADMIT ONE</span></div><span className="ticket-super">THE BEST SEAT IS</span><h2>right<br />here.</h2><div className="ticket-dashed" /><div className="hero-ticket-bottom"><div><strong>MNNIT ALLAHABAD</strong><span>Come for the event.<br />Stay for the memories.</span></div><QrCode size={52} strokeWidth={1.7} /></div></div><span className="hero-sticker sticker-bottom"><CheckCircle2 size={17} /> Less waiting. More experiencing.</span><span className="hero-spark spark-one">✦</span><span className="hero-spark spark-two">✦</span></div></section>
        <section className="events-section" id="events"><div className="section-heading"><div><div className="section-kicker"><CalendarDays size={15} /> ON THE CAMPUS CALENDAR</div><h2>Find your next thing<span className="heading-dot">.</span></h2></div><label className="search-box"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search events, venues…" aria-label="Search events" />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={16} /></button>}</label></div><div className="filters-row"><div className="category-tabs" aria-label="Event classifications">{categories.map(item => <button key={item} className={category === item ? "category-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><button className="icon-button" aria-label="Refresh events" disabled={loading} onClick={refreshEvents}><RefreshCw size={17} className={loading ? "spin" : ""} /></button></div>
          {loading ? <div className="event-grid">{[0, 1, 2].map(key => <div key={key} className="card-skeleton"><div /><span /><span /></div>)}</div> : eventsError ? <div className="empty-state"><CalendarDays size={35} /><h3>Campus services are taking a moment</h3><p>{eventsError}</p><button className="button button-secondary" onClick={refreshEvents}>Try again</button></div> : filteredEvents.length ? <div className="event-grid">{filteredEvents.map((event, index) => <EventCard key={event.id} event={event} index={index} onOpen={() => setSelectedEvent(event)} booked={activeTickets.some(ticket => ticket.event_id === event.id)} />)}</div> : <div className="empty-state"><Search size={35} /><h3>{search || category !== "All events" ? "No events match just yet" : "The calendar is waiting for its first event"}</h3><p>{search || category !== "All events" ? "Try another search or explore all classifications." : "Organizers can publish a synthetic event to get the pilot started."}</p>{(search || category !== "All events") && <button className="button button-secondary" onClick={() => { setSearch(""); setCategory("All events"); }}>Clear filters</button>}</div>}
        </section><section className="how-it-works"><div><span className="section-kicker">LESS FRICTION. MORE FUN.</span><h3>From “I’m interested”<br />to “I’m here.”</h3></div><div className="how-step"><span>01</span><strong>Find your event</strong><p>Explore what’s happening<br />around your campus.</p></div><div className="how-step"><span>02</span><strong>Make it yours</strong><p>Sign in and reserve a seat.<br />Your QR ticket is ready.</p></div><div className="how-step"><span>03</span><strong>Show up & scan</strong><p>Flash your CampusPass<br />at the gate. You’re in.</p></div></section>
      </>}
      {tab === "tickets" && <section className="workspace-section"><div className="section-heading"><div><div className="section-kicker"><TicketIcon size={16} /> YOUR CAMPUS PLANS</div><h1>My tickets<span className="heading-dot">.</span></h1><p className="muted">A little anticipation, all in one place.</p></div><button className="button button-secondary" disabled={ticketsLoading} onClick={refreshTickets}><RefreshCw size={16} className={ticketsLoading ? "spin" : ""} />Refresh</button></div>{ticketsLoading ? <div className="empty-state"><LoaderCircle className="spin" size={30} /><p>Finding your tickets…</p></div> : ticketsError ? <div className="empty-state"><TicketIcon size={35} /><h3>Your tickets couldn’t be loaded</h3><p>{ticketsError}</p><button className="button button-secondary" onClick={refreshTickets}>Try again</button></div> : tickets.length ? <div className="ticket-list">{tickets.map(ticket => <div key={ticket.id} className={`my-ticket ${ticket.status === "cancelled" ? "my-ticket-cancelled" : ""}`}><div className="ticket-date"><strong>{new Date(ticket.starts_at).toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" })}</strong><span>{new Date(ticket.starts_at).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</span></div><div className="ticket-info"><div className="ticket-status-line"><span className={`status-badge ${ticket.status === "cancelled" ? "status-cancelled" : ticket.checked_in_at ? "status-checked" : "status-active"}`}>{ticket.status === "cancelled" ? "Cancelled" : ticket.checked_in_at ? "Checked in" : "Ready to go"}</span><span className="muted text-small">FREE ADMISSION</span></div><h3>{ticket.event_title}</h3><div className="ticket-meta"><span><Clock3 size={15} />{time(ticket.starts_at)} IST</span><span><MapPin size={15} />{ticket.venue}</span></div></div><div className="ticket-actions">{ticket.status === "active" && <button className="button button-primary" onClick={() => setSelectedTicket(ticket)}><QrCode size={17} />View pass</button>}{ticket.status === "active" && !ticket.checked_in_at && <button className="text-button" disabled={busy === `cancel-${ticket.id}`} onClick={() => cancel(ticket)}>{busy === `cancel-${ticket.id}` ? "Cancelling…" : "Cancel ticket"}</button>}</div></div>)}</div> : <div className="empty-state"><TicketIcon size={42} /><h3>Your next memory starts here</h3><p>Reserve a seat at an event and your CampusPass will appear here.</p><button className="button button-primary" onClick={() => setTab("discover")}>Find an event<ArrowRight size={16} /></button></div>}</section>}
      {tab === "manage" && user && canManage && <ManageEvents user={user} events={events} onCreate={() => setCreateOpen(true)} onError={handleError} />}
      {tab === "scan" && canScan && <section className="workspace-section"><div className="section-heading"><div><div className="section-kicker"><ScanLine size={16} /> WELCOME THEM IN</div><h1>Gate check-in<span className="heading-dot">.</span></h1><p className="muted">Verified entry. A smoother start for everyone.</p></div><span className="pill"><ShieldCheck size={15} />Authorized gate access</span></div><Scanner key={events.map(event => event.id).join("-")} events={user?.role === "organizer" ? events.filter(event => event.organizer_id === user.id) : events} /></section>}
    </main>
    <footer className="site-footer"><div><span className="footer-brand"><TicketIcon size={19} />CampusPass</span><p>A little closer to everything happening at MNNIT.</p></div><div><span>Built for campus. Made for people.</span><small>Software Engineering Coursework Pilot · MNNIT Allahabad</small></div></footer>
    <nav className="mobile-nav" aria-label="Mobile navigation"><button className={tab === "discover" ? "mobile-active" : ""} onClick={() => navigate("discover")}><CalendarDays size={21} />Discover</button><button className={tab === "tickets" ? "mobile-active" : ""} onClick={() => navigate("tickets")}><TicketIcon size={21} />My tickets</button>{canManage && <button className={tab === "manage" ? "mobile-active" : ""} onClick={() => navigate("manage")}><LayoutDashboard size={21} />Organize</button>}{canScan && <button className={tab === "scan" ? "mobile-active" : ""} onClick={() => navigate("scan")}><ScanLine size={21} />Check-in</button>}{user && <button onClick={() => setProfileOpen(true)}><GraduationCap size={21} />Profile</button>}</nav>
    {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.error ? <InfoIcon /> : <CheckCircle2 size={20} />}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={17} /></button></div>}
    {loginOpen && <Modal title="Welcome to CampusPass" onClose={() => setLoginOpen(false)}><GoogleLogin onSession={onSession} /></Modal>}
    {profileOpen && user && <Modal title="Your campus profile" onClose={() => setProfileOpen(false)}><ProfileForm user={user} onSave={session => { saveToken(session.access_token); setUser(session.user); setProfileOpen(false); setTab("discover"); setToast({ message: "Your profile has been updated." }); }} /><button className="sign-out" onClick={logout}><LogOut size={16} />Sign out</button></Modal>}
    {createOpen && <Modal title="Create a campus moment" wide onClose={() => setCreateOpen(false)}><CreateEventForm onCreate={event => { setEvents(previous => [event, ...previous]); setCreateOpen(false); setToast({ message: "Your event is live. Let the campus know!" }); }} /></Modal>}
    {selectedEvent && <Modal title="Your next experience" wide onClose={() => setSelectedEvent(null)}><EventDetails event={selectedEvent} user={user} ticket={activeTickets.find(ticket => ticket.event_id === selectedEvent.id)} busy={busy === `book-${selectedEvent.id}`} onBook={() => book(selectedEvent)} onTicket={ticket => { setSelectedEvent(null); setSelectedTicket(ticket); }} onProfile={() => { setSelectedEvent(null); setProfileOpen(true); }} /></Modal>}
    {selectedTicket && <Modal title="Your CampusPass" onClose={() => setSelectedTicket(null)}><TicketDetails ticket={selectedTicket} onCopyError={handleError} /></Modal>}
  </>;
}

function InfoIcon() { return <ShieldCheck size={20} />; }

function EventArt({ event, index = 0 }: { event: CampusEvent; index?: number }) {
  const palette = event.classification === "Departmental" ? "blue" : event.classification === "Club / Society" ? "purple" : event.classification === "Restricted" ? "coral" : ["green", "purple", "blue", "coral"][index % 4];
  return <div className={`event-art art-${palette}`} aria-hidden="true"><div className="art-grid" /><div className="art-orb orb-left" /><div className="art-orb orb-right" /><div className="art-symbol"><span>✦</span><i /><b /></div><span className="art-label">MNNIT CAMPUS / EXPERIENCES</span><span className="art-number">{String(index + 1).padStart(2, "0")}</span><div className="art-title">{event.title.split(" ").slice(0, 3).join(" ")}<span>COME BE A PART OF IT ↗</span></div></div>;
}

function EventCard({ event, index, onOpen, booked }: { event: CampusEvent; index: number; onOpen: () => void; booked: boolean }) {
  const closed = new Date(event.registration_deadline) < new Date();
  return <article className="event-card"><button className="event-art-button" onClick={onOpen} aria-label={`View ${event.title}`}><EventArt event={event} index={index} /><span className="art-date"><strong>{new Date(event.starts_at).toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" })}</strong><small>{new Date(event.starts_at).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</small></span></button><div className="event-card-body"><div className="event-card-top"><span className="classification">{event.classification}</span><span className="free-label">FREE</span></div><button className="event-title-button" onClick={onOpen}><h3>{event.title}</h3></button><p className="event-description">{event.description}</p><div className="event-meta"><span><MapPin size={15} />{event.venue}</span><span><Clock3 size={15} />{time(event.starts_at)} IST</span></div><div className="event-card-bottom"><span>{booked ? <><CheckCircle2 size={15} />You’re on the list</> : closed ? "Registration closed" : <><Users size={15} />{event.capacity} seats</>}</span><button onClick={onOpen}>View event<ArrowRight size={16} /></button></div></div></article>;
}

function EventDetails({ event, user, ticket, busy, onBook, onTicket, onProfile }: { event: CampusEvent; user: User | null; ticket?: Ticket; busy: boolean; onBook: () => void; onTicket: (ticket: Ticket) => void; onProfile: () => void }) {
  const closed = new Date(event.registration_deadline) < new Date();
  const rules: [string, string[], string | null | undefined][] = [["Department", event.department_rules, user?.department], ["Program", event.program_rules, user?.program], ["Admission batch", event.batch_rules, user?.batch]];
  const configuredRules = rules.filter(([, values]) => values.length);
  const eligible = rules.every(([, values, actual]) => !values.length || !!actual && values.map(value => value.toUpperCase()).includes(actual.toUpperCase()));
  return <div className="event-detail"><EventArt event={event} /><div className="event-card-top"><span className="classification">{event.classification}</span><span className="free-label">FREE ADMISSION</span></div><h2>{event.title}</h2><p className="detail-description">{event.description}</p><div className="detail-info-grid"><div><CalendarDays size={20} /><span><strong>{fullDate(event.starts_at)}</strong><small>{time(event.starts_at)}–{time(event.ends_at)} IST</small></span></div><div><MapPin size={20} /><span><strong>{event.venue}</strong><small>MNNIT Allahabad</small></span></div><div><Users size={20} /><span><strong>{event.capacity} seats</strong><small>One ticket per attendee</small></span></div><div><Clock3 size={20} /><span><strong>Registration closes {date(event.registration_deadline)}</strong><small>{time(event.registration_deadline)} IST</small></span></div></div><div className="eligibility-box"><h3><ShieldCheck size={17} />Who can attend?</h3>{configuredRules.length ? <>{configuredRules.map(([label, values, actual]) => <p key={label}><strong>{label}</strong><span>{values.join(", ")}</span>{user && <span className={actual && values.map(value => value.toUpperCase()).includes(actual.toUpperCase()) ? "eligible-match" : "eligible-missing"}>{actual && values.map(value => value.toUpperCase()).includes(actual.toUpperCase()) ? "Matches" : "Update profile"}</span>}</p>)}{user && !eligible && <button className="text-button" onClick={onProfile}>Update your academic profile<ChevronRight size={15} /></button>}</> : <p>This event is open to the MNNIT community.</p>}</div><p className="organized-by">Organized by <strong>{event.organizer_name || "MNNIT organizer"}</strong>{event.is_synthetic && <span>· Synthetic pilot event</span>}</p>{ticket ? <button className="button button-primary button-full" onClick={() => onTicket(ticket)}><QrCode size={18} />View your CampusPass</button> : <button className="button button-primary button-full" disabled={busy || closed || (!!user && !eligible)} onClick={onBook}>{busy ? <LoaderCircle className="spin" size={18} /> : <TicketIcon size={18} />}{busy ? "Reserving your seat…" : closed ? "Registration has closed" : !user ? "Sign in to reserve your seat" : !eligible ? "Check your eligibility to book" : "Reserve my seat · Free"}</button>}</div>;
}

function TicketDetails({ ticket, onCopyError }: { ticket: Ticket; onCopyError: (error: unknown) => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(ticket.qr_payload); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { onCopyError(new Error("Copy unavailable. Select the QR value below and copy it manually.")); } }
  return <div className="qr-ticket"><span className={`status-badge ${ticket.checked_in_at ? "status-checked" : "status-active"}`}>{ticket.checked_in_at ? "Checked in" : "Ready for entry"}</span><h3>{ticket.event_title}</h3><p>{fullDate(ticket.starts_at)}<br />{time(ticket.starts_at)} IST · {ticket.venue}</p><div className="qr-image"><img src={ticket.qr_data_url} alt={`Signed QR ticket for ${ticket.event_title}`} width={260} height={260} /></div><strong className="qr-instruction">Your seat, one scan away.</strong><p className="muted text-small">Show this code at the event gate. Keep your ticket private.</p><div className="qr-actions"><a className="button button-secondary" href={ticket.qr_data_url} download={`CampusPass-${ticket.id.slice(0, 8)}.svg`}><ArrowDownToLine size={16} />Save QR</a><button className="button button-secondary" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy value"}</button></div><details className="qr-value"><summary>Show QR value for manual entry</summary><textarea readOnly value={ticket.qr_payload} aria-label="Signed QR value" rows={3} onFocus={event => event.target.select()} /><small>Ticket #{ticket.id.slice(0, 8).toUpperCase()}</small></details></div>;
}

function ManageEvents({ user, events, onCreate, onError }: { user: User; events: CampusEvent[]; onCreate: () => void; onError: (error: unknown) => void }) {
  const mine = useMemo(() => events.filter(event => user.role === "admin" || event.organizer_id === user.id), [events, user.id, user.role]);
  const [stats, setStats] = useState<Record<string, EventStats>>({});
  const [pending, setPending] = useState(false);
  const [statsError, setStatsError] = useState("");
  const refresh = useCallback(async () => {
    setPending(true); setStatsError("");
    const responses = await Promise.allSettled(mine.map(async event => [event.id, await api<EventStats>(`/tickets/events/${event.id}/stats`)] as const));
    const next: Record<string, EventStats> = {};
    responses.forEach(response => { if (response.status === "fulfilled") next[response.value[0]] = response.value[1]; else { setStatsError(response.reason instanceof Error ? response.reason.message : "Some event counts are unavailable."); if (response.reason instanceof ApiError && response.reason.status === 401) onError(response.reason); } });
    setStats(next); setPending(false);
  }, [mine, onError]);
  useEffect(() => { void refresh(); }, [refresh]);
  const totalRegistrations = Object.values(stats).reduce((sum, item) => sum + item.registrations, 0);
  const totalCheckIns = Object.values(stats).reduce((sum, item) => sum + item.check_ins, 0);
  return <section className="workspace-section"><div className="section-heading"><div><div className="section-kicker"><LayoutDashboard size={16} /> MAKE SOMETHING HAPPEN</div><h1>Organizer studio<span className="heading-dot">.</span></h1><p className="muted">Publish your next idea. See who shows up.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={18} />Create event</button></div><div className="stats-grid"><StatCard label={user.role === "admin" ? "Pilot events" : "Your events"} value={mine.length} icon={<CalendarDays size={23} />} /><StatCard label="Registrations" value={pending ? "…" : totalRegistrations} icon={<TicketIcon size={23} />} /><StatCard label="Checked in" value={pending ? "…" : totalCheckIns} icon={<ScanLine size={23} />} /><StatCard label="Attendance" value={pending ? "…" : `${totalRegistrations ? Math.round(totalCheckIns / totalRegistrations * 100) : 0}%`} icon={<Users size={23} />} /></div><div className="manage-list-head"><h2>{user.role === "admin" ? "All pilot events" : "Your events"}</h2><button className="text-button" onClick={refresh} disabled={pending}><RefreshCw size={15} className={pending ? "spin" : ""} />Refresh counts</button></div>{statsError && <p className="form-error" role="alert">{statsError}</p>}{mine.length ? <div className="manage-events">{mine.map(event => <article className="manage-event" key={event.id}><div className="manage-event-icon"><CalendarDays size={25} /></div><div className="manage-event-info"><span className="classification">{event.classification}</span><h3>{event.title}</h3><p>{date(event.starts_at)} · {time(event.starts_at)} IST · {event.venue}</p></div><div className="manage-event-numbers"><span><strong>{stats[event.id]?.registrations ?? "—"}<small> / {event.capacity}</small></strong>Registered</span><span><strong>{stats[event.id]?.check_ins ?? "—"}</strong>Checked in</span><span><strong>{stats[event.id]?.remaining ?? "—"}</strong>Seats left</span></div><div className="capacity-bar" aria-label={`${stats[event.id]?.registrations ?? 0} of ${event.capacity} seats booked`}><i style={{ width: `${Math.min(100, ((stats[event.id]?.registrations || 0) / event.capacity) * 100)}%` }} /></div></article>)}</div> : <div className="empty-state"><Sparkles size={40} /><h3>Turn an idea into a campus moment</h3><p>Publish your first free event. Reservations and attendance will appear here.</p><button className="button button-primary" onClick={onCreate}><Plus size={17} />Create your first event</button></div>}</section>;
}
function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) { return <div className="stat-card"><span className="stat-icon">{icon}</span><strong>{value}</strong><span>{label}</span></div>; }
