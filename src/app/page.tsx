import Link from "next/link";

import { Icon, type IconName } from "@/components/icons";
import { Badge, Card, Logo, ProgressBar } from "@/components/ui";
import { optionalPageUser } from "@/lib/page-auth";
import { listPublicEvents } from "@/lib/services/events";
import { countdownLabel, formatDateRange, percent } from "@/lib/format";

export const dynamic = "force-dynamic";

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "shield",
    title: "Cryptographically signed tickets",
    body: "Every QR encodes an HMAC-SHA256 signed JWT minted on the server. Tamper with one character and the gate rejects it.",
  },
  {
    icon: "scan",
    title: "Real-time webcam check-in",
    body: "Organizers scan with any device camera, or paste a token manually. Verification happens on the backend, never in the browser.",
  },
  {
    icon: "lock",
    title: "Anti-duplicate entry",
    body: "A row-locked transaction with a conditional UPDATE and a unique check-in index means one ticket can only ever be used once.",
  },
  {
    icon: "mail",
    title: "Automated mailer",
    body: "Resend delivers a branded confirmation email with the QR attached. Without credentials it safely logs a mock instead of failing.",
  },
];

export default async function HomePage() {
  const user = await optionalPageUser();
  const events = (await listPublicEvents({ scope: "upcoming", userId: user?.id ?? null })).slice(0, 3);

  const homeHref = user
    ? user.role === "ORGANIZER"
      ? "/organizer/dashboard"
      : "/dashboard"
    : "/events";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 lg:px-8 lg:py-16">
      <header className="flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/events" className="btn-ghost">
            Browse events
          </Link>
          {user ? (
            <Link href={homeHref} className="btn-primary">
              Open dashboard
              <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-secondary">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary">
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="fade-up mt-16 grid gap-10 lg:mt-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <Badge tone="indigo" icon="bolt">
            Campus event ticketing
          </Badge>
          <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Signed QR tickets.
            <span className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">
              Zero double entries.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400">
            Students register for campus events, instantly receive a branded confirmation email and
            a tamper-proof digital ticket. Organizers scan at the gate and get an atomic,
            server-verified check-in — even if two scanners hit the same QR at the same moment.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={user ? homeHref : "/register"} className="btn-primary px-5 py-3">
              {user ? "Go to dashboard" : "Register as a student"}
              <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
            <Link href="/organizer/dashboard" className="btn-secondary px-5 py-3">
              <Icon name="scan" className="h-4 w-4" />
              Organizer portal
            </Link>
          </div>

          <Card className="mt-8 max-w-xl border-indigo-500/25 bg-indigo-500/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-300">
              Demo accounts — development only
            </p>
            <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              <p>
                <span className="text-slate-500">Student:</span> student@example.com / Student@123
              </p>
              <p>
                <span className="text-slate-500">Organizer:</span> organizer@example.com /
                Organizer@123
              </p>
            </div>
          </Card>
        </div>

        {/* Mock ticket */}
        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-cyan-500/20 blur-2xl" />
          <Card className="relative overflow-hidden p-0">
            <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 px-6 py-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-100">
                Digital entry ticket
              </p>
              <p className="mt-1 text-lg font-bold text-white">HackNight 2026</p>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div className="flex items-center justify-center rounded-2xl bg-white p-4">
                <div className="grid grid-cols-8 gap-[3px]">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-3.5 w-3.5 rounded-[2px] ${
                        (i * 7 + (i % 5) * 3) % 3 === 0 ? "bg-slate-900" : "bg-white"
                      } ${i < 8 || i > 55 || i % 8 === 0 || i % 8 === 7 ? "bg-slate-900" : ""}`}
                    />
                  ))}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500">Attendee</dt>
                  <dd className="font-medium text-slate-200">Aarav Sharma</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500">Venue</dt>
                  <dd className="font-medium text-slate-200">Innovation Lab</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500">Ticket ID</dt>
                  <dd className="font-mono text-xs text-cyan-300">CP-7FK3QM-9ZW2TA</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500">Status</dt>
                  <dd>
                    <Badge tone="emerald" icon="checkCircle">
                      Valid
                    </Badge>
                  </dd>
                </div>
              </dl>
              <p className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 font-mono text-[10px] leading-relaxed text-slate-500">
                eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOiI4ZjJh…signed…c2ln
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold tracking-tight text-white">Built like a real gate system</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title} hover className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-slate-800 bg-slate-950/60 text-indigo-300">
                <Icon name={feature.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{feature.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Live events */}
      <section className="mt-20">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-white">Live on campus</h2>
          <Link href="/events" className="btn-ghost text-sm">
            View all events
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {events.map((event) => {
            const filled = percent(event.registeredCount, event.capacity);
            return (
              <Link key={event.id} href={`/events/${event.id}`}>
                <Card hover className="h-full p-5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="indigo">{event.category}</Badge>
                    <span className="text-xs text-slate-500">{countdownLabel(event.startsAt)}</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-base font-semibold text-white">
                    {event.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500">{formatDateRange(event.startsAt, event.endsAt)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                    <Icon name="pin" className="h-3.5 w-3.5" />
                    {event.venue}
                  </p>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{event.registeredCount} registered</span>
                      <span>{event.availableSeats} seats left</span>
                    </div>
                    <ProgressBar
                      className="mt-1.5"
                      value={filled}
                      tone={event.isFull ? "rose" : filled > 80 ? "amber" : "indigo"}
                    />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
