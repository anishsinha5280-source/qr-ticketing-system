# CampusPass — Event Ticketing System with Automated Mailer & QR Entry Check-In

A production-quality, full-stack campus event ticketing platform. Students browse and register for
events, instantly receive a branded confirmation email containing a **cryptographically signed QR
ticket**, and organizers scan those tickets at the gate for **real-time, atomic, anti-duplicate
check-in**.

> Nothing in this project is mocked at the verification layer: signatures, capacity limits,
> duplicate protection and check-in state transitions are all enforced by the backend and the
> PostgreSQL database.

---

## Table of contents

1. [Project overview](#project-overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Technology stack](#technology-stack)
5. [Project structure](#project-structure)
6. [Installation](#installation)
7. [PostgreSQL setup](#postgresql-setup)
8. [Environment variables](#environment-variables)
9. [Database schema & migrations](#database-schema--migrations)
10. [Seed / demo data](#seed--demo-data)
11. [Running the app](#running-the-app)
12. [Resend configuration (automated mailer)](#resend-configuration-automated-mailer)
13. [QR scanner requirements & camera permissions](#qr-scanner-requirements--camera-permissions)
14. [Testing procedure](#testing-procedure)
15. [Security architecture](#security-architecture)
16. [API documentation](#api-documentation)
17. [Troubleshooting](#troubleshooting)
18. [Deployment](#deployment)

---

## Project overview

Campus events traditionally suffer from three problems: paper guest lists, screenshots of tickets
being reused at the gate, and no way for organizers to know real-time attendance. CampusPass solves
all three:

| Problem | CampusPass answer |
| --- | --- |
| Manual registration / over-booking | Seat counting inside a `SELECT … FOR UPDATE` transaction; the DB rejects over-capacity and duplicate registrations |
| Forgeable tickets | Each QR encodes an **HS256-signed JWT** minted server side with a secret that never reaches the browser |
| Ticket reuse (screenshot sharing) | Atomic conditional `UPDATE … WHERE status = 'VALID'` + a **unique index on `check_ins.ticket_id`** ⇒ one ticket = one entry, even under concurrent scans |
| No confirmation channel | Automated Resend email with the QR inline **and** attached as a PNG; falls back to a logged mock so registration never fails |
| Gate chaos | Webcam scanner (`/organizer/scanner`) with instant SUCCESS / ALREADY USED / INVALID states plus manual token entry |

---

## Features

### Student portal
- Register / login / logout with bcrypt-hashed passwords and JWT session cookies
- Browse the public catalogue with search + upcoming/past filters
- Event detail page: title, description, venue, date, start/end time, total capacity, **available
  seats**, registration status, organiser name
- One-click registration → ticket issued instantly
- "EVENT FULL" state: registration disabled in the UI **and** rejected by the backend (409)
- Duplicate registration rejected by a unique DB index (409)
- `/dashboard` (stats + next event), `/my-events` (all registrations), `/ticket/:id`
  (professional digital ticket with QR), `/profile` (details + password change)

### Ticket generation
- Unique ticket record (`id`, human-readable `code` such as `CP-7FK3QM-9ZW2TA`, event,
  registration, student, issued timestamp, status)
- Signed token: JWT / HMAC-SHA256 (`jose`) using `TICKET_SIGNING_SECRET`
- Claims contain only ids (`tid`, `eid`, `rid`, `uid`, `code`, `jti`, `exp`) — **no personal data**
- QR PNG rendered server side (`qrcode`) and shown on the ticket page, downloadable, and embedded in
  the confirmation email
- Token expiry = event end + `TICKET_GRACE_HOURS` (min. 24 h)

### Automated mailer
- Resend REST API (`https://api.resend.com/emails`) with `RESEND_API_KEY` + `EMAIL_FROM`
- Subject: `Your Ticket Confirmation - {EVENT_NAME}`
- Professional dark HTML template: attendee, event, venue, date/time, ticket ID, QR image, entry
  instructions, deep link to the ticket page; QR also attached as a PNG
- **Mock mode**: without credentials (or `EMAIL_MOCK_MODE=true`) the email is logged to the console
  and persisted in `email_logs` — registration still succeeds and the UI shows an
  "Email mocked (dev)" badge

### Organizer portal
- `/organizer/dashboard`: total events, total registrations, total checked-in, remaining capacity,
  check-in %, per-event table, latest check-ins
- `/organizer/events` + `/organizer/events/new` + `/organizer/events/:id`: create / edit / delete
  events, live capacity numbers, searchable attendee list, danger zone
- `/organizer/scanner`: webcam QR scanning, event gate filter, manual token entry, session scan log
- `/organizer/checkins`: immutable check-in audit trail (attendee, event, ticket, method, scanner,
  timestamp) with filters

### Verification outcomes
| Situation | Headline | Colour |
| --- | --- | --- |
| First valid scan | **CHECK-IN SUCCESSFUL** | green |
| Same QR scanned again | **ALREADY USED** | amber |
| Tampered / forged / malformed / expired / unknown / wrong event | **INVALID TICKET** | red |

---

## Architecture

```
                 ┌────────────────────────── Browser ──────────────────────────┐
                 │  React 19 (App Router) · Tailwind v4 · @zxing/browser QR cam │
                 │  Student portal            Organizer dashboard + scanner     │
                 └───────────────▲───────────────────────────▲─────────────────┘
                                 │ fetch (same-origin, cookies)│
                 ┌───────────────┴───────────────────────────┴─────────────────┐
                 │            Next.js route handlers  (src/app/api/**)          │
                 │  createHandler(): rate limit → JWT session → RBAC → zod      │
                 │  controllers: auth · events · registrations · tickets ·      │
                 │               organizer verify/attendees/checkins/stats      │
                 └───────────────▲───────────────────────────▲─────────────────┘
                                 │                           │
              ┌──────────────────┴─────────┐     ┌───────────┴───────────────────┐
              │ services/ (business rules) │     │ lib/ticket-token.ts (HS256)    │
              │ events · registration      │     │ lib/email.ts (Resend / mock)   │
              │ tickets · verification     │     │ lib/rate-limit.ts              │
              └──────────────────┬─────────┘     └───────────────────────────────┘
                                 │ Drizzle ORM (transactions, row locks)
                 ┌───────────────▼──────────────────────────────────────────────┐
                 │ PostgreSQL: users · events · registrations · tickets ·        │
                 │             check_ins · email_logs                            │
                 └───────────────────────────────────────────────────────────────┘
```

**Request pipeline for every API route** (`src/lib/http.ts → createHandler`):

1. **Rate limit** (per IP + route, fixed window)
2. **Session resolution** — httpOnly cookie → HS256 JWT verify (`jose`) → DB user lookup
3. **RBAC** — `STUDENT` / `ORGANIZER` / `any` / `optional`
4. **Zod validation** of body / query
5. **Service layer** — all business rules and transactions
6. Uniform envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`
7. Internal errors are logged server-side and returned as a generic 500 (no stack traces leak)

### Atomic check-in (the heart of the system)

```ts
await db.transaction(async (tx) => {
  // 1. lock the ticket row so concurrent scans serialise
  const locked = await tx.select().from(tickets).where(eq(tickets.id, id)).for("update");
  if (locked[0].status !== "VALID") return { result: "ALREADY_USED" };

  // 2. conditional update — only a VALID ticket can flip
  const updated = await tx.update(tickets)
    .set({ status: "CHECKED_IN", checkedInAt: now })
    .where(and(eq(tickets.id, id), eq(tickets.status, "VALID")))
    .returning();
  if (updated.length === 0) return { result: "ALREADY_USED" };

  // 3. audit row; unique index on check_ins.ticket_id is the final safety net
  await tx.insert(checkIns).values({ ... }).onConflictDoNothing({ target: checkIns.ticketId });
  return { result: "SUCCESS", checkedInAt: now };
});
```

The smoke test fires **6 parallel scans of one QR** and asserts exactly one `SUCCESS`.

### Atomic registration

Same pattern on the event row: `SELECT … FOR UPDATE` → `COUNT(confirmed registrations)` →
reject `EVENT_FULL` → insert registration (unique `(event_id, user_id)` index) → insert ticket →
sign token. 12 concurrent students racing for 3 seats always yields exactly 3 tickets.

---

## Technology stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | **Next.js 16 (App Router) + React 19 + TypeScript** | Server components for data pages, client components for forms/scanner |
| Styling | **Tailwind CSS v4** | Dark dashboard theme, custom `@utility` primitives |
| Backend | **Next.js route handlers (Node.js runtime)** | The Express-equivalent controller layer |
| Database | **PostgreSQL 15** | Transactions, row locks, unique constraints |
| ORM | **Drizzle ORM + drizzle-kit** | SQL-first, typed; migrations in `/drizzle` |
| Auth | **JWT (HS256) via `jose` + httpOnly cookies** | Passwords hashed with **bcryptjs** (cost 12) |
| Ticket signing | **`jose` HS256 JWT** | Separate `TICKET_SIGNING_SECRET` |
| QR generation | **`qrcode`** (server side) | PNG data URL + downloadable PNG + email attachment |
| QR scanning | **`@zxing/browser` + `@zxing/library`** | Webcam decode, QR-only hints, manual fallback |
| Email | **Resend REST API** | Mock/logger fallback in development |
| Validation | **Zod v4** | Body + query schemas, field-level error map |
| Security | **CSP + security headers, rate limiting, RBAC, SameSite cookies** | `next.config.ts` headers = Helmet equivalent |

> **Why Next.js instead of a separate Vite + Express + Prisma repo?** This project targets the
> provided full-stack runtime (Next.js App Router + PostgreSQL + Drizzle). Every requested concern
> still exists as a first-class layer: route handlers = controllers, `src/lib/services` = business
> logic, `src/lib/validators` = validators, `next.config.ts` headers = Helmet/CORS,
> `src/lib/rate-limit.ts` = express-rate-limit, Drizzle = Prisma (typed schema + SQL migrations).

---

## Project structure

```
.
├── drizzle/                      # SQL migrations (applied automatically at boot)
├── scripts/
│   └── smoke-test.mjs            # end-to-end test of all 8 required workflows
├── src/
│   ├── app/
│   │   ├── api/                  # REST API (route handlers)
│   │   │   ├── auth/{register,login,logout,me,profile,password}/route.ts
│   │   │   ├── events/route.ts                       # GET (public) / POST (organizer)
│   │   │   ├── events/[id]/route.ts                  # GET / PUT / DELETE
│   │   │   ├── events/[id]/register/route.ts         # POST (student)
│   │   │   ├── registrations/my/route.ts
│   │   │   ├── tickets/[id]/route.ts                 # GET ticket + signed QR
│   │   │   ├── tickets/[id]/qr/route.ts              # GET image/png
│   │   │   └── organizer/{verify-ticket,stats,checkins}/route.ts
│   │   │       └── organizer/events/[id]/attendees/route.ts
│   │   ├── (pages)/              # public + student + organizer UI
│   │   ├── layout.tsx            # root layout, AuthProvider, dark theme
│   │   ├── globals.css           # Tailwind v4 theme + component utilities
│   │   └── api/health/route.ts
│   ├── components/               # app-shell, scanner-client, ticket-card, event-form, ui…
│   ├── db/                       # schema.ts (Drizzle tables) + index.ts (pool)
│   ├── lib/
│   │   ├── auth.ts               # bcrypt, JWT session, RBAC helper
│   │   ├── env.ts                # typed server-only env access
│   │   ├── http.ts               # route factory, errors, validation, rate limiting
│   │   ├── ticket-token.ts       # HS256 sign/verify + QR rendering
│   │   ├── email.ts              # Resend + mock mailer + email_logs
│   │   ├── validators.ts         # zod schemas
│   │   ├── rate-limit.ts         # in-memory fixed-window limiter
│   │   ├── seed.ts               # idempotent demo data
│   │   ├── format.ts / types.ts  # shared formatting + API contracts
│   │   └── services/             # events, registration, tickets, verification
│   └── instrumentation.ts        # boot: run migrations → seed demo data
├── .env.example
├── next.config.ts                # Helmet-style security headers
└── README.md
```

---

## Installation

```bash
git clone <your-fork> event-ticketing-system
cd event-ticketing-system
npm install
cp .env.example .env       # then edit the secrets
```

Requirements: **Node.js ≥ 20** (22 recommended), **PostgreSQL ≥ 14**.

---

## PostgreSQL setup

```bash
# macOS (Homebrew)
brew services start postgresql@16
createdb app_db

# Docker (any OS)
docker run --name campusspass-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=app_db -p 5432:5432 -d postgres:16
```

Then point `DATABASE_URL` at it:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_JWT_SECRET` | ✅ (prod) | Signs session JWTs |
| `AUTH_JWT_EXPIRES_IN` | – | Session lifetime (default `7d`) |
| `AUTH_COOKIE_NAME` | – | Cookie name (default `ets_session`) |
| `TICKET_SIGNING_SECRET` | ✅ (prod) | Signs QR ticket tokens (rotate ⇒ all QRs invalidated) |
| `TICKET_ISSUER` | – | JWT issuer claim (default `campus-event-ticketing`) |
| `TICKET_GRACE_HOURS` | – | Hours after event end tickets still verify (default `24`) |
| `RESEND_API_KEY` | for real mail | Resend API key; empty ⇒ mock mailer |
| `EMAIL_FROM` | for real mail | e.g. `Campus Events <no-reply@yourdomain.com>` |
| `EMAIL_MOCK_MODE` | – | Force mock mailer even with a key |
| `NEXT_PUBLIC_APP_URL` | – | Used for links inside emails |
| `NEXT_PUBLIC_APP_NAME` | – | Brand name in emails |
| `NEXT_PUBLIC_APP_TIMEZONE` | – | Timezone for rendered dates (default `UTC`) |
| `RATE_LIMIT_ENABLED` | – | Set `false` to disable throttling locally |
| `DRIZZLE_MIGRATIONS_FOLDER` | – | Default `drizzle` |

Generate strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Secrets are read **only** in server code (`src/lib/env.ts`). No key is prefixed `NEXT_PUBLIC_`, so
none of them can appear in the browser bundle.

---

## Database schema & migrations

Tables (Drizzle definitions in [`src/db/schema.ts`](src/db/schema.ts)):

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `users` | Students + organizers | `UNIQUE(email)`, `role ∈ {STUDENT, ORGANIZER}`, bcrypt `password_hash` |
| `events` | Campus events | FK `organizer_id → users`, capacity, start/end timestamps |
| `registrations` | Student ↔ event sign-ups | **`UNIQUE(event_id, user_id)`** (anti-duplicate), FK cascade |
| `tickets` | Issued QR tickets | **`UNIQUE(code)`**, **`UNIQUE(registration_id)`**, `status`, `token_jti`, `token_expires_at` |
| `check_ins` | Gate audit trail | **`UNIQUE(ticket_id)`** (anti-duplicate check-in), FK to scanner |
| `email_logs` | Mailer observability | status `SENT / MOCKED / FAILED`, provider message id, error |

Migrations are applied **automatically when the server boots** (`src/instrumentation.ts` runs
`drizzle-orm` migrator + seeds an empty database). Manual control is also available:

```bash
npx drizzle-kit generate     # create SQL migration after editing schema.ts
npx drizzle-kit push         # quick-apply schema to the dev database
npx drizzle-kit studio       # browse the data
```

---

## Seed / demo data

Seeding is idempotent (`src/lib/seed.ts` → `ensureSeed()`): it only inserts when the `users` table
is empty, and it runs automatically on first boot.

**Demo accounts — ⚠️ DEVELOPMENT ONLY, never reuse these credentials:**

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@example.com` | `Student@123` |
| Organizer | `organizer@example.com` | `Organizer@123` |
| Extra students | `riya@campus.edu`, `arjun@campus.edu`, `meera@campus.edu` | `Student@123` |

Seeded content: 6 campus events (AWS Cloud Career Kickoff, HackNight 2026, AI & ML Workshop,
Cultural Night, Startup Pitch Arena, and a **2-seat** Kubernetes study jam that is already
**EVENT FULL**), 8 registrations/tickets, 2 historical check-ins.

Reset everything:

```bash
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run build && npm start     # migrations + seed run again on boot
```

---

## Running the app

```bash
npm run dev        # http://localhost:3000  (development)
npm run build      # production build
npm start          # production server (auto-migrates + auto-seeds)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

Key URLs:

| Route | Audience |
| --- | --- |
| `/` | Landing page |
| `/login`, `/register` | Public auth (one-click demo buttons included) |
| `/events`, `/events/:id` | Public catalogue + registration |
| `/dashboard`, `/my-events`, `/ticket/:id`, `/profile` | Student |
| `/organizer/dashboard`, `/organizer/events`, `/organizer/events/new`, `/organizer/events/:id` | Organizer |
| `/organizer/scanner` | Gate scanning (webcam + manual token) |
| `/organizer/checkins` | Check-in history |

---

## Resend configuration (automated mailer)

1. Create an account at <https://resend.com>, verify a sending domain (or use the shared
   `onboarding@resend.dev` sender while testing).
2. Create an API key and set it in `.env`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
   EMAIL_FROM=Campus Events <no-reply@yourverifieddomain.com>
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```
3. Restart the server and register for an event. The ticket page shows an **"Email sent"** badge,
   and `email_logs` stores the Resend message id.

Without a key the app runs in **mock mode**: the email HTML is written to `email_logs`, the payload
is logged to the server console, the ticket page shows **"Email mocked (dev)"**, and registration
still succeeds. Mailer failures never break ticket issuance (`FAILED` is recorded instead).

Email contents: attendee name, event name, venue, date & time, ticket ID, QR code (inline image +
PNG attachment), entry instructions and a deep link to `/ticket/:id`.

---

## QR scanner requirements & camera permissions

- **Secure context required**: browsers only expose `getUserMedia` on `https://` or
  `http://localhost`. When testing from a phone, use a tunnel (e.g. `ngrok http 3000`) or deploy.
- Grant camera permission when prompted; `Permissions-Policy: camera=(self)` is served so only this
  origin may use it.
- The scanner decodes **QR codes only** (`DecodeHintType.POSSIBLE_FORMATS = [QR_CODE]`,
  `TRY_HARDER`), which keeps detection fast and avoids accidental barcode reads.
- After each detection the stream pauses, the token is POSTed to
  `/api/organizer/verify-ticket`, and the camera resumes ~2.5 s later for the next attendee.
- **No camera?** Use *Enter token manually* — students can reveal their signed token on their ticket
  page ("Reveal signed entry token" → Copy).
- Tested on Chrome/Edge/Safari (desktop) and Chrome/Safari (Android/iOS).

---

## Testing procedure

An automated end-to-end suite ships in [`scripts/smoke-test.mjs`](scripts/smoke-test.mjs):

```bash
npm run build && npm start          # or: npm run dev
node scripts/smoke-test.mjs http://localhost:3000
```

It covers the required scenarios (and more):

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Student registers for an event | `201` + unique ticket + signed QR |
| 2 | Same student registers again | `409 ALREADY_REGISTERED` |
| 3 | Register for a full event | `409 EVENT_FULL` |
| 4 | Ticket contents | QR data URL, 3-part HS256 JWT, claims = ids only, status `VALID` |
| 5 | Organizer scans a valid QR | `SUCCESS` / "CHECK-IN SUCCESSFUL" + attendee/event/ticket/timestamp; ticket flips to `CHECKED_IN` |
| 6 | Same QR scanned again | `ALREADY_USED` + original timestamp; **no** second `check_ins` row |
| 7 | Tampered signature, `alg:none` forgery, malformed token, unknown ticket id, wrong gate | `INVALID` / "INVALID TICKET" every time |
| 8 | Student hits organizer endpoints; organizer registers as attendee; unauthenticated calls | `403` / `403` / `401` |
| 9 | 12 concurrent registrations for 3 seats | exactly 3 successes, 9 rejections |
| 10 | 6 concurrent scans of one QR | exactly 1 `SUCCESS`, 5 `ALREADY_USED` |
| 11 | Security headers on pages | CSP, `X-Frame-Options: DENY`, `nosniff` |

### Manual walkthrough

1. Sign in as `student@example.com` → **Browse events** → register for *AWS Cloud Career Kickoff*.
2. You land on the digital ticket: QR, ticket ID, status `VALID`, "Email mocked/sent" badge.
3. Copy the signed token (Reveal signed entry token).
4. In another browser/incognito window sign in as `organizer@example.com` → **QR scanner**.
5. Enable the camera and scan the QR (or paste the token into manual entry) ⇒ **CHECK-IN SUCCESSFUL**.
6. Scan the same QR again ⇒ **ALREADY USED** with the original timestamp.
7. Paste a token with one altered character ⇒ **INVALID TICKET**.
8. Try to register for *Intro to Kubernetes* (capacity 2, already full) ⇒ **EVENT FULL**.
9. Open `/organizer/dashboard` and `/organizer/checkins` to see the numbers move live.

---

## Security architecture

| Concern | Implementation |
| --- | --- |
| Password storage | bcrypt (cost 12); plaintext never stored or logged |
| Session | HS256 JWT in an `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookie — JS cannot read it |
| RBAC | Enforced in `createHandler` (`STUDENT` / `ORGANIZER`) **and** in services (event ownership) |
| Ticket integrity | HS256 signature with a server-only secret; issuer + expiry + `jti` cross-checked against `tickets.token_jti` |
| QR privacy | Only ids in the payload; no names/emails inside the QR |
| Anti-duplicate check-in | Row lock + conditional update + `UNIQUE(ticket_id)` on `check_ins` |
| Anti-duplicate registration | `UNIQUE(event_id, user_id)` + locked capacity count |
| Capacity | Counted inside the transaction; frontend value never trusted |
| Input validation | Zod on every body/query; 422 with a field map |
| Rate limiting | Per-IP fixed window (login 20/min, sign-up 60/min, registration 60/min, verify 240/min) |
| Headers | CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, no `X-Powered-By` |
| Error hygiene | Internal errors logged server-side; clients get a generic message and an error `code` |
| Secrets | Server-only env access; nothing prefixed `NEXT_PUBLIC_` except branding/timezone |

**Never trusted from the client:** ticket status, ticket ids, event capacity, user role, scan
outcomes. The browser only ever *displays* what the backend decided.

---

## API documentation

All endpoints return `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`.
Authentication is a session cookie (`ets_session`).

### Auth
| Method | Path | Access | Body | Notes |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | public | `{name,email,password,role?,studentId?}` | Creates account + session cookie |
| POST | `/api/auth/login` | public | `{email,password}` | Sets session cookie; generic error on failure |
| POST | `/api/auth/logout` | public | – | Clears the cookie |
| GET | `/api/auth/me` | authenticated | – | Current user |
| PATCH | `/api/auth/profile` | any | `{name?,studentId?}` | Update profile |
| PUT | `/api/auth/password` | any | `{currentPassword,newPassword}` | Re-hash password |

### Events
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/api/events?search=&scope=upcoming\|past\|all` | public | Includes `availableSeats`, `isFull`, `myRegistration` |
| GET | `/api/events/:id` | public | Event detail |
| POST | `/api/events` | **ORGANIZER** | Create (Zod validated) |
| PUT | `/api/events/:id` | **ORGANIZER (owner)** | Capacity cannot drop below registrations |
| DELETE | `/api/events/:id` | **ORGANIZER (owner)** | Cascades registrations/tickets/check-ins |
| POST | `/api/events/:id/register` | **STUDENT** | Atomic seat claim ⇒ ticket + email; `409 EVENT_FULL` / `409 ALREADY_REGISTERED` |

### Registrations & tickets
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/api/registrations/my` | **STUDENT** | Registrations with ticket + event |
| GET | `/api/tickets/:id` | owner / event organizer | Ticket DTO incl. server-rendered `qrDataUrl` (raw `token` only for the owner) |
| GET | `/api/tickets/:id/qr` | owner / event organizer | `image/png`, `no-store` |

### Organizer
| Method | Path | Access | Body / query | Notes |
| --- | --- | --- | --- | --- |
| POST | `/api/organizer/verify-ticket` | **ORGANIZER** | `{token, eventId?, method?}` | Returns `SUCCESS` / `ALREADY_USED` / `INVALID` |
| GET | `/api/organizer/events/:id/attendees` | **ORGANIZER (owner)** | `?q=&status=ALL\|VALID\|CHECKED_IN` | Attendee list + summary |
| GET | `/api/organizer/checkins` | **ORGANIZER** | `?eventId=&limit=` | Check-in history |
| GET | `/api/organizer/stats` | **ORGANIZER** | – | Dashboard totals + per-event numbers |
| GET | `/api/health` | public | – | DB connectivity probe |

**Verify-ticket response**

```jsonc
{
  "ok": true,
  "data": {
    "result": "SUCCESS",              // SUCCESS | ALREADY_USED | INVALID
    "headline": "CHECK-IN SUCCESSFUL",
    "message": "Welcome, Aarav Sharma. Entry granted.",
    "attendee": { "id": "…", "name": "Aarav Sharma", "email": "…", "studentId": "CS21B1001" },
    "event":    { "id": "…", "title": "AWS Cloud Career Kickoff", "venue": "…", "startsAt": "…" },
    "ticket":   { "id": "…", "code": "CP-7FK3QM-9ZW2TA", "status": "CHECKED_IN" },
    "checkedInAt": "2026-03-14T15:04:05.000Z",
    "scannedBy": "Prof. Anita Desai"
  }
}
```

Error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `EVENT_FULL`,
`ALREADY_REGISTERED`, `EMAIL_TAKEN`, `EVENT_CLOSED`, `RATE_LIMITED`, `INTERNAL_ERROR`.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `DATABASE_URL is required` on boot | Create `.env` from `.env.example` and restart |
| `relation "users" does not exist` | Migrations did not run — check the `[instrumentation]` logs, or run `npx drizzle-kit push` |
| Camera never starts | Must be HTTPS or `localhost`; allow the permission prompt; check `Permissions-Policy: camera=(self)`; use manual token entry as a fallback |
| "Camera permission was blocked" | Site settings → allow camera for this origin, then click *Try again* |
| Emails not arriving | Check `email_logs` (status + error). No `RESEND_API_KEY` ⇒ mock mode by design. Verify the `EMAIL_FROM` domain in Resend |
| QR shows but scan fails | Ensure you scan the ticket's QR (not a screenshot of the page); confirm the gate event filter isn't set to a different event |
| Every scan says INVALID | `TICKET_SIGNING_SECRET` changed after the tickets were issued — re-issue tickets or restore the secret |
| `429 RATE_LIMITED` during local load tests | Raise the limits in `src/lib/rate-limit.ts` or set `RATE_LIMIT_ENABLED=false` |
| Times look shifted | All rendering uses `NEXT_PUBLIC_APP_TIMEZONE` (default `UTC`); set it to your campus timezone |
| Port already in use | `PORT=3001 npm start` |

---

## Deployment

### 1. Environment

Set every variable from `.env.example` in your host's dashboard. Generate fresh
`AUTH_JWT_SECRET` and `TICKET_SIGNING_SECRET` values (never reuse the dev fallbacks).

### 2. Database

Provision managed PostgreSQL (Neon, Supabase, RDS) and set `DATABASE_URL`
(with `?sslmode=require` where needed). Migrations run automatically on boot; you can also run
`npx drizzle-kit push` from a one-off dyno/task before the first deploy.

### 3. Build & run

```bash
npm ci
npm run build
npm start          # honours PORT
```

### 4. Platform notes

- **Vercel**: zero-config (`next build`). Set `NEXT_PUBLIC_APP_URL` to the production URL. Note that
  the in-memory rate limiter is per-instance — swap `src/lib/rate-limit.ts` for Upstash/Redis when
  running multiple regions.
- **Docker**: `node:22-alpine`, `npm ci`, `npm run build`, `CMD ["npm","start"]`, expose `3000`.
- **Fly.io / Render / EC2**: set `PORT`, run behind TLS (required for the camera scanner).
- Scale-out is safe: all correctness guarantees (capacity, single-use tickets) live in PostgreSQL
  transactions and unique indexes, not in process memory.

### 5. Post-deploy checklist

- [ ] Register a real student account and confirm the Resend email arrives
- [ ] Scan a QR from a phone on the production URL (HTTPS)
- [ ] Scan the same QR twice ⇒ ALREADY USED
- [ ] `/api/health` returns `{ "ok": true }`
- [ ] Remove/replace the demo seed accounts

---

## License & credits

MIT — built as a campus hackathon-grade reference implementation of secure event ticketing.
