export const date = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
export const time = (value: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
export const fullDate = (value: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
export const roleLabel = (role: string) => ({ attendee: "Attendee", organizer: "Organizer", gate_staff: "Gate staff", admin: "Admin" }[role] || role);
export const list = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
