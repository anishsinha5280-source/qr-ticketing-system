import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { publicUser } from "@/lib/auth";
import { createHandler, LIMITS, notFound, ok, parseBody } from "@/lib/http";
import { profileUpdateSchema } from "@/lib/validators";

export const PATCH = createHandler({
  auth: "any",
  rateLimit: LIMITS.write,
  rateLimitKeyPrefix: "auth:profile",
  handler: async ({ request, user }) => {
    const input = await parseBody(profileUpdateSchema, request);
    const updated = await db
      .update(users)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.studentId !== undefined
          ? { studentId: input.studentId === null || input.studentId === "" ? null : input.studentId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user!.id))
      .returning();

    const row = updated[0];
    if (!row) throw notFound("Account not found");

    return ok({
      user: publicUser({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        studentId: row.studentId,
        createdAt: row.createdAt,
      }),
    });
  },
});
