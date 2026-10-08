import Link from "next/link";

import { Icon } from "@/components/icons";
import { Badge, Card, ProgressBar } from "@/components/ui";
import { countdownLabel, formatDate, formatTime, percent } from "@/lib/format";
import type { EventDto } from "@/lib/types";

export function EventCard({ event }: { event: EventDto }) {
  const filled = percent(event.registeredCount, event.capacity);
  const ended = new Date(event.endsAt).getTime() < Date.now();

  return (
    <Card hover className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="indigo">{event.category}</Badge>
          {ended && <Badge tone="slate">Ended</Badge>}
          {event.isFull && !ended && (
            <Badge tone="rose" icon="alert">
              Event full
            </Badge>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium text-slate-500">
          {countdownLabel(event.startsAt)}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug text-white">
        <Link href={`/events/${event.id}`} className="hover:text-indigo-200">
          {event.title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{event.description}</p>

      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <p className="flex items-center gap-2">
          <Icon name="pin" className="h-4 w-4 text-slate-500" />
          <span className="truncate">{event.venue}</span>
        </p>
        <p className="flex items-center gap-2">
          <Icon name="calendar" className="h-4 w-4 text-slate-500" />
          {formatDate(event.startsAt)}
        </p>
        <p className="flex items-center gap-2">
          <Icon name="clock" className="h-4 w-4 text-slate-500" />
          {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
        </p>
      </div>

      <div className="mt-5 border-t border-slate-800/80 pt-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            {event.registeredCount} / {event.capacity} registered
          </span>
          <span className={event.isFull ? "font-semibold text-rose-300" : "text-emerald-300"}>
            {event.isFull ? "No seats left" : `${event.availableSeats} seats left`}
          </span>
        </div>
        <ProgressBar
          className="mt-2"
          value={filled}
          tone={event.isFull ? "rose" : filled > 80 ? "amber" : "indigo"}
        />
        <div className="mt-4 flex items-center gap-2">
          <Link href={`/events/${event.id}`} className="btn-primary flex-1 py-2.5 text-sm">
            {event.myRegistration ? "View ticket" : "Event details"}
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
