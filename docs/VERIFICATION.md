# Pilot verification — 3 October 2026

Website: https://mnnit-event-ticketing.vercel.app

Source: https://github.com/AnshDarji/mnnit-event-ticketing

## Completed checks

- Local Pytest: 43 passed, one PostgreSQL-only concurrency case skipped locally.
- GitHub CI: backend suite against PostgreSQL 16 and frontend typecheck/build passed. The database suite includes eight simultaneous attempts for the final seat.
- Local service smoke test: event publication, booking, cancellation, rebooking with a new QR nonce, check-in, repeat-scan rejection, and counts passed.
- Local browser: demo sign-in, event discovery, booking, signed SVG QR display, role selection, manual gate check-in, and repeat-scan rejection passed.
- Public HTTPS health: Gateway, Auth, Events, and Ticketing returned 200.
- Public gateway and frontend `/api/events`: returned 200 with six seeded synthetic events and the live synthetic acceptance event.
- Direct Events API without gateway header: 403.
- Production demo identity endpoint: 404.
- Forged Google credential: 401.
- Anonymous booking: 401.
- Hosted PostgreSQL migrations and synthetic seed completed; events remained available after service redeploys.
- Real MNNIT Google sign-in succeeded for one approved Workspace account. Live organizer event publication, free reservation, QR ticket display, cancellation and rebooking succeeded.
- The rendered live SVG ticket and a screenshot of the displayed QR both decoded successfully using ZXing.
- Live wrong-event and forged QR submissions were rejected. A valid QR for Synthetic Pilot Acceptance Session recorded check-in at 11:00 am IST; its second submission was rejected as already checked in.
- Organizer counts showed one registration and one check-in for the acceptance event. Counts and ticket state remained available across page reloads. The earlier booking survived a service redeploy.
- The premium interface is deployed, with separate landing, dashboard, ticket wallet, organizer, gate and institute sign-in routes. The latest GitHub CI run passed against PostgreSQL 16 and completed the frontend typecheck/build.

## Remaining live acceptance

A second real MNNIT Workspace account and a physical phone-camera scan remain unverified. The successful live check-in used the actual signed QR payload through the scanner's manual-entry path. Last-seat contention, eligibility and duplicate reservation cases passed in the automated PostgreSQL suite; they have not all been repeated manually on the public website.

The booking failure was traced to placeholder Auth/Event URLs in the deployed Ticketing service. Those environment values were corrected, and the blueprint now declares the real public service URLs. Free services can still require a warm-up after inactivity; the UI shows pending and retry messages instead of silently failing.

The Render free database is scheduled to expire on **2 November 2026**, according to its dashboard. Before then, export and replace it or choose durable hosting. Keep synthetic event data and self-selected roles confined to the coursework pilot.

Deployment credentials are in ignored local configuration and hosting dashboards. They are excluded from Git and the source archive.
