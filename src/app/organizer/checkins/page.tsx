import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { events } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { requirePageUser } from "@/lib/page-auth";
import { getOrganizerDashboard } from "@/lib/services/events";
import { listCheckIns } from "@/lib/services/tickets";

export const metadata: Metadata = { title: "Check-in history" };
export const dynamic = "force-dynamic";

export default async function CheckInsPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; limit?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageUser("ORGANIZER");

  const [myEvents, dashboard] = await Promise.all([
    db
      .select({ id: events.id, title: events.title })
      .from(events)
      .where(eq(events.organizerId, user.id))
      .orderBy(events.startsAt),
    getOrganizerDashboard(user.id),
  ]);

  const eventId = myEvents.some((event) => event.id === sp.eventId) ? sp.eventId : undefined;
  const limit = Math.min(Math.max(Number(sp.limit ?? 50) || 50, 10), 200);
  const checkIns = await listCheckIns(user.id, { eventId, limit });

  const byMethod = checkIns.reduce(
    (acc, item) => {
      acc[item.method] = (acc[item.method] ?? 0) + 1;
      return acc;
    },
    { QR_SCAN: 0, MANUAL: 0 } as Record<string, number>,
  );

  return (
    <AppShell role="ORGANIZER" title="Check-in history">
      <PageHeader
        icon="list"
        title="Check-in history"
        subtitle="Immutable audit trail of every successful scan across your events."
        actions={
          <Link href="/organizer/scanner" className="btn-primary">
            <Icon name="scan" className="h-4 w-4" />
            Open scanner
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="All-time check-ins" value={dashboard.totals.checkedIn} icon="checkCircle" tone="emerald" />
        <StatCard label="Shown here" value={checkIns.length} icon="list" tone="cyan" />
        <StatCard label="Via QR scan" value={byMethod.QR_SCAN ?? 0} icon="qr" tone="indigo" />
        <StatCard label="Manual entry" value={byMethod.MANUAL ?? 0} icon="keyboard" tone="amber" />
      </div>

      <form method="GET" className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <select
          name="eventId"
          defaultValue={eventId ?? ""}
          className="input sm:max-w-80"
          aria-label="Filter by event"
        >
          <option value="">All my events</option>
          {myEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
        <select name="limit" defaultValue={String(limit)} className="input sm:max-w-40" aria-label="Rows to show">
          {[25, 50, 100, 200].map((value) => (
            <option key={value} value={value}>
              Last {value}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          Filter
        </button>
      </form>

      {checkIns.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="scan"
            title="No check-ins yet"
            description="Scan a ticket at the gate — successful verifications are recorded here with the scanner, method and timestamp."
            action={
              <Link href="/organizer/scanner" className="btn-primary">
                Start scanning
              </Link>
            }
          />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Attendee</th>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Ticket ID</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Scanned by</th>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {checkIns.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{item.attendee.name}</p>
                      <p className="text-xs text-slate-500">{item.attendee.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <Link href={`/organizer/events/${item.event.id}`} className="hover:text-indigo-200">
                        {item.event.title}
                      </Link>
                      <span className="block text-slate-600">{item.event.venue}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-cyan-300">{item.ticketCode}</td>
                    <td className="px-4 py-3">
                      <Badge tone={item.method === "QR_SCAN" ? "indigo" : "amber"} icon={item.method === "QR_SCAN" ? "qr" : "keyboard"}>
                        {item.method === "QR_SCAN" ? "QR scan" : "Manual"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{item.scannedBy?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDate(item.checkedInAt)}
                      <span className="block text-slate-600">{formatTime(item.checkedInAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-800 px-4 py-3 text-[11px] text-slate-600">
            Newest first · latest entry {checkIns[0] ? formatDateTime(checkIns[0].checkedInAt) : "—"}
          </p>
        </Card>
      )}
    </AppShell>
  );
}
