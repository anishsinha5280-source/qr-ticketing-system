import { getStudentTicketQrPng, getTicketQrPngForOrganizer } from "@/lib/services/tickets";
import { createHandler, LIMITS } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/tickets/:id/qr → image/png of the signed ticket QR. */
export const GET = createHandler<{ id: string }>({
  auth: "any",
  rateLimit: LIMITS.read,
  rateLimitKeyPrefix: "tickets:qr",
  handler: async ({ params, user }) => {
    const png =
      user!.role === "STUDENT"
        ? await getStudentTicketQrPng(params.id, user!.id)
        : await getTicketQrPngForOrganizer(params.id, user!.id);

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store, must-revalidate",
        "Content-Length": String(png.byteLength),
      },
    });
  },
});
