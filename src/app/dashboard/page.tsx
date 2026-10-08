import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, PageHeader, StatCard, TicketStatusBadge } from "@/components/ui";
import { countdownLabel, formatDate, formatTime } from "@/lib/format";
import { requirePageUser } from "@/lib/page-auth";
import { listMyRegistrations } from "@/lib/services/registration";

export const metadata: Metadata = { title: "Student dashboard" };
export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const user = await requirePageUser("STUDENT");
  const registrations = await listMyRegistrations(user.id);

  const now = Date.now();
  const upcoming = registrations
    .filter((r) => new Date(r.event.endsAt).getTime() >= now)
    .sort((a, b) => +new Date(a.event.startsAt) - +new Date(b.event.startsAt));
  const past = registrations.filter((r) => new Date(r.event.endsAt).getTime() < now);
  const checkedIn = registrations.filter((r) => r.ticket?.status === "CHECKED_IN").length;
  const next = upcoming[0];

  return (
    <AppShell role="STUDENT" title="Student dashboard">
      <PageHeader
        icon="grid"
        title={`Hey ${user.name.split(" ")[0]} 👋`}
        subtitle="Your registrations, tickets and entry status in one place."
        actions={
          <>
            <Link href="/events" className="btn-secondary">
              <Icon name="search" className="h-4 w-4" />
              Browse events
            </Link>
            <Link href="/my-events" className="btn-primary">
              <Icon name="ticket" className="h-4 w-4" />
              My tickets
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registrations" value={registrations.length} icon="list" tone="indigo" />
        <StatCard label="Upcoming" value={upcoming.length} icon="calendar" tone="cyan" hint={next ? `Next: ${formatDate(next.event.startsAt)}` : undefined} />
        <StatCard label="Checked in" value={checkedIn} icon="checkCircle" tone="emerald" />
        <StatCard label="Past events" value={past.length} icon="clock" tone="amber" />
      </div>

      {next && (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="grid gap-0 md:grid-cols-[1fr_auto]">
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="indigo" icon="bolt">
                  Next event
                </Badge>
                <Badge tone="slate">{countdownLabel(next.event.startsAt)}</Badge>
                {next.ticket && <TicketStatusBadge status={next.ticket.status} />}
              </div>
              <h2 className="mt-3 text-xl font-bold text-white">{next.event.title}</h2>
              <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                <p className="flex items-center gap-2">
                  <Icon name="pin" className="h-4 w-4 text-slate-500" />
                  {next.event.venue}
                </p>
                <p className="flex items-center gap-2">
                  <Icon name="calendar" className="h-4 w-4 text-slate-500" />
                  {formatDate(next.event.startsAt)} · {formatTime(next.event.startsAt)}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {next.ticket && (
                  <Link href={`/ticket/${next.ticket.id}`} className="btn-primary">
                    <Icon name="qr" className="h-4 w-4" />
                    Show my QR ticket
                  </Link>
                )}
                <Link href={`/events/${next.event.id}`} className="btn-secondary">
                  Event details
                </Link>
              </div>
            </div>
            <div className="hidden items-center justify-center border-l border-slate-800 bg-slate-950/40 p-8 md:flex">
              <div className="text-center">
                <p className="text-5xl font-black tracking-tight text-white">
                  {Math.max(0, Math.ceil((+new Date(next.event.startsAt) - now) / 86_400_000))}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  days to go
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold text-white">Your tickets</h2>
        {registrations.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="ticket"
              title="No registrations yet"
              description="Browse campus events and register — your signed QR ticket is issued instantly and emailed to you."
              action={
                <Link href="/events" className="btn-primary">
                  Find an event
                  <Icon name="chevronRight" className="h-4 w-4" />
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {registrations.slice(0, 6).map((registration) => (
              <Card key={registration.id} hover className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{registration.event.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {formatDate(registration.event.startsAt)} · {formatTime(registration.event.startsAt)} ·{" "}
                    {registration.event.venue}
                  </p>
                </div>
                {registration.ticket && (
                  <>
                    <span className="hidden font-mono text-xs text-cyan-300 sm:block">
                      {registration.ticket.code}
                    </span>
                    <TicketStatusBadge status={registration.ticket.status} />
                    <Link href={`/ticket/${registration.ticket.id}`} className="btn-secondary px-3 py-2 text-xs">
                      <Icon name="qr" className="h-3.5 w-3.5" />
                      Ticket
                    </Link>
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
        {registrations.length > 6 && (
          <Link href="/my-events" className="btn-ghost mt-3 text-sm">
            View all {registrations.length} registrations
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        )}
      </section>
    </AppShell>
  );
}
