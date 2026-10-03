# CampusPass — MNNIT Event Ticketing Platform

<p align="center"><img src="frontend/public/mnnit-logo.png" alt="MNNIT Allahabad emblem" width="100" /></p>

**Discover campus events. Reserve a free seat. Arrive with a verified QR ticket.**

CampusPass is a deployed Software Engineering coursework pilot for MNNIT Allahabad. It connects institute Google sign-in, event publication, eligibility checks, seat reservations, digital tickets and gate check-in through a responsive web interface and separate backend services.

[Live website](https://mnnit-event-ticketing.vercel.app/) · [Source repository](https://github.com/AnshDarji/mnnit-event-ticketing) · [Deployment guide](docs/DEPLOYMENT.md) · [Verification record](docs/VERIFICATION.md)

[![Pilot checks](https://github.com/AnshDarji/mnnit-event-ticketing/actions/workflows/ci.yml/badge.svg)](https://github.com/AnshDarji/mnnit-event-ticketing/actions/workflows/ci.yml)

> **Current scope:** a public coursework demonstration using synthetic events and free admission. Roles and academic fields are self-selected and editable in this pilot. It is not an institute-authorized production access-control system.

## Contents

- [Project overview](#project-overview)
- [Features and roles](#features-and-roles)
- [Requirements and acceptance criteria](#requirements-and-acceptance-criteria)
- [Architecture and data model](#architecture-and-data-model)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [Database and sample data](#database-and-sample-data)
- [API reference](#api-reference)
- [Testing and verified progress](#testing-and-verified-progress)
- [Deployment and operation](#deployment-and-operation)
- [Mid-semester evaluation alignment](#mid-semester-evaluation-alignment)
- [Remaining work](#remaining-work)
- [AI assistance and attribution](#ai-assistance-and-attribution)

## Project overview

### Problem and motivation

Campus event registration connects several tasks: communicating event details, checking eligibility, keeping registrations within capacity, issuing passes and recording attendance. A disconnected workflow makes it harder to maintain a consistent registration list and verify tickets at the gate.

CampusPass provides one workflow for these tasks. The pilot demonstrates the proposed solution with synthetic events rather than claiming adoption by the institute.

### Objectives

1. Authenticate participants through MNNIT Google Workspace accounts.
2. Let organizers publish events with schedules, capacity and eligibility rules.
3. Prevent duplicate active reservations and overselling of the final seat.
4. Issue signed QR tickets and release capacity on cancellation.
5. Verify the correct event and record each check-in once.
6. Provide reproducible implementation and testing evidence for evaluation.

### Stakeholders

| Stakeholder | Need |
| --- | --- |
| Attendees | Discover events, understand eligibility and manage reservations |
| Organizers | Publish events and follow registration and attendance counts |
| Gate staff | Validate entry passes and reject invalid or reused tickets |
| Pilot administrators | Explore event operations across the coursework pilot |
| Project group and evaluator | Reproduce the system, inspect its design and verify progress |

Payments, event approval, waitlists, certificates, exports and detailed analytics are outside the current implementation.

## Features and roles

### Implemented features

| Area | Capability |
| --- | --- |
| Identity | Server-verified Google sign-in restricted to verified `@mnnit.ac.in` accounts with the matching Workspace `hd` claim |
| Profile | Editable role, department, program and admission batch |
| Discovery | Public event listings, search, classification filters and event details |
| Publication | Free synthetic events with venue, capacity, dates, registration deadline and academic rules |
| Reservations | Transactional capacity allocation, duplicate prevention and server-enforced eligibility |
| Ticket wallet | Signed QR display/download, payload copying and reservation status |
| Cancellation | Owner-only cancellation before check-in; seat released in the same transaction |
| Gate entry | Phone-oriented camera scanner and manual signed-QR entry |
| Validation | Forged, wrong-event, cancelled, superseded and repeated tickets rejected |
| Event counts | Registrations, check-ins, remaining seats and attendance percentage |
| Interface | Separate landing/workspace pages, responsive layouts, loading indicators and visible errors |

### Role behavior

| Role | Main workflow |
| --- | --- |
| Attendee | Discover events, complete academic details, reserve and manage their own tickets |
| Organizer | Publish events, view their event dashboard and check in their own events |
| Gate staff | Validate tickets for the selected event |
| Admin | Publish events, view the dashboard across pilot events and perform gate check-in |

All signed-in roles can reserve seats and use their own ticket wallet. The pilot does **not** implement administrator-managed user provisioning, event approval or permanent role locking. Role changes remain available in profile settings. Controlled privileged-role assignment is needed before real institute use.

### Website routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page, MNNIT emblem and interactive journey preview |
| `/sign-in` | Dedicated institute Google sign-in page |
| `/dashboard` | Event discovery, details and reservations |
| `/tickets` | Personal ticket wallet and cancellation |
| `/organize` | Organizer/admin publication and counts |
| `/check-in` | Camera scanner and manual ticket verification |

The landing preview is illustrative, not a real reservation. Sessions persist within the same browser tab using `sessionStorage`. Application JWTs expire after two hours; users sign in again when their session expires.

<details>
<summary>Current landing page</summary>

![CampusPass landing page with centered hero and transparent MNNIT emblem](docs/current-home.png)

</details>

See the [screenshot catalogue](docs/SCREENSHOTS.md) for current and historical evidence.

## Requirements and acceptance criteria

### Prioritized functional requirements

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-01 | Institute identity verification and application session | Must | Implemented |
| FR-02 | Public discovery and event details | Must | Implemented |
| FR-03 | Organizer event publication | Must | Implemented |
| FR-04 | Eligibility, deadlines, duplicate prevention and capacity enforcement | Must | Implemented |
| FR-05 | Signed ticket issuance and ticket wallet | Must | Implemented |
| FR-06 | Cancellation that releases capacity | Must | Implemented |
| FR-07 | Single-use check-in and invalid-ticket rejection | Must | Implemented; physical camera acceptance pending |
| FR-08 | Registration and attendance counts | Should | Implemented |
| FR-09 | Controlled roles and verified academic attributes | Before real rollout | Pending |
| FR-10 | Waitlists, certificates, exports and detailed analytics | Could | Deferred |

### User stories

| User story | Acceptance criteria |
| --- | --- |
| As an attendee, I want to reserve an eligible event. | A valid session and matching profile produce one active reservation and signed QR; ineligible, late, duplicate and full-event attempts fail. |
| As an attendee, I want to cancel when plans change. | Only the owner can cancel before check-in; successful cancellation frees a seat and invalidates its QR. |
| As an organizer, I want to publish an event. | Valid details, positive capacity and timezone-aware future registration dates produce a publicly listed synthetic event. |
| As gate staff, I want to validate an entry pass. | Signature, event, nonce and stored state are checked; valid entry is recorded once and reuse is rejected. |
| As an organizer, I want accurate event counts. | Active reservations, check-ins and remaining capacity reflect completed operations. |

### Non-functional requirements

- **Integrity:** transactional inventory/reservation changes and database constraints; PostgreSQL contention is tested explicitly.
- **Security:** server-verified Google identity, JWT-protected actions and authenticated service calls. QR payloads contain identifiers and a nonce, not attendee names or emails.
- **Usability:** responsive pages, visible pending/error states and a manual scanner fallback.
- **Maintainability:** service boundaries, configuration templates, versioned migrations and CI checks.
- **Persistence:** deployment data lives in PostgreSQL rather than an API container's filesystem.
- **Availability:** free hosting can sleep or become unavailable. No uptime, throughput or production-load guarantee has been established.

## Architecture and data model

### Request flow

```mermaid
flowchart LR
  B[Browser] -->|same-origin /api| F[Next.js on Vercel]
  F --> G[FastAPI Gateway]
  G --> A[Auth Service]
  G --> E[Event Service]
  G --> T[Ticketing Service]
  E -->|organizer lookup| A
  T -->|profile lookup| A
  T -->|event lookup| E
  A --> DA[(auth schema)]
  E --> DE[(events schema)]
  T --> DT[(ticketing schema)]
```

The three service-owned schemas share one PostgreSQL instance. Services run independently and migrate their own schemas; there is not a separate database server for every service.

| Component | Responsibility |
| --- | --- |
| Gateway | Routing, bearer-token forwarding, in-memory rate limits and gateway-secret injection |
| Auth | Google verification, application JWTs and user profiles |
| Events | Publication, schedules, organizers and eligibility rules |
| Ticketing | Seat allocation, QR signing, cancellation, check-in and counts |

### Booking and entry

1. Auth verifies the Google credential and issues an application JWT.
2. Ticketing retrieves the selected event and current profile through protected service calls.
3. It checks the registration window and every configured department/program/batch rule.
4. A conditional inventory update reserves capacity within the booking transaction. A unique attendee/event constraint prevents duplicate booking records.
5. Ticket ID, event ID and nonce form an HMAC-SHA256-signed QR payload.
6. Gate entry verifies the signature and persisted ticket state, then conditionally records attendance once.

Rebooking a cancelled reservation reuses its attendee/event record with a new nonce, invalidating the old QR. Counts include active reservations only.

### Stored entities

| Schema/table | Main fields | Integrity rules |
| --- | --- | --- |
| `auth.users` | ID, Google subject, email, name, picture, role, department, program, batch | Unique Google subject and email |
| `events.events` | ID, title, description, venue, capacity, schedule, deadline, classification, rules, organizer, synthetic flag | Positive capacity; application validation of dates/rules |
| `ticketing.inventory` | Event ID, capacity, booked count | One row per event; `0 <= booked <= capacity` |
| `ticketing.bookings` | ID, event/user IDs, attendee/event snapshot, nonce, status, check-in time and checker | Unique `(event_id, user_id)`; transactional state updates |

User/event identifiers connect these entities logically. Cross-service relationships use service calls rather than database foreign keys between schemas. Booking snapshots retain the event title, venue and attendee name used when issued.

## Technology stack

| Technology | Purpose and rationale |
| --- | --- |
| Next.js 16, React 19, TypeScript | Routed frontend, typed models and same-origin API forwarding |
| Tailwind CSS 4 and custom CSS | Responsive styling and ivory/ink/rust visual design |
| Google Identity Services | Institute identity without managing passwords or an email sender |
| FastAPI and Pydantic | API services, request validation and development OpenAPI documentation |
| SQLAlchemy and Psycopg | Relational models and PostgreSQL transactions |
| PostgreSQL 16 | Production persistence, constraints and concurrent seat allocation |
| SQLite | Lightweight preview/functional tests; not PostgreSQL concurrency verification |
| PyJWT, HMAC-SHA256 and `qrcode` | Sessions and signed SVG tickets |
| ZXing browser library | Camera QR decoding |
| Docker Compose | Reproducible local services and PostgreSQL |
| Pytest and GitHub Actions | API integration tests, contention tests, type checking and builds |
| Vercel and Render | Frontend and independent backend/database hosting |

Exact frontend versions are in [`frontend/package-lock.json`](frontend/package-lock.json). Backend dependencies and supported ranges are in [`backend/requirements.txt`](backend/requirements.txt).

## Repository structure

```text
.
├── backend/
│   ├── auth/                 # Google sign-in and profiles
│   ├── events/               # Publication and discovery
│   ├── ticketing/            # Booking, QR, cancellation and check-in
│   ├── gateway/              # API routing and limits
│   ├── common/               # Configuration, models and helpers
│   └── requirements.txt
├── frontend/
│   ├── app/                  # Website routes and styles
│   ├── components/           # Forms, workspace and scanner
│   ├── lib/                  # API client, types and formatting
│   └── public/               # MNNIT logo assets
├── migrations/               # Versioned SQL per service
├── scripts/                  # Launcher, migrations, seed and smoke test
├── tests/                    # Auth, events, ticketing and gateway tests
├── infra/Dockerfile.backend
├── docs/                     # Deployment, verification and screenshots
├── .github/workflows/ci.yml
├── .env.example
├── docker-compose.yml
└── render.yaml
```

## Run locally

### Prerequisites

- Git and access to this repository.
- Python **3.12 or newer**; CI uses Python 3.12.
- Node.js **22 or newer**, with npm.
- Docker Desktop with Linux containers, only for the Compose option.
- A configured Google web client and permitted MNNIT account, only for real institute sign-in.

Clone the repository, then run commands from its root:

```bash
git clone https://github.com/AnshDarji/mnnit-event-ticketing.git
cd mnnit-event-ticketing
```

### Option A — quick synthetic demo

This starts the complete application with SQLite and local synthetic identities. Google configuration is not required.

**Windows / PowerShell**

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt
npm.cmd --prefix frontend ci
.\.venv\Scripts\python -m scripts.dev --demo
```

**macOS / Linux**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
.venv/bin/python -m scripts.dev --demo
```

Open **[http://localhost:3000](http://localhost:3000)**. The launcher creates tables, seeds six events and starts four APIs plus the frontend. Press `Ctrl+C` to stop it. Local data remains in ignored `pilot.db`.

For real Google sign-in, copy `.env.example` to `.env`, set `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the same web client, authorize the localhost origin and run the launcher **without `--demo`**. The launcher disables its demo switches in that mode. `--backend-only` starts just the APIs.

### Option B — PostgreSQL with Docker Compose

1. Copy `.env.example` to `.env`: `Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` in Bash.
2. Generate a different value for each of `POSTGRES_PASSWORD`, `JWT_SECRET`, `QR_SECRET` and `INTERNAL_SECRET`:

   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

3. Replace the template values locally. Match the password in `POSTGRES_PASSWORD` and the host-side `DATABASE_URL`. Hexadecimal passwords avoid URL-escaping issues. Keep `.env` out of Git.
4. Start and seed:

   ```bash
   docker compose up --build -d
   docker compose exec events python -m scripts.seed
   docker compose ps
   ```

Open **[http://localhost:3000](http://localhost:3000)**. Compose applies migrations and waits for backend health checks. Default demo configuration uses synthetic identities. For Google sign-in, set both demo flags to `false`, provide the Google client ID and rebuild the frontend.

```bash
docker compose logs -f gateway ticketing
docker compose down
```

`docker compose down` preserves the database volume. Editing `.env` does not change the password of an already-initialized volume. Do not remove that volume if its data is needed.

### Local endpoints

| Endpoint | Purpose |
| --- | --- |
| `http://localhost:3000` | Website; same-origin `/api` calls |
| `http://localhost:8000` | Gateway |
| `http://localhost:8001/docs` | Auth OpenAPI in development |
| `http://localhost:8002/docs` | Events OpenAPI in development |
| `http://localhost:8003/docs` | Ticketing OpenAPI in development |
| `localhost:5432` | PostgreSQL in Compose |

Each backend exposes `/health`. Auth/Events/Ticketing also check database connectivity. Gateway health does not prove all upstream services are ready.

## Configuration

Templates: [`.env.example`](.env.example) and [`frontend/.env.example`](frontend/.env.example).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Backend database connection; PostgreSQL in deployment |
| `POSTGRES_PASSWORD` | Compose database password |
| `JWT_SECRET` | Application JWT signing |
| `QR_SECRET` | Independent QR signing secret |
| `INTERNAL_SECRET` | Independent gateway/internal-service secret |
| `GOOGLE_CLIENT_ID` | Backend Google token audience |
| `AUTH_SERVICE_URL` | Auth address for dependent services |
| `EVENT_SERVICE_URL` | Events address for Gateway/Ticketing |
| `TICKETING_SERVICE_URL` | Ticketing address for Gateway |
| `ENVIRONMENT` | `development` locally; `production` on Render |
| `DEMO_AUTH_ENABLED` | Synthetic identity endpoint; `false` in production |
| `PILOT_ROLE_SELECTION` | Allows role changes in the coursework pilot |
| `GATEWAY_URL` | Next.js server-side rewrite destination |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Public browser client ID, matching backend audience |
| `NEXT_PUBLIC_DEMO_MODE` | Shows demo access; `false` on Vercel |

Backend secrets must be distinct, at least 32 characters in production, and consistent across dependent services. Never put secrets in `NEXT_PUBLIC_` variables. Google client IDs are public configuration; this callback-based sign-in does not require a client secret.

Frontend rewrite/public values are build-time configuration; rebuild/redeploy after changing them. See the [deployment environment mapping](docs/DEPLOYMENT.md#3-render-apis-and-database).

## Database and sample data

PostgreSQL migrations record applied SQL files and take a per-service advisory lock to prevent conflicting migration runs.

```bash
python -m scripts.migrate
python -m scripts.migrate --service auth
python -m scripts.seed
```

Use the virtual-environment Python path if it is not activated. Seeding inserts missing synthetic events without overwriting existing events or creating real accounts. Dates are relative to the **first seed run** and do not advance on later runs.

| Seeded event | Classification | Capacity | Academic restrictions |
| --- | --- | --- | --- |
| Build Night: ideas into prototypes | Club / Society | 80 | None |
| The AI & robotics lab | Institute-level | 120 | None |
| Designing systems that scale | Departmental | 60 | `CSED`; `B.TECH` or `M.TECH` or `MCA` |
| Unplugged: an evening on campus | Open / Cross-department | 200 | None |
| Career conversations | Institute-level | 150 | None |
| Make it move: engineering challenge | Open / Cross-department | 48 | None |

Additional synthetic acceptance records on the public site were created during live verification; they are not part of the six-event seed fixture.

## API reference

Call the gateway directly, or prefix these paths with `/api` on the website origin. Protected requests use `Authorization: Bearer <application-token>`.

| Method | Path | Access / result |
| --- | --- | --- |
| `POST` | `/auth/google` | Verify Google credential; return application session |
| `GET` | `/auth/me` | Current authenticated profile |
| `PUT` | `/auth/me` | Update profile/permitted pilot role; return refreshed session |
| `POST` | `/auth/demo` | Explicit development-only synthetic sign-in |
| `GET` | `/events` | Public listings; supports `q` and `classification` |
| `GET` | `/events/{event_id}` | Public details |
| `POST` | `/events` | Organizer/admin publication |
| `POST` | `/tickets/book` | Reserve `event_id`; return signed ticket |
| `GET` | `/tickets/me` | Current user's tickets |
| `POST` | `/tickets/{ticket_id}/cancel` | Owner-only cancellation before check-in |
| `GET` | `/tickets/events/{event_id}/stats` | Counts for authenticated users; no attendee list |
| `POST` | `/tickets/check-in` | Gate staff/admin or organizer of that event; accepts `event_id` and `qr_payload` |

Common failures: `401` missing/expired session, `403` role/eligibility rejection, `400` invalid QR, `409` duplicate/full/closed reservation or invalid ticket state, `422` invalid input and `503` unavailable upstream. Rebooking-invalidated QR values also return `400`.

Direct production Auth/Event/Ticketing requests require the gateway header. Internal service routes have their own header check and are not browser-facing interfaces.

## Testing and verified progress

### Run automated checks

**Windows / PowerShell**

```powershell
.\.venv\Scripts\python -m pytest tests -q
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
```

**macOS / Linux**

```bash
.venv/bin/python -m pytest tests -q
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Recorded local backend result: **43 passed, 1 skipped**. SQLite handles functional tests; the skipped final-seat contention case requires PostgreSQL.

Set `TEST_POSTGRES_URL` to a **dedicated test database** to include contention. Fixtures create isolated temporary schemas and remove them after testing. Do not use the pilot database.

```powershell
$env:TEST_POSTGRES_URL = 'postgresql+psycopg://test_user:test_password@localhost:5432/mnnit_test'
.\.venv\Scripts\python -m pytest tests -q
```

In Bash, use `export TEST_POSTGRES_URL='postgresql+psycopg://test_user:test_password@localhost:5432/mnnit_test'`. These credentials are illustrative placeholders.

GitHub Actions runs backend tests against PostgreSQL 16, including eight competing requests for one seat, plus frontend type checking and a production build. [Workflow](.github/workflows/ci.yml) · [CI results](https://github.com/AnshDarji/mnnit-event-ticketing/actions).

With local demo services already running:

```powershell
.\.venv\Scripts\python -m scripts.smoke
```

Use `.venv/bin/python` on macOS/Linux. The localhost-only smoke test verifies publication → booking → cancellation → replacement QR → check-in → repeat rejection → counts.

### Recorded results — 3 October 2026

| Scenario / input | Expected result | Recorded actual result |
| --- | --- | --- |
| Valid MNNIT Google identity | Application session | Passed: automated tests and one real account live |
| Invalid Workspace domain/unverified email | Sign-in denied | Passed: automated tests |
| Eligible open-event reservation | One active ticket and signed QR | Passed: automated tests and live UI |
| Profile fails an academic rule | Booking denied | Passed: automated tests |
| Same attendee books twice | Second active reservation rejected | Passed: automated tests |
| Eight requests for one seat | One `201`, seven `409`, one active booking | Passed: PostgreSQL CI |
| Owner cancels and rebooks | Seat released; new nonce | Passed: automated tests and live UI |
| Forged or wrong-event QR | Rejected | Passed: automated tests and live verification |
| Cancelled/superseded QR | Rejected | Passed: automated tests |
| Valid QR at gate entry | One recorded check-in | Passed: automated tests and live manual entry |
| Same QR again | Already-checked-in rejection | Passed: automated tests and live verification |
| Acceptance event counts | One registration, one check-in | Passed live; retained after page reload |
| Displayed live QR | Decodable payload | Passed: SVG and screenshot decoded with ZXing |

**Still unverified live:** a second real MNNIT account, physical phone-camera scanning and manual public repetition of all eligibility/duplicate/contention cases. Live check-in used the scanner's manual QR-value path. Local/automated results do not establish a physical camera test.

The [verification record](docs/VERIFICATION.md) includes persistence observations and the deployed service-routing fix.

## Deployment and operation

The current pilot is live at **[mnnit-event-ticketing.vercel.app](https://mnnit-event-ticketing.vercel.app/)**.

| Component | Location |
| --- | --- |
| Frontend | Vercel; repository root directory `frontend` |
| Gateway | `https://mnnit-gateway.onrender.com` |
| Auth | `https://mnnit-auth.onrender.com` |
| Events | `https://mnnit-events.onrender.com` |
| Ticketing | `https://mnnit-ticketing.onrender.com` |
| Database | Render PostgreSQL 16, with service-owned schemas |

To deploy another copy:

1. Configure Google branding/audience, permitted test users and authorized JavaScript origins.
2. Create Render services/database from [`render.yaml`](render.yaml); provide independent secrets and replace URLs if assigned addresses differ.
3. Apply migrations and seed against hosted PostgreSQL; use its external SSL connection when running locally.
4. Import `frontend` into Vercel and set `GATEWAY_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_DEMO_MODE=false` before building.
5. Authorize the final frontend origin in Google and complete live acceptance.

Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for exact instructions. Production refuses synthetic demo sign-in. Workspace policy restrictions require institute administrator approval rather than bypassing domain verification.

### Operational limits and demo preparation

- Free Render services sleep after **15 idle minutes** and share **750 instance hours per month**. Wake all four `/health` endpoints before a demonstration, then rehearse the workflow.
- Free PostgreSQL expires after **30 days** and has no managed backups. The recorded pilot expiry is **2 November 2026**; export/replace or upgrade before then.
- Free services communicate over public HTTPS; gateway/internal authorization remains necessary.
- Profiles are self-reported, roles are editable, and no production load or security audit is claimed.

Hosting limits: [Render free-tier documentation](https://render.com/docs/free). Credentials belong in hosting settings or ignored local environment files.

### Troubleshooting

| Symptom | Check / resolution |
| --- | --- |
| Listings/reservations report unavailable | Wake services and retry; check actual dependency URLs rather than placeholders |
| Institute sign-in rejected | Check Google audience/test users, origins, matching client IDs and Workspace policy |
| Expired session | Sign in again; application JWTs last two hours |
| Restricted event cannot be booked | Match every academic rule; check deadline/capacity |
| QR rejected | Select the correct event and latest active pass; cancelled/replaced/checked-in tickets cannot enter |
| Camera unavailable | Use HTTPS or localhost, allow camera permission, or use manual entry |
| Compose authentication fails after `.env` change | Existing volume retains its original password; reconcile credentials without deleting needed data |
| Old frontend configuration | Rebuild/redeploy after changing build-time values |

## Mid-semester evaluation alignment

This README uses the supplied **Software Engineering Project: Mid-Semester Evaluation** brief as a documentation reference. It lists a **20-mark** evaluation, **3 October 2026** deadline, expected **40–60%** progress and at least one working end-to-end feature. That percentage is the brief's expectation, not a measured completion claim for this repository.

| Brief area | Repository evidence / status |
| --- | --- |
| Problem, objectives and stakeholders | Project overview above |
| Requirements and priorities | Functional/non-functional requirements and acceptance criteria above |
| Requirements model | User stories above; separate exported artifacts remain a group submission task |
| Architecture and data design | Mermaid diagram, entity/constraint tables, models and migrations |
| UI and implementation progress | Live routes and `docs/current-home.png` |
| Build, execution, dependencies and configuration | Local instructions, lockfile, requirements and `.env.example` |
| Sample data | `scripts/seed.py` and test fixtures |
| Tests with expected/actual results | Results table, Pytest, CI and verification record |
| Project management and individual contributions | Git history available; member-confirmed allocation, weekly records, meeting log and declaration not supplied here |
| Report and demonstration | Separate PDF report and 5–7 minute video required by brief; neither included in this source repository |
| AI-use disclosure | Disclosure below; group review/confirmation still required |

The brief calls for **one complete group ZIP** for Moodle: report, requirements/design artifacts, source, testing evidence, management records and video or accessible link. Use its `Section_GroupNumber_ProjectTitle_MidSem.zip` naming convention. Group identity, registration numbers, section, instructor and contribution claims must be supplied and confirmed by the group. A source-code archive alone is not the full evaluation package.

## Remaining work

| Priority | Work | Completion criterion |
| --- | --- | --- |
| Immediate verification | Second institute account and physical camera | Recorded public sign-in and phone scan |
| Immediate verification | Remaining public booking edge cases | Evidence for ineligible, duplicate and simultaneous final-seat attempts |
| Before database expiry | Durable database and backup/replacement | Data exported/restored; services connected successfully |
| Before real rollout | Controlled roles and trusted academic data | Approved privileged access and institute-backed eligibility |
| Before real rollout | Load/security/operational review | Measured capacity, reviewed controls and support plan |
| Group submission | Report, design exports, demo and contribution records | Complete verified package matching the brief |
| Later product scope | Waitlists, certificates, exports and detailed analytics | Requirements agreed; features implemented/tested separately |

The completed pilot is the implementation baseline. Deferred features and missing group deliverables are not counted as complete.

## AI assistance and attribution

**Tool:** OpenAI Codex. **Purpose:** frontend/backend implementation assistance, deployment configuration, tests, debugging, UI revisions and documentation. **Generated content:** code, configuration, tests, diagrams and documentation, revised during implementation.

Tool-assisted verification included API tests, PostgreSQL CI, frontend builds/type checking and the recorded live browser walkthrough. This does not establish each student's contribution or personal review. The group must review and understand the submitted code, record its own verification/modifications and confirm individual contributions in the evaluation disclosure. Commit authors alone are not a student contribution declaration.

The MNNIT emblem was supplied by the project owner; the transparent PNG preserves the original artwork. The interface direction was informed by the user-supplied [NYAAY AI reference](https://nyaay-ai-ny.vercel.app/), with an original CampusPass implementation.

### References

- Supplied *Software Engineering Project: Mid-Semester Evaluation*, Sections 2, 3B–3E and 6. The PDF is reference material and is not reproduced in this repository.
- [Google server-side ID token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
- [Render free hosting limitations](https://render.com/docs/free).
- [Deployment guide](docs/DEPLOYMENT.md), [verification record](docs/VERIFICATION.md) and [screenshot catalogue](docs/SCREENSHOTS.md).

No project-wide software license has been declared. Dependencies retain their respective licenses.
