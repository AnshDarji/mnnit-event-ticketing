# MNNIT Campus Events

A coursework pilot for discovering synthetic campus events, reserving free seats, displaying signed QR tickets, and recording gate check-in. The application uses Next.js with Tailwind CSS, a FastAPI gateway and three independently deployable services, SQLAlchemy, PostgreSQL, Docker Compose, and Pytest.

Event listings are public. Creating events, booking, viewing tickets, cancelling reservations, and scanning tickets require authentication. Production authentication accepts only Google Workspace accounts whose verified email and `hd` claim belong to `mnnit.ac.in`.

The pilot lets each signed-in user select attendee, organizer, gate staff, or admin. Use only synthetic events for this coursework demonstration. Controlled role assignment and verified student profile data are prerequisites for real institute operations. Tickets are free; payment, event approval, waitlists, certificates, and advanced reports are deferred.

## Website pages

| Route | Purpose |
| --- | --- |
| `/` | Public landing page and platform overview |
| `/sign-in` | Dedicated MNNIT Google sign-in page |
| `/dashboard` | Event discovery and reservations |
| `/tickets` | Ticket wallet, QR display/download and cancellation |
| `/organize` | Event publication and registration/check-in counts |
| `/check-in` | Camera scanner and manual signed-ticket verification |

The workspace routes preserve institute sign-in in the same browser tab. Ticket and operations pages show a sign-in prompt when unauthenticated. The backend enforces permissions and booking rules.

## Quick local preview

Requires Python 3.12 or newer and Node.js 22 or newer. Run commands from this repository's root. The preview uses SQLite and synthetic identities for local demonstrations; PostgreSQL remains the required production database.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt
npm.cmd --prefix frontend ci
.\.venv\Scripts\python -m scripts.dev --demo
```

On macOS/Linux, use `.venv/bin/python` and `npm`. Open [http://localhost:3000](http://localhost:3000). The launcher applies migrations, adds synthetic events, starts the four API processes plus the frontend, and stops them when you press Ctrl+C. Local identities are exposed only when the explicit development flag is enabled. You can use separate browser profiles to act as attendees and gate staff.

For real Google sign-in locally, copy `.env.example` to `.env`, fill both Google client ID values, then run `python -m scripts.dev` without `--demo`. See [deployment instructions](docs/DEPLOYMENT.md) for the Google setup. `--backend-only` starts just the APIs.

## PostgreSQL with Docker Compose

Requires Docker Desktop with its Linux container engine running. Copy the environment template, replace each secret with a separately generated random value, and choose a hexadecimal PostgreSQL password so it is safe inside the connection URL.

```powershell
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
```

Repeat the generation for `POSTGRES_PASSWORD`, `JWT_SECRET`, `QR_SECRET`, and `INTERNAL_SECRET`; edit `.env` locally. The same JWT and internal secrets must be shared by the four backend services. Set the password in the host-side `DATABASE_URL` to match `POSTGRES_PASSWORD`. Keep `.env` out of Git.

```powershell
docker compose up --build -d
docker compose exec events python -m scripts.seed
docker compose ps
```

Open [http://localhost:3000](http://localhost:3000). The backend containers apply their own migrations before starting, and Compose waits for readiness. `docker compose logs -f gateway ticketing` shows logs. `docker compose down` stops containers and preserves the database volume. Changing an environment password does not change the password of an existing PostgreSQL volume.

| Local endpoint | Purpose |
| --- | --- |
| `http://localhost:3000` | Website; browser calls same-origin `/api` |
| `http://localhost:8000` | Gateway and routed API |
| `http://localhost:8001/docs` | Auth OpenAPI in development |
| `http://localhost:8002/docs` | Event OpenAPI in development |
| `http://localhost:8003/docs` | Ticketing OpenAPI in development |
| `localhost:5432` | PostgreSQL, bound to the local machine |

## Service boundaries and data

```mermaid
flowchart LR
  B[Browser] -->|same-origin /api| F[Next.js frontend]
  F --> G[FastAPI gateway]
  G --> A[Auth service]
  G --> E[Event service]
  G --> T[Ticketing service]
  T -->|protected service calls| A
  T -->|protected event lookup| E
  A --> D[(PostgreSQL auth schema)]
  E --> H[(PostgreSQL events schema)]
  T --> I[(PostgreSQL ticketing schema)]
```

| Service | Ownership and interface |
| --- | --- |
| Auth | Google credential verification, application JWTs, profile fields, and pilot role selection under `/auth` |
| Events | Publishing and viewing synthetic events under `/events`; department/program/batch eligibility metadata |
| Ticketing | Reservations, cancellation, QR generation, event counts, and check-in under `/tickets` |
| Gateway | Routes browser requests, forwards bearer tokens, injects the gateway secret, and limits request rates |

Ticketing locks a per-event inventory row in a database transaction before allocating a seat. Active reservations have a uniqueness constraint per attendee and event. Cancellation frees capacity atomically; check-in updates a ticket once. Signed QR payloads include the ticket identity and event identity and are checked against persisted ticket status. An invalid signature, wrong event, cancelled ticket, or repeated scan is rejected.

The database has separate `auth`, `events`, and `ticketing` schemas. Each service's versioned SQL migrations live under `migrations/`; the migration runner records applied versions and locks concurrent migration attempts. Run `python -m scripts.migrate` to migrate all schemas, or add `--service auth`, `--service events`, or `--service ticketing`. `python -m scripts.seed` adds six synthetic events idempotently without creating usable accounts or overwriting existing events. Seeded dates are relative to the first seed run.

## Verification

Run backend tests from the repository root. The ordinary suite uses an isolated SQLite database for functional cases; PostgreSQL is necessary to verify row locks and simultaneous reservations.

```powershell
.\.venv\Scripts\python -m pytest -q
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
```

For the simultaneous final-seat test, set `TEST_POSTGRES_URL` to a **dedicated test database** and rerun Pytest. The fixture creates isolated temporary schemas and deletes them after the run. For example, in PowerShell: `$env:TEST_POSTGRES_URL='postgresql+psycopg://user:password@localhost:5432/mnnit_test'; .\.venv\Scripts\python -m pytest tests -q`. Never use the pilot database for tests. [The public deployment checklist](docs/DEPLOYMENT.md#live-acceptance-checklist) covers two real MNNIT accounts, camera scanning, capacity contention, and persistence after restart.

The project can be deployed using [render.yaml](render.yaml) for the APIs and PostgreSQL, and the `frontend/` directory for Vercel. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for account prerequisites, environment mapping, Google OAuth, and a demonstration checklist. External account creation, OAuth authorization, and a public deployment must be completed with the group's own accounts; configuration files do not establish a live deployment.
