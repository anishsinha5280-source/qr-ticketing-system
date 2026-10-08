import { getOrganizerDashboard } from "@/lib/services/events";
import { createHandler, LIMITS, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/organizer/stats — dashboard totals + per-event capacity/check-in numbers. */
export const GET = createHandler({
  auth: "ORGANIZER",
  rateLimit: LIMITS.read,
  rateLimitKeyPrefix: "organizer:stats",
  handler: async ({ user }) => {
    const dashboard = await getOrganizerDashboard(user!.id);
    return ok(dashboard);
  },
});
