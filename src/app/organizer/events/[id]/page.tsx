import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { events } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { DeleteEventButton } from "@/components/delete-event-button";
import { EventForm } from "@/components/event-form";
import { Icon } from "@/components/icons";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatCard,
  TicketStatusBadge,
} from "@/components/ui";
import { formatDateRange, percent, toLocalInputValue } from "@/lib/format";
import { requirePageUser } from "@/lib/page-auth";
import { getOrganizerDashboard } from "@/lib/services/events";
import { listAttendees } from "@/lib/services/tickets";

export const metadata: Metadata = { title: "Event management" };
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; status?: string };

export default async function OrganizerEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requirePageUser("ORGANIZER");

  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  const event = rows[0];
  if (!event) notFound();
  if (event.organizerId !== user.id) {
    return (
      <AppShell role="ORGANIZER" title="Not your event">
        <EmptyState
          icon="lock"
          title="Access denied"
          description="You can only manage events that you organize."
          action={
            <Link href="/organizer/events" className="btn-primary">
              Back to my events
            </Link>
          }
        />
      </AppShell>
    );
  }

  const status = sp.status === "VALID" || sp.status === "CHECKED_IN" ? sp.status : "ALL";
  const q = sp.q?.trim() ?? "";
  const attendees = await listAttendees(event.id, { q: q || undefined, status });
  const { stats } = await getOrganizerDashboard(user.id);
  const row = stats.find((s) => s.id === event.id);

  const registered = row?.registered ?? attendees.length;
  const checkedIn = row?.checkedIn ?? 0;
  const remaining = row?.remaining ?? Math.max(0, event.capacity - registered);

  return (
    <AppShell role="ORGANIZER" title={event.title}>
      <Link
        href="/organizer/events"
        className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <Icon name="arrowLeft" className="h-4 w-4" />
        All events
      </Link>

      <PageHeader
        icon="calendar"
        title={event.title}
        subtitle={`${event.venue} · ${formatDateRange(event.startsAt, event.endsAt)}`}
        actions={
          <>
            <Link href={`/events/${event.id}`} className="btn-secondary">
              <Icon name="user" className="h-4 w-4" />
              Student view
            </Link>
            <Link href={`/organizer/scanner?eventId=${event.id}`} className="btn-primary">
              <Icon name="scan" className="h-4 w-4" />
              Scan this gate
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Capacity" value={event.capacity} icon="ticket" tone="indigo" />
        <StatCard label="Registered" value={registered} icon="users" tone="cyan" />
        <StatCard
          label="Checked in"
          value={checkedIn}
          icon="checkCircle"
          tone="emerald"
          hint={`${row?.checkInPercent ?? 0}% of registered`}
        />
        <StatCard
          label="Remaining"
          value={remaining}
          icon="clock"
          tone={remaining === 0 ? "rose" : "amber"}
          hint={remaining === 0 ? "EVENT FULL" : `${percent(registered, event.capacity)}% filled`}
        />
      </div>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Seat utilisation</span>
          <span>
            {registered} / {event.capacity}
          </span>
        </div>
        <ProgressBar
          className="mt-2"
          value={percent(registered, event.capacity)}
          tone={remaining === 0 ? "rose" : "indigo"}
        />
      </Card>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">
              Attendees{" "}
              <Badge tone="slate" className="ml-1">
                {attendees.length}
              </Badge>
            </h2>
          </div>

          <form method="GET" className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
            <div className="relative flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search name, email or ticket ID…"
                className="input pl-9"
                aria-label="Search attendees"
              />
            </div>
            <select name="status" defaultValue={status} className="input sm:max-w-45" aria-label="Filter by status">
              <option value="ALL">All statuses</option>
              <option value="VALID">Not checked in</option>
              <option value="CHECKED_IN">Checked in</option>
            </select>
            <button type="submit" className="btn-primary">
              Apply
            </button>
          </form>

          {attendees.length === 0 ? (
            <EmptyState
              icon="users"
              title="No attendees match"
              description="Registrations appear here the moment a student signs up."
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Ticket ID</th>
                      <th className="px-4 py-3 font-semibold">Registered</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Checked in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {attendees.map((attendee) => (
                      <tr key={attendee.registrationId} className="hover:bg-slate-900/40">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{attendee.name}</p>
                          <p className="text-xs text-slate-500">{attendee.email}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-cyan-300">
                          {attendee.ticketCode}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {formatDateRange(attendee.registeredAt, attendee.registeredAt)}
                        </td>
                        <td className="px-4 py-3">
                          <TicketStatusBadge status={attendee.ticketStatus} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {attendee.checkedInAt ? formatDateRange(attendee.checkedInAt, attendee.checkedInAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

        <section className="space-y-6">
          <EventForm
            eventId={event.id}
            minimumCapacity={registered}
            initial={{
              title: event.title,
              description: event.description,
              venue: event.venue,
              startsAt: toLocalInputValue(event.startsAt),
              endsAt: toLocalInputValue(event.endsAt),
              capacity: event.capacity,
              category: event.category,
              isPublished: event.isPublished,
            }}
          />
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
              Danger zone
            </h2>
            <div className="mt-4">
              <DeleteEventButton eventId={event.id} title={event.title} />
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
