import { events } from "@/db/schema";
import { db } from "@/db";
import { listPublicEvents } from "@/lib/services/events";
import { createHandler, LIMITS, ok, parseBody } from "@/lib/http";
import { createEventSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** GET /api/events — public catalogue (search + upcoming/past filters). */
export const GET = createHandler({
  auth: "optional",
  rateLimit: LIMITS.read,
  rateLimitKeyPrefix: "events:list",
  handler: async ({ request, user }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const scopeParam = url.searchParams.get("scope") ?? "upcoming";
    const scope =
      scopeParam === "past" || scopeParam === "all" || scopeParam === "upcoming"
        ? scopeParam
        : "upcoming";

    const data = await listPublicEvents({ search, scope, userId: user?.id ?? null });
    return ok({ events: data, total: data.length });
  },
});

/** POST /api/events — organizers only. */
export const POST = createHandler({
  auth: "ORGANIZER",
  rateLimit: LIMITS.write,
  rateLimitKeyPrefix: "events:create",
  handler: async ({ request, user }) => {
    const input = await parseBody(createEventSchema, request);

    const created = await db
      .insert(events)
      .values({
        title: input.title,
        description: input.description,
        venue: input.venue,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        capacity: input.capacity,
        category: input.category?.trim() || "Campus",
        isPublished: input.isPublished ?? true,
        organizerId: user!.id,
      })
      .returning();

    const row = created[0]!;
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
      },
    });
  },
});
