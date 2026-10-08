import { listCheckIns } from "@/lib/services/tickets";
import { createHandler, LIMITS, ok, parseWith } from "@/lib/http";
import { checkInsQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** GET /api/organizer/checkins — check-in history across the organizer's events. */
export const GET = createHandler({
  auth: "ORGANIZER",
  rateLimit: LIMITS.read,
  rateLimitKeyPrefix: "organizer:checkins",
  handler: async ({ request, user }) => {
    const url = new URL(request.url);
    const query = parseWith(checkInsQuerySchema, {
      eventId: url.searchParams.get("eventId") ?? "",
      limit: url.searchParams.get("limit") ?? "50",
    });

    const checkIns = await listCheckIns(user!.id, {
      eventId: query.eventId || undefined,
      limit: query.limit,
    });

    return ok({ checkIns, total: checkIns.length });
  },
});
