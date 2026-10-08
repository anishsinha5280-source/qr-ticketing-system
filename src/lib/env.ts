/**
 * Centralised, typed access to environment variables.
 *
 * SECURITY: nothing in this module is ever exposed to the browser. Every value
 * here is server-only (no NEXT_PUBLIC_ prefix), so secrets such as the JWT
 * secret, the ticket signing secret and the Resend API key can never leak into
 * the client bundle.
 *
 * For local development the module falls back to clearly-labelled insecure
 * defaults so that the app still boots without a .env file. In production you
 * MUST provide real values (see .env.example).
 */

const DEV_AUTH_SECRET = "dev-only-insecure-auth-secret-change-me";
const DEV_TICKET_SECRET = "dev-only-insecure-ticket-signing-secret-change-me";

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function read() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    isProduction,
    databaseUrl: process.env.DATABASE_URL ?? "",

    authJwtSecret: process.env.AUTH_JWT_SECRET || DEV_AUTH_SECRET,
    authJwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN || "7d",
    authCookieName: process.env.AUTH_COOKIE_NAME || "ets_session",

    ticketSigningSecret: process.env.TICKET_SIGNING_SECRET || DEV_TICKET_SECRET,
    ticketIssuer: process.env.TICKET_ISSUER || "campus-event-ticketing",
    /** Grace period (hours) after the event ends during which a ticket stays verifiable. */
    ticketGraceHours: Number(process.env.TICKET_GRACE_HOURS || 24),

    resendApiKey: process.env.RESEND_API_KEY || "",
    emailFrom: process.env.EMAIL_FROM || "Campus Events <no-reply@campus-events.local>",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    appName: process.env.NEXT_PUBLIC_APP_NAME || "CampusPass",

    /** When true (or when no API key exists) emails are logged instead of sent. */
    emailMockMode:
      bool(process.env.EMAIL_MOCK_MODE, false) || !process.env.RESEND_API_KEY,

    rateLimitEnabled: bool(process.env.RATE_LIMIT_ENABLED, true),
    usingDevSecrets:
      !process.env.AUTH_JWT_SECRET || !process.env.TICKET_SIGNING_SECRET,
  };
}

export const env = read();

export type AppEnv = ReturnType<typeof read>;
