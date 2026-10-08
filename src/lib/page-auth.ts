import { redirect } from "next/navigation";

import { getCurrentUser, type Role, type SessionUser } from "@/lib/auth";

/**
 * Server-component guard. Role checks for pages happen here, and — more
 * importantly — every mutation is re-checked inside the API route handlers.
 */
export async function requirePageUser(role?: Role): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (role && user.role !== role) {
    redirect(user.role === "ORGANIZER" ? "/organizer/dashboard" : "/dashboard");
  }
  return user;
}

/** Optional session for public pages that adapt to the signed-in user. */
export async function optionalPageUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}
