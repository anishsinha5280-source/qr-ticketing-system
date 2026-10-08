import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { EventCard } from "@/components/event-card";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { optionalPageUser } from "@/lib/page-auth";
import { listPublicEvents } from "@/lib/services/events";

export const metadata: Metadata = { title: "Campus events" };
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; scope?: string };

const SCOPES = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const scope = (SCOPES.find((s) => s.key === sp.scope)?.key ?? "upcoming") as
    | "upcoming"
    | "past"
    | "all";
  const q = sp.q?.trim() ?? "";

  const user = await optionalPageUser();
  const all = await listPublicEvents({ search: q || undefined, scope, userId: user?.id ?? null });

  const registeredCount = all.filter((event) => event.myRegistration).length;
  const totalSeats = all.reduce((sum, event) => sum + event.availableSeats, 0);

  return (
    <AppShell title="Public event catalogue">
      <PageHeader
        icon="calendar"
        title="Campus events"
        subtitle="Register to receive a signed QR ticket by email instantly."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Events shown" value={String(all.length)} />
        <Metric label="Your registrations" value={String(registeredCount)} />
        <Metric label="Seats available" value={String(totalSeats)} />
      </div>

      <form method="GET" action="/events" className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by title, venue or category…"
            className="input pl-9"
            aria-label="Search events"
          />
        </div>
        <input type="hidden" name="scope" value={scope} />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {SCOPES.map((item) => (
          <Link
            key={item.key}
            href={{ pathname: "/events", query: { scope: item.key, q: q || undefined } }}
            className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
              scope === item.key
                ? "border-indigo-500/50 bg-indigo-500/10 text-white"
                : "border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon="search"
          title="No events found"
          description={q ? `Nothing matches “${q}”. Try a different keyword.` : "Check back soon — new events are published regularly."}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {all.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
