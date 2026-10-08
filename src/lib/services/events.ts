import { and, count, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { checkIns, events, registrations, tickets, users } from "@/db/schema";
import { percent } from "@/lib/format";
import type { EventDto, OrganizerEventStats } from "@/lib/types";

type CountMap = Map<string, number>;

type MyRegistration = {
  id: string;
  status: "CONFIRMED" | "CANCELLED";
  ticketId: string | null;
  ticketStatus: "VALID" | "CHECKED_IN" | "CANCELLED" | "EXPIRED" | null;
};

async function registrationCountMap(eventIds: string[]): Promise<CountMap> {
  if (eventIds.length === 0) return new Map();
  const rows = await db
    .select({ eventId: registrations.eventId, total: count() })
    .from(registrations)
    .where(
      and(
        inArray(registrations.eventId, eventIds),
        eq(registrations.status, "CONFIRMED"),
      ),
    )
    .groupBy(registrations.eventId);
  return new Map(rows.map((row) => [row.eventId, Number(row.total)]));
}

async function checkedInCountMap(eventIds: string[]): Promise<CountMap> {
  if (eventIds.length === 0) return new Map();
  const rows = await db
    .select({ eventId: checkIns.eventId, total: count() })
    .from(checkIns)
    .where(inArray(checkIns.eventId, eventIds))
    .groupBy(checkIns.eventId);
  return new Map(rows.map((row) => [row.eventId, Number(row.total)]));
}

async function myRegistrationMap(
  eventIds: string[],
  userId?: string | null,
): Promise<Map<string, MyRegistration>> {
  if (!userId || eventIds.length === 0) return new Map();
  const rows = await db
    .select({
      eventId: registrations.eventId,
      id: registrations.id,
      status: registrations.status,
      ticketId: tickets.id,
      ticketStatus: tickets.status,
    })
    .from(registrations)
    .leftJoin(tickets, eq(tickets.registrationId, registrations.id))
    .where(and(inArray(registrations.eventId, eventIds), eq(registrations.userId, userId)));

  return new Map(
    rows.map((row) => [
      row.eventId,
      {
        id: row.id,
        status: row.status,
        ticketId: row.ticketId ?? null,
        ticketStatus: row.ticketStatus ?? null,
      },
    ]),
  );
}

function toEventDto(
  row: typeof events.$inferSelect,
  organizerName: string | null,
  registered: number,
  checkedIn: number,
  myReg: MyRegistration | undefined,
): EventDto {
  const availableSeats = Math.max(0, row.capacity - registered);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    venue: row.venue,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    capacity: row.capacity,
    category: row.category,
    registeredCount: registered,
    checkedInCount: checkedIn,
    availableSeats,
    isFull: availableSeats === 0,
    organizer: { id: row.organizerId, name: organizerName ?? "Campus Events Team" },
    myRegistration: myReg
      ? {
          id: myReg.id,
          status: myReg.status,
          ticketId: myReg.ticketId,
          ticketStatus: myReg.ticketStatus,
        }
      : null,
  };
}

export async function listPublicEvents(options: {
  search?: string;
  scope?: "upcoming" | "past" | "all";
  userId?: string | null;
}): Promise<EventDto[]> {
  const { search, scope = "upcoming", userId } = options;

  const conditions = [eq(events.isPublished, true)];
  if (scope === "upcoming") conditions.push(sql`${events.endsAt} >= now()`);
  if (scope === "past") conditions.push(sql`${events.endsAt} < now()`);
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(ilike(events.title, term), ilike(events.venue, term), ilike(events.category, term))!,
    );
  }

  const rows = await db
    .select({ event: events, organizerName: users.name })
    .from(events)
    .leftJoin(users, eq(users.id, events.organizerId))
    .where(and(...conditions))
    .orderBy(events.startsAt);

  const ids = rows.map((row) => row.event.id);
  const [regCounts, inCounts, myRegs] = await Promise.all([
    registrationCountMap(ids),
    checkedInCountMap(ids),
    myRegistrationMap(ids, userId),
  ]);

  return rows.map((row) =>
    toEventDto(
      row.event,
      row.organizerName,
      regCounts.get(row.event.id) ?? 0,
      inCounts.get(row.event.id) ?? 0,
      myRegs.get(row.event.id),
    ),
  );
}

export async function getPublicEvent(
  eventId: string,
  userId?: string | null,
): Promise<EventDto | null> {
  const rows = await db
    .select({ event: events, organizerName: users.name })
    .from(events)
    .leftJoin(users, eq(users.id, events.organizerId))
    .where(eq(events.id, eventId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [regCounts, inCounts, myRegs] = await Promise.all([
    registrationCountMap([eventId]),
    checkedInCountMap([eventId]),
    myRegistrationMap([eventId], userId),
  ]);

  return toEventDto(
    row.event,
    row.organizerName,
    regCounts.get(eventId) ?? 0,
    inCounts.get(eventId) ?? 0,
    myRegs.get(eventId),
  );
}

/** Events owned by an organizer, with live capacity / check-in numbers. */
export async function listOwnedEvents(
  organizerId: string,
): Promise<(EventDto & { isOwner: boolean })[]> {
  const rows = await db
    .select({ event: events, organizerName: users.name })
    .from(events)
    .leftJoin(users, eq(users.id, events.organizerId))
    .where(eq(events.organizerId, organizerId))
    .orderBy(sql`${events.startsAt} desc`);

  const ids = rows.map((row) => row.event.id);
  const [regCounts, inCounts] = await Promise.all([
    registrationCountMap(ids),
    checkedInCountMap(ids),
  ]);

  return rows.map((row) => ({
    ...toEventDto(
      row.event,
      row.organizerName,
      regCounts.get(row.event.id) ?? 0,
      inCounts.get(row.event.id) ?? 0,
      undefined,
    ),
    isOwner: true,
  }));
}

export async function getOwnedEvent(eventId: string, organizerId: string) {
  const rows = await db
    .select({ event: events, organizerName: users.name })
    .from(events)
    .leftJoin(users, eq(users.id, events.organizerId))
    .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [regCounts, inCounts] = await Promise.all([
    registrationCountMap([eventId]),
    checkedInCountMap([eventId]),
  ]);

  return toEventDto(
    row.event,
    row.organizerName,
    regCounts.get(eventId) ?? 0,
    inCounts.get(eventId) ?? 0,
    undefined,
  );
}

export async function getOrganizerDashboard(organizerId: string): Promise<{
  stats: OrganizerEventStats[];
  totals: {
    events: number;
    registrations: number;
    checkedIn: number;
    remainingCapacity: number;
    capacity: number;
    checkInPercent: number;
  };
}> {
  const rows = await db
    .select({ event: events })
    .from(events)
    .where(eq(events.organizerId, organizerId))
    .orderBy(sql`${events.startsAt} desc`);

  const ids = rows.map((row) => row.event.id);
  const [regCounts, inCounts] = await Promise.all([
    registrationCountMap(ids),
    checkedInCountMap(ids),
  ]);

  const stats: OrganizerEventStats[] = rows.map(({ event }) => {
    const registered = regCounts.get(event.id) ?? 0;
    const checkedIn = inCounts.get(event.id) ?? 0;
    const remaining = Math.max(0, event.capacity - registered);
    return {
      id: event.id,
      title: event.title,
      venue: event.venue,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      capacity: event.capacity,
      registered,
      checkedIn,
      remaining,
      checkInPercent: percent(checkedIn, registered),
    };
  });

  const totals = stats.reduce(
    (acc, row) => ({
      events: acc.events + 1,
      registrations: acc.registrations + row.registered,
      checkedIn: acc.checkedIn + row.checkedIn,
      remainingCapacity: acc.remainingCapacity + row.remaining,
      capacity: acc.capacity + row.capacity,
    }),
    { events: 0, registrations: 0, checkedIn: 0, remainingCapacity: 0, capacity: 0 },
  );

  return {
    stats,
    totals: { ...totals, checkInPercent: percent(totals.checkedIn, totals.registrations) },
  };
}
