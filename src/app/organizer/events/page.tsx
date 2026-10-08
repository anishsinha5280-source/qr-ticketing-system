import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { countdownLabel, formatDate, formatTime } from "@/lib/format";
import { requirePageUser } from "@/lib/page-auth";
import { getOrganizerDashboard } from "@/lib/services/events";

export const metadata: Metadata = { title: "Manage events" };
export const dynamic = "force-dynamic";

export default async function OrganizerEventsPage() {
  const user = await requirePageUser("ORGANIZER");
  const { stats } = await getOrganizerDashboard(user.id);

  return (
    <AppShell role="ORGANIZER" title="Manage events">
      <PageHeader
        icon="calendar"
        title="Events"
        subtitle="Create, edit and monitor every event you organize."
        actions={
          <>
            <Link href="/organizer/scanner" className="btn-secondary">
              <Icon name="scan" className="h-4 w-4" />
              Scanner
            </Link>
            <Link href="/organizer/events/new" className="btn-primary">
              <Icon name="plus" className="h-4 w-4" />
              Create event
            </Link>
          </>
        }
      />

      {stats.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No events yet"
          description="Create an event and students can register and receive signed QR tickets instantly."
          action={
            <Link href="/organizer/events/new" className="btn-primary">
              Create your first event
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.map((event) => {
            const filled = event.capacity
              ? Math.min(100, Math.round((event.registered / event.capacity) * 100))
              : 0;
            return (
              <Card key={event.id} hover className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/organizer/events/${event.id}`}
                      className="truncate text-base font-semibold text-white hover:text-indigo-200"
                    >
                      {event.title}
                    </Link>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Icon name="pin" className="h-3.5 w-3.5" />
                      {event.venue}
                    </p>
                  </div>
                  <Badge tone="slate">{countdownLabel(event.startsAt)}</Badge>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  {formatDate(event.startsAt)} · {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
                </p>

                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <MiniStat label="Cap" value={event.capacity} tone="text-slate-200" />
                  <MiniStat label="Reg" value={event.registered} tone="text-cyan-300" />
                  <MiniStat label="In" value={event.checkedIn} tone="text-emerald-300" />
                  <MiniStat label="Left" value={event.remaining} tone="text-amber-300" />
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{filled}% seats taken</span>
                    <span>{event.checkInPercent}% checked in</span>
                  </div>
                  <ProgressBar className="mt-1.5" value={filled} tone={event.remaining === 0 ? "rose" : "indigo"} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  <Link href={`/organizer/events/${event.id}`} className="btn-secondary flex-1 px-3 py-2 text-xs">
                    <Icon name="users" className="h-3.5 w-3.5" />
                    Attendees
                  </Link>
                  <Link
                    href={`/organizer/scanner?eventId=${event.id}`}
                    className="btn-primary flex-1 px-3 py-2 text-xs"
                  >
                    <Icon name="scan" className="h-3.5 w-3.5" />
                    Scan gate
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-2">
      <p className={`text-base font-bold ${tone}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
    </div>
  );
}
