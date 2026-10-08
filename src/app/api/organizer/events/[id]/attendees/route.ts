import { eq } from "drizzle-orm";

import { db } from "@/db";
import { events } from "@/db/schema";
import { listAttendees } from "@/lib/services/tickets";
import { createHandler, forbidden, LIMITS, notFound, ok, parseWith } from "@/lib/http";
import { attendeesQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** GET /api/organizer/events/:id/attendees — registration + ticket list for an event. */
export const GET = createHandler<{ id: string }>({
  auth: "ORGANIZER",
  rateLimit: LIMITS.read,
  rateLimitKeyPrefix: "organizer:attendees",
  handler: async ({ params, request, user }) => {
    const url = new URL(request.url);
    const query = parseWith(attendeesQuerySchema, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? "ALL",
    });

    const rows = await db
      .select()
      .from(events)
      .where(eq(events.id, params.id))
      .limit(1);
    const event = rows[0];
    if (!event) throw notFound("Event not found");
    if (event.organizerId !== user!.id) {
      throw forbidden("You can only view attendees of your own events");
    }

    const attendees = await listAttendees(event.id, { q: query.q, status: query.status });
    const checkedIn = attendees.filter((a) => a.ticketStatus === "CHECKED_IN").length;

    return ok({
      event: {
        id: event.id,
        title: event.title,
        venue: event.venue,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        capacity: event.capacity,
      },
      attendees,
      summary: {
        registered: attendees.length,
        checkedIn,
        notCheckedIn: attendees.length - checkedIn,
        capacity: event.capacity,
        remaining: Math.max(0, event.capacity - attendees.length),
      },
    });
  },
});
