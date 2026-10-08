import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { countdownLabel, formatDate, formatDateTime, formatTime } from "@/lib/format";
import { requirePageUser } from "@/lib/page-auth";
import { getOrganizerDashboard } from "@/lib/services/events";
import { listCheckIns } from "@/lib/services/tickets";

export const metadata: Metadata = { title: "Organizer dashboard" };
export const dynamic = "force-dynamic";

export default async function OrganizerDashboard() {
  const user = await requirePageUser("ORGANIZER");
  const [{ stats, totals }, recentCheckIns] = await Promise.all([
    getOrganizerDashboard(user.id),
    listCheckIns(user.id, { limit: 8 }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = recentCheckIns.filter((c) => c.checkedInAt.startsWith(today)).length;

  return (
    <AppShell role="ORGANIZER" title="Organizer dashboard">
      <PageHeader
        icon="grid"
        title="Organizer dashboard"
        subtitle={`Signed in as ${user.name} · live capacity and check-in numbers`}
        actions={
          <>
            <Link href="/organizer/events/new" className="btn-secondary">
              <Icon name="plus" className="h-4 w-4" />
              New event
            </Link>
            <Link href="/organizer/scanner" className="btn-primary">
              <Icon name="scan" className="h-4 w-4" />
              Open QR scanner
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total events" value={totals.events} icon="calendar" tone="indigo" />
        <StatCard label="Total registrations" value={totals.registrations} icon="users" tone="cyan" />
        <StatCard
          label="Checked in"
          value={totals.checkedIn}
          icon="checkCircle"
          tone="emerald"
          hint={`${totals.checkInPercent}% of registered · ${checkedInToday} today`}
        />
        <StatCard
          label="Remaining capacity"
          value={totals.remainingCapacity}
          icon="ticket"
          tone="amber"
          hint={`of ${totals.capacity} total seats`}
        />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Your events</h2>
          <Link href="/organizer/events" className="btn-ghost text-sm">
            Manage all
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>

        {stats.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No events yet"
            description="Create your first campus event and students can register immediately."
            action={
              <Link href="/organizer/events/new" className="btn-primary">
                Create event
              </Link>
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 text-right font-semibold">Capacity</th>
                    <th className="px-4 py-3 text-right font-semibold">Registered</th>
                    <th className="px-4 py-3 text-right font-semibold">Checked in</th>
                    <th className="px-4 py-3 text-right font-semibold">Remaining</th>
                    <th className="px-4 py-3 font-semibold">Check-in %</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {stats.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-slate-900/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/organizer/events/${row.id}`}
                          className="font-medium text-white hover:text-indigo-200"
                        >
                          {row.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">{row.venue}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {formatDate(row.startsAt)}
                        <span className="block text-slate-600">{formatTime(row.startsAt)}</span>
                        <span className="mt-1 inline-block">
                          <Badge tone="slate">{countdownLabel(row.startsAt)}</Badge>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">{row.capacity}</td>
                      <td className="px-4 py-3 text-right font-mono text-cyan-300">{row.registered}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-300">{row.checkedIn}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-300">
                        {row.remaining === 0 ? (
                          <span className="font-sans text-xs font-semibold text-rose-300">FULL</span>
                        ) : (
                          row.remaining
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            className="w-20"
                            value={row.checkInPercent}
                            tone={row.checkInPercent > 0 ? "emerald" : "indigo"}
                          />
                          <span className="text-xs text-slate-400">{row.checkInPercent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/organizer/scanner?eventId=${row.id}`}
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          <Icon name="scan" className="h-3.5 w-3.5" />
                          Scan
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Latest check-ins</h2>
          <Link href="/organizer/checkins" className="btn-ghost text-sm">
            Full history
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
        {recentCheckIns.length === 0 ? (
          <EmptyState
            icon="list"
            title="No check-ins recorded"
            description="Open the scanner and scan a ticket to see live verification here."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recentCheckIns.map((item) => (
              <Card key={item.id} className="flex items-center gap-3 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <Icon name="checkCircle" className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{item.attendee.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {item.event.title} · <span className="font-mono">{item.ticketCode}</span>
                  </p>
                </div>
                <span className="shrink-0 text-right text-[11px] text-slate-500">
                  {formatDateTime(item.checkedInAt)}
                  <span className="block text-slate-600">
                    {item.method === "QR_SCAN" ? "QR scan" : "Manual"}
                  </span>
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
