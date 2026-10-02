# Public deployment

Deploy the repository root to Render for the backend and the `frontend/` directory to Vercel. The browser calls the frontend's `/api` path; Next.js forwards it to `GATEWAY_URL`. Browser API requests therefore remain on the website origin.

## 1. Accounts and repository

Use the group's GitHub repository, Render workspace, Vercel project, and Google Cloud project. Each member signs in to their own external accounts. No external account credentials are included in this project. Upload the contents of this project directory as the repository root, including `render.yaml`, `backend/`, `frontend/`, `scripts/`, and `migrations/`.

Generate three independent backend secrets, each at least 32 characters, and keep a protected copy for configuration. Use identical values across all backend services so JWTs and service requests work across deployments.

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

## 2. Google Workspace sign-in

In Google Cloud, create/select the project, configure Google Auth Platform branding and the audience, and create an OAuth client of type **Web application**. Add `http://localhost`, `http://localhost:3000`, and the exact Vercel production origin (for example `https://your-project.vercel.app`) to authorized JavaScript origins. Set the same client ID as backend `GOOGLE_CLIENT_ID` and frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. This application uses the Google Identity Services JavaScript callback; no redirect URI or client secret is needed. [Google setup documentation](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)

An internal audience requires a project belonging to the institute's Workspace organization. For an external testing audience, add the two MNNIT test accounts when required by the Google console. Request institute administrator approval if Workspace policy blocks the app.

The backend verifies Google's signature, issuer, audience and expiry, then requires verified `@mnnit.ac.in` email and an `hd` claim of `mnnit.ac.in`. A matching email suffix by itself is insufficient. [Google ID token verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

## 3. Render APIs and database

Create a Render Blueprint from the repository's `render.yaml`. The file requests four independent free Docker web services and one PostgreSQL 16 database in Singapore. The Docker startup commands apply only the owning service's migrations before launching Uvicorn on Render's assigned port. Render injects the database's internal connection URL; the application normalizes it for the Psycopg driver. [Render Blueprint reference](https://render.com/docs/blueprint-spec)

Fill the prompted `sync: false` credential variables. The blueprint declares this pilot's actual public service URLs. If you deploy a separate copy, replace those URL values with your assigned Render addresses; service names alone do not guarantee the final URL. Never deploy placeholder addresses: event publication and reservations depend on these service connections.

| Variable | Auth | Events | Ticketing | Gateway |
| --- | --- | --- | --- | --- |
| `JWT_SECRET` | Same value | Same value | Same value | Same value |
| `QR_SECRET` | Same value | Same value | Same value | Same value |
| `INTERNAL_SECRET` | Same value | Same value | Same value | Same value |
| `GOOGLE_CLIENT_ID` | Same client | Same client | Same client | Same client |
| `AUTH_SERVICE_URL` | — | Auth HTTPS URL | Auth HTTPS URL | Auth HTTPS URL |
| `EVENT_SERVICE_URL` | — | — | Events HTTPS URL | Events HTTPS URL |
| `TICKETING_SERVICE_URL` | — | — | — | Ticketing HTTPS URL |
| `DATABASE_URL` | Blueprint-managed | Blueprint-managed | Blueprint-managed | Blueprint-managed |

The blueprint sets `ENVIRONMENT=production`, `DEMO_AUTH_ENABLED=false`, and `PILOT_ROLE_SELECTION=true`. Public service requests must carry `X-Gateway-Secret`, which the gateway adds using `INTERNAL_SECRET`. Service-only calls use `X-Internal-Secret`. The browser must receive neither secret. A direct production API request to auth/events/ticketing without the gateway header must return 403; `/health` remains public.

Check `/health` on all four public Render URLs. Set the service URLs and redeploy Events, Ticketing and Gateway. A shared-secret mismatch typically produces 403 responses. An unavailable or waking upstream produces a retryable gateway error.

To populate the hosted database, run `python -m scripts.seed` from a local Python environment with `DATABASE_URL` set to Render's **external** database URL, using SSL (`sslmode=require`). Keep that value in an untracked local environment file or environment variable. The seed command is idempotent and only inserts synthetic events. Free Render services do not offer shell access, so this local command is the seed path. Restore your local `DATABASE_URL` afterwards.

## 4. Vercel frontend

Import the GitHub repository, choose **Next.js**, and set the project root directory to `frontend`. Set these environment variables for the production environment before building:

| Variable | Value |
| --- | --- |
| `GATEWAY_URL` | Gateway's public `https://…onrender.com` URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The same web OAuth client ID used by Auth |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |

Next.js reads the rewrite target and public variables during the build. Redeploy after changing them. Add the final Vercel origin to the Google OAuth client's authorized JavaScript origins. Never put JWT, QR, internal-service, or database secrets in frontend variables. [Next.js deployment on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)

Use the production HTTPS URL for phone testing. A phone camera generally needs a secure context and browser permission; the scanner provides manual QR payload entry when the camera is unavailable.

## Live acceptance checklist

- Open the production website and confirm the synthetic event listing loads through `/api/events`.
- Confirm the local identity option is absent; use two real MNNIT Workspace accounts in separate browsers.
- Select organizer, complete the profile, and publish a synthetic event with a future deadline, venue, one-seat capacity, and department/program/batch restrictions.
- Attempt booking with an ineligible profile and verify rejection. Correct the profile and complete a booking. Confirm the signed QR ticket and reservation count.
- Try booking twice with the same account. For a one-seat event, send simultaneous booking attempts from different users and confirm only one succeeds.
- Cancel the reservation and confirm a different eligible attendee can reserve the released seat.
- Select gate staff, choose the correct event, allow the camera, scan the QR from a second screen, and confirm the name plus recorded check-in count.
- Repeat the scan; submit a forged payload; scan for a different event; scan a cancelled ticket. Confirm every attempt is rejected.
- Restart/redeploy a backend service, then verify tickets and check-ins persist in PostgreSQL.
- Record the successful two-account Google sign-in and live walkthrough for the group's evaluation evidence. Local synthetic identities are not evidence of institute Google authentication.

## Free hosting and demonstration day

Render free services sleep after 15 idle minutes and share 750 monthly instance hours per workspace. All four can wake separately, so visit their `/health` URLs shortly before the demonstration and then run one complete booking/scanning rehearsal. Avoid an always-on keepalive: four continuously running services consume the shared hours quickly. Free services cannot receive private-network requests, which is why the service URLs use public HTTPS. [Render free service limitations](https://render.com/docs/free)

The free PostgreSQL database expires 30 days after creation and has no managed backups. Set a reminder before expiry; upgrade or export while it is accessible, then restore into a replacement and update every `DATABASE_URL`. Only one free database may be active in a workspace. Do not rely on the later deletion grace period for a working demo. [Render free PostgreSQL limitations](https://render.com/docs/free)

Before real institute use, replace self-selected privileged roles with controlled assignment, verify student attributes against an institute source, and arrange durable database hosting. The public coursework pilot must continue using synthetic events.
