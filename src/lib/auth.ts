import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";

export type Role = "STUDENT" | "ORGANIZER";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentId: string | null;
  createdAt: Date;
};

type SessionClaims = {
  sub: string;
  role: Role;
  email: string;
};

const encoder = new TextEncoder();

function authKey() {
  return encoder.encode(env.authJwtSecret);
}

/* ------------------------------------------------------------------ */
/* Passwords                                                          */
/* ------------------------------------------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  // bcrypt with a work factor of 12 — never store plaintext passwords.
  return hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Session JWT (httpOnly cookie)                                      */
/* ------------------------------------------------------------------ */

export async function createSessionToken(user: {
  id: string;
  role: Role;
  email: string;
}): Promise<string> {
  return new SignJWT({ role: user.role, email: user.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer(env.ticketIssuer)
    .setExpirationTime(env.authJwtExpiresIn as string)
    .sign(authKey());
}

export async function readSessionToken(
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, authKey(), {
      issuer: env.ticketIssuer,
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role as Role,
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(env.authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(env.authCookieName);
}

/** Returns the authenticated user (verified against the database) or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(env.authCookieName)?.value;
  if (!token) return null;

  const claims = await readSessionToken(token);
  if (!claims) return null;

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, claims.sub))
    .limit(1);
  const user = rows[0];
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    studentId: user.studentId,
    createdAt: user.createdAt,
  };
}

export function publicUser(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    createdAt: user.createdAt.toISOString(),
  };
}
