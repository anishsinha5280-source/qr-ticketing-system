import { listMyRegistrations } from "@/lib/services/registration";
import { createHandler, LIMITS, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/registrations/my — the signed-in student's registrations + tickets. */
export const GET = createHandler({
  auth: "STUDENT",
  rateLimit: LIMITS.read,
  rateLimitKeyPrefix: "registrations:my",
  handler: async ({ user }) => {
    const registrations = await listMyRegistrations(user!.id);
    return ok({ registrations, total: registrations.length });
  },
});
