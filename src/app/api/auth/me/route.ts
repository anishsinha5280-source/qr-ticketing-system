import { getCurrentUser, publicUser } from "@/lib/auth";
import { createHandler, LIMITS, ok, unauthorized } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = createHandler({
  auth: "none",
  rateLimit: LIMITS.read,
  rateLimitKeyPrefix: "auth:me",
  handler: async () => {
    const user = await getCurrentUser();
    if (!user) throw unauthorized("Not signed in");
    return ok({ user: publicUser(user) });
  },
});
