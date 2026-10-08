import { getStudentTicket, getTicketForOrganizer } from "@/lib/services/tickets";
import { createHandler, LIMITS, notFound, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/tickets/:id
 *
 * Accessible by the student who owns the ticket, or by the organizer of the
 * event the ticket belongs to. The signed QR payload is generated server side on
 * every request — clients can never mint or alter a ticket.
 */
export const GET = createHandler<{ id: string }>({
  auth: "any",
  rateLimit: LIMITS.read,
  rateLimitKeyPrefix: "tickets:read",
  handler: async ({ params, user }) => {
    const ticket =
      user!.role === "STUDENT"
        ? await getStudentTicket(params.id, user!.id)
        : await getTicketForOrganizer(params.id, user!.id);

    if (!ticket) throw notFound("Ticket not found");
    return ok({ ticket: ticket.dto });
  },
});
