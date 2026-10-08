import { verifyAndCheckIn } from "@/lib/services/verification";
import { createHandler, LIMITS, ok, parseBody } from "@/lib/http";
import { verifyTicketSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

/**
 * POST /api/organizer/verify-ticket
 *
 * Body: { token: string, eventId?: string, method?: "QR_SCAN" | "MANUAL" }
 *
 * The organizer client never decides whether a ticket is valid — it forwards the
 * scanned token and the backend performs signature verification, expiry checks,
 * ownership checks and the atomic VALID → CHECKED_IN transition.
 */
export const POST = createHandler({
  auth: "ORGANIZER",
  rateLimit: LIMITS.verify,
  rateLimitKeyPrefix: "organizer:verify",
  handler: async ({ request, user }) => {
    const input = await parseBody(verifyTicketSchema, request);

    const result = await verifyAndCheckIn({
      token: input.token,
      expectedEventId: input.eventId?.trim() ? input.eventId.trim() : null,
      scannerId: user!.id,
      scannerName: user!.name,
      method: input.method,
    });

    return ok(result);
  },
});
