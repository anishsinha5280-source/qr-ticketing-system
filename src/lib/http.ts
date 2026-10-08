import { headers } from "next/headers";
import { ZodError, type ZodType } from "zod";

import { getCurrentUser, type Role, type SessionUser } from "@/lib/auth";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

/* ------------------------------------------------------------------ */
/* Errors + JSON envelope                                             */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Authentication required") =>
  new ApiError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You do not have access to this resource") =>
  new ApiError(403, "FORBIDDEN", message);
export const notFound = (message = "Resource not found") =>
  new ApiError(404, "NOT_FOUND", message);
export const conflict = (code: string, message: string, details?: unknown) =>
  new ApiError(409, code, message, details);
export const tooMany = (message = "Too many requests, please slow down") =>
  new ApiError(429, "RATE_LIMITED", message);

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data }, init);
}

export function errorResponse(err: ApiError): Response {
  return Response.json(
    {
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    },
    { status: err.status },
  );
}

/** Internal errors are logged server-side but never leaked to the client. */
export function internalErrorResponse(err: unknown): Response {
  console.error("[api] unhandled error:", err);
  return Response.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong on our side. Please try again.",
      },
    },
    { status: 500 },
  );
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") || "unknown";
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

export async function parseBody<T>(schema: ZodType<T>, request: Request): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return parseWith(schema, raw);
}

export function parseWith<T>(schema: ZodType<T>, raw: unknown): T {
  try {
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      const first = err.issues[0]?.message ?? "Invalid input";
      throw new ApiError(422, "VALIDATION_ERROR", first, fieldErrors);
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Route factory: rate limit + auth + RBAC + error handling           */
/* ------------------------------------------------------------------ */

/**
 * "none"     – no session lookup at all (fully public)
 * "optional" – resolve the session if present, never reject
 * "any"      – any authenticated user
 * Role       – authenticated user with exactly that role (RBAC)
 */
type AuthMode = "none" | "optional" | "any" | Role;

type HandlerArgs<P> = {
  request: Request;
  params: P;
  user: SessionUser | null;
};

type RouteContext<P> = { params: Promise<P> };

type HandlerFn<P> = (
  args: HandlerArgs<P>,
) => Promise<Response> | Response;

type Config<P> = {
  auth?: AuthMode;
  rateLimit?: { limit: number; windowMs: number };
  rateLimitKeyPrefix?: string;
  handler: HandlerFn<P>;
};

export function createHandler<P extends Record<string, string> = Record<string, string>>(
  config: Config<P>,
) {
  const {
    auth = "none",
    rateLimit: limit = LIMITS.read,
    rateLimitKeyPrefix = "api",
    handler,
  } = config;

  return async function route(
    request: Request,
    context: RouteContext<P>,
  ): Promise<Response> {
    try {
      const ip = await clientIp();
      const rl = rateLimit(
        `${rateLimitKeyPrefix}:${ip}`,
        limit.limit,
        limit.windowMs,
      );
      if (!rl.success) {
        return errorResponse(
          new ApiError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.", {
            retryAfterSeconds: Math.ceil((rl.resetAt - Date.now()) / 1000),
          }),
        );
      }

      let user: SessionUser | null = null;
      if (auth !== "none") {
        user = await getCurrentUser();
        if (!user && auth !== "optional") return errorResponse(unauthorized());
        if (user && auth !== "any" && auth !== "optional" && user.role !== auth) {
          // Role-based access control — enforced server side only.
          return errorResponse(forbidden(`This action requires the ${auth} role`));
        }
      }

      const params = (await context.params) as P;
      const result = await handler({ request, params, user });
      if (result instanceof Response) return result;
      return ok(result);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      return internalErrorResponse(err);
    }
  };
}

export { LIMITS };
