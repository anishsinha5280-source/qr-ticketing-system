import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, PageHeader, TicketStatusBadge } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import { requirePageUser } from "@/lib/page-auth";
import { listMyRegistrations } from "@/lib/services/registration";

export const metadata: Metadata = { title: "My events" };
export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const user = await requirePageUser("STUDENT");
  const registrations = await listMyRegistrations(user.id);

  const now = Date.now();
  const upcoming = registrations
    .filter((r) => new Date(r.event.endsAt).getTime() >= now)
    .sort((a, b) => +new Date(a.event.startsAt) - +new Date(b.event.startsAt));
  const past = registrations.filter((r) => new Date(r.event.endsAt).getTime() < now);

  return (
    <AppShell role="STUDENT" title="My events">
      <PageHeader
        icon="ticket"
        title="My events"
        subtitle="Every registration and its signed QR ticket."
        actions={
          <Link href="/events" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            Register for another
          </Link>
        }
      />

      {registrations.length === 0 && (
        <EmptyState
          icon="ticket"
          title="Nothing registered yet"
          description="Pick an event and your ticket will appear here instantly."
          action={
            <Link href="/events" className="btn-primary">
              Browse events
            </Link>
          }
        />
      )}

      <Section title="Upcoming" count={upcoming.length}>
        {upcoming.map((registration) => (
          <Row key={registration.id} registration={registration} />
        ))}
      </Section>

      <Section title="Past" count={past.length}>
        {past.map((registration) => (
          <Row key={registration.id} registration={registration} />
        ))}
      </Section>
    </AppShell>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
        <Badge tone="slate">{count}</Badge>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Row({
  registration,
}: {
  registration: Awaited<ReturnType<typeof listMyRegistrations>>[number];
}) {
  return (
    <Card hover className="p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-800 bg-slate-950/60 text-indigo-300">
          <Icon name="calendar" className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <Link
            href={`/events/${registration.event.id}`}
            className="truncate text-sm font-semibold text-white hover:text-indigo-200"
          >
            {registration.event.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {formatDate(registration.event.startsAt)} · {formatTime(registration.event.startsAt)} –{" "}
            {formatTime(registration.event.endsAt)} · {registration.event.venue}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {registration.ticket && (
            <>
              <span className="hidden font-mono text-xs text-cyan-300 lg:block">
                {registration.ticket.code}
              </span>
              <TicketStatusBadge status={registration.ticket.status} />
              <Link href={`/ticket/${registration.ticket.id}`} className="btn-primary px-3 py-2 text-xs">
                <Icon name="qr" className="h-3.5 w-3.5" />
                View ticket
              </Link>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
