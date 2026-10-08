import { registerStudentForEvent } from "@/lib/services/registration";
import { createHandler, LIMITS, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** POST /api/events/:id/register — students only; issues a signed QR ticket + email. */
export const POST = createHandler<{ id: string }>({
  auth: "STUDENT",
  rateLimit: LIMITS.register,
  rateLimitKeyPrefix: "events:register",
  handler: async ({ params, user }) => {
    const result = await registerStudentForEvent(params.id, user!);
    return ok(
      {
        registration: result.registration,
        ticket: result.ticket,
        email: { status: result.email.status, message: emailMessage(result.email.status) },
      },
      { status: 201 },
    );
  },
});

function emailMessage(status: string): string {
  if (status === "SENT") return "Confirmation email sent via Resend";
  if (status === "MOCKED")
    return "Email mocked (RESEND_API_KEY not configured) — logged to email_logs";
  return "Email delivery failed — your ticket is still valid";
}
