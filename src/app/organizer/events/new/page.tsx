import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { EventForm, type EventFormValues } from "@/components/event-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { toLocalInputValue } from "@/lib/format";
import { requirePageUser } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Create event" };

function defaults(): EventFormValues {
  const start = new Date(Date.now() + 7 * 86_400_000);
  start.setUTCHours(15, 0, 0, 0);
  const end = new Date(start.getTime() + 2.5 * 3_600_000);
  return {
    title: "",
    description: "",
    venue: "",
    startsAt: toLocalInputValue(start),
    endsAt: toLocalInputValue(end),
    capacity: 100,
    category: "Workshop",
    isPublished: true,
  };
}

export default async function NewEventPage() {
  await requirePageUser("ORGANIZER");

  return (
    <AppShell role="ORGANIZER" title="Create event">
      <Link
        href="/organizer/events"
        className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <Icon name="arrowLeft" className="h-4 w-4" />
        All events
      </Link>
      <PageHeader icon="plus" title="Create event" subtitle="Students can register the moment it is published." />
      <EventForm initial={defaults()} />
    </AppShell>
  );
}
