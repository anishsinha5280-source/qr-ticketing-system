import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { RegisterButton } from "@/components/register-button";
import { Icon } from "@/components/icons";
import { Badge, Card, MetaRow, ProgressBar } from "@/components/ui";
import { countdownLabel, formatDateRange, initials, percent } from "@/lib/format";
import { optionalPageUser } from "@/lib/page-auth";
import { getPublicEvent } from "@/lib/services/events";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getPublicEvent(id, null);
  return { title: event?.title ?? "Event" };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await optionalPageUser();
  const event = await getPublicEvent(id, user?.id ?? null);
  if (!event) notFound();

  const filled = percent(event.registeredCount, event.capacity);

  return (
    <AppShell title={event.title}>
      <Link href="/events" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <Icon name="arrowLeft" className="h-4 w-4" />
        All events
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="indigo">{event.category}</Badge>
              {event.isFull && (
                <Badge tone="rose" icon="alert">
                  Event full
                </Badge>
              )}
              <Badge tone="slate">{countdownLabel(event.startsAt)}</Badge>
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {event.title}
            </h1>

            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {event.description}
            </p>

            <div className="mt-6 grid gap-4 border-t border-slate-800 pt-6 sm:grid-cols-2">
              <MetaRow icon="pin" label="Venue" value={event.venue} />
              <MetaRow icon="calendar" label="Date & time" value={formatDateRange(event.startsAt, event.endsAt)} />
              <MetaRow icon="users" label="Organized by" value={event.organizer?.name ?? "Campus Events Team"} />
              <MetaRow
                icon="ticket"
                label="Capacity"
                value={`${event.registeredCount} of ${event.capacity} seats taken`}
              />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{filled}% full</span>
                <span>{event.availableSeats} seats remaining</span>
              </div>
              <ProgressBar
                className="mt-2"
                value={filled}
                tone={event.isFull ? "rose" : filled > 80 ? "amber" : "indigo"}
              />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
              How entry works
            </h2>
            <ol className="mt-4 space-y-3 text-sm text-slate-300">
              {[
                "Register — the backend re-checks capacity and rejects duplicates.",
                "A signed QR ticket is generated server side and emailed to you instantly.",
                "At the gate an organizer scans your QR; verification happens on the server.",
                "First scan flips VALID → CHECKED_IN atomically. Re-scans report ALREADY USED.",
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-indigo-500/40 bg-indigo-500/10 text-xs font-bold text-indigo-300">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Registration</p>
            <div className="mt-4">
              <RegisterButton event={event} />
            </div>
          </Card>

          {user && (
            <Card className="flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 text-sm font-bold text-white">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <Badge tone={user.role === "ORGANIZER" ? "cyan" : "indigo"} className="ml-auto">
                {user.role === "ORGANIZER" ? "Organizer" : "Student"}
              </Badge>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
