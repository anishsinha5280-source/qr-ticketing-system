import { clearSessionCookie } from "@/lib/auth";
import { createHandler, LIMITS, ok } from "@/lib/http";

export const POST = createHandler({
  auth: "none",
  rateLimit: LIMITS.auth,
  rateLimitKeyPrefix: "auth:logout",
  handler: async () => {
    await clearSessionCookie();
    return ok({ signedOut: true });
  },
});
