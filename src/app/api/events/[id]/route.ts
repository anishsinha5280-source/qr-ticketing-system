import { and, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { events, registrations } from "@/db/schema";
import { getPublicEvent } from "@/lib/services/events";
import {
  badRequest,
  createHandler,
  forbidden,
  LIMITS,
  notFound,
  ok,
  parseBody,
} from "@/lib/http";
import { updateEventSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** GET /api/events/:id — public event detail (includes my registration when signed in). */
export const GET = createHandler<{ id: string }>({
  auth: "optional",
  rateLimit: LIMITS.read,
  rateLimitKeyPrefix: "events:read",
  handler: async ({ params, user }) => {
    const event = await getPublicEvent(params.id, user?.id ?? null);
    if (!event) throw notFound("Event not found");
    return ok({ event });
  },
});

/** PUT /api/events/:id — organizer who owns the event. */
export const PUT = createHandler<{ id: string }>({
  auth: "ORGANIZER",
  rateLimit: LIMITS.write,
  rateLimitKeyPrefix: "events:update",
  handler: async ({ params, request, user }) => {
    const input = await parseBody(updateEventSchema, request);

    const rows = await db
      .select()
      .from(events)
      .where(eq(events.id, params.id))
      .limit(1);
    const current = rows[0];
    if (!current) throw notFound("Event not found");
    if (current.organizerId !== user!.id) {
      throw forbidden("You can only edit events you organize");
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : current.endsAt;
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw badRequest("End time must be after start time");
    }

    if (typeof input.capacity === "number") {
      const [seatRow] = await db
        .select({ total: count() })
        .from(registrations)
        .where(
          and(eq(registrations.eventId, current.id), eq(registrations.status, "CONFIRMED")),
        );
      const taken = Number(seatRow?.total ?? 0);
      if (input.capacity < taken) {
        throw badRequest(
          `Capacity cannot be lower than the ${taken} student(s) already registered`,
        );
      }
    }

    const updated = await db
      .update(events)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.venue !== undefined ? { venue: input.venue } : {}),
        ...(input.startsAt !== undefined ? { startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        updatedAt: new Date(),
      })
      .where(eq(events.id, current.id))
      .returning();

    const row = updated[0]!;
    return ok({
      event: {
        id: row.id,
        title: row.title,
        description: row.description,
        venue: row.venue,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        capacity: row.capacity,
        category: row.category,
        isPublished: row.isPublished,
      },
    });
  },
});

/** DELETE /api/events/:id — organizer who owns the event. */
export const DELETE = createHandler<{ id: string }>({
  auth: "ORGANIZER",
  rateLimit: LIMITS.write,
  rateLimitKeyPrefix: "events:delete",
  handler: async ({ params, user }) => {
    const rows = await db.select().from(events).where(eq(events.id, params.id)).limit(1);
    const current = rows[0];
    if (!current) throw notFound("Event not found");
    if (current.organizerId !== user!.id) {
      throw forbidden("You can only delete events you organize");
    }

    await db.delete(events).where(eq(events.id, current.id));
    return ok({ deleted: true, id: current.id });
  },
});
