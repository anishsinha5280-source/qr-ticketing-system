import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createHandler, LIMITS, ok, parseBody, unauthorized } from "@/lib/http";
import { passwordChangeSchema } from "@/lib/validators";

export const PUT = createHandler({
  auth: "any",
  rateLimit: LIMITS.auth,
  rateLimitKeyPrefix: "auth:password",
  handler: async ({ request, user }) => {
    const input = await parseBody(passwordChangeSchema, request);

    const rows = await db.select().from(users).where(eq(users.id, user!.id)).limit(1);
    const row = rows[0];
    if (!row) throw unauthorized("Session expired");
    if (!(await verifyPassword(input.currentPassword, row.passwordHash))) {
      throw unauthorized("Current password is incorrect");
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword), updatedAt: new Date() })
      .where(eq(users.id, user!.id));

    return ok({ updated: true });
  },
});
