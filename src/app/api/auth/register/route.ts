import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { createSessionToken, hashPassword, publicUser, setSessionCookie } from "@/lib/auth";
import {
  createHandler,
  conflict,
  LIMITS,
  ok,
  parseBody,
} from "@/lib/http";
import { registerSchema } from "@/lib/validators";

export const POST = createHandler({
  auth: "none",
  rateLimit: LIMITS.signup,
  rateLimitKeyPrefix: "auth:register",
  handler: async ({ request }) => {
    const input = await parseBody(registerSchema, request);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing[0]) {
      throw conflict("EMAIL_TAKEN", "An account with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);
    const inserted = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        studentId: input.studentId?.trim() ? input.studentId.trim() : null,
      })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

    const user = inserted[0]!;
    const token = await createSessionToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });
    await setSessionCookie(token);

    const full = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const sessionUser = full[0]!;

    return ok({
      user: publicUser({
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
        studentId: sessionUser.studentId,
        createdAt: sessionUser.createdAt,
      }),
      redirectTo: sessionUser.role === "ORGANIZER" ? "/organizer/dashboard" : "/dashboard",
    });
  },
});
