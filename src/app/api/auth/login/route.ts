import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  createSessionToken,
  publicUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { createHandler, LIMITS, ok, parseBody, unauthorized } from "@/lib/http";
import { loginSchema } from "@/lib/validators";

export const POST = createHandler({
  auth: "none",
  rateLimit: LIMITS.auth,
  rateLimitKeyPrefix: "auth:login",
  handler: async ({ request }) => {
    const input = await parseBody(loginSchema, request);

    const rows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const user = rows[0];

    // Same error for "no such user" and "wrong password" — no account enumeration.
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    if (!user.isActive) {
      throw unauthorized("This account has been deactivated");
    }

    const token = await createSessionToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });
    await setSessionCookie(token);

    return ok({
      user: publicUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
        createdAt: user.createdAt,
      }),
      redirectTo: user.role === "ORGANIZER" ? "/organizer/dashboard" : "/dashboard",
    });
  },
});
