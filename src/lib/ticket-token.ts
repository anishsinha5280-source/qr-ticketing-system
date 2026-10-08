import { randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { toBuffer, toDataURL } from "qrcode";

import { env } from "@/lib/env";

/**
 * Ticket token = a short-lived JWT signed with HMAC-SHA256 (HS256) using a
 * server-only secret. The QR code contains ONLY this signed token, so no
 * personal data is embedded in the QR itself and a client can never forge or
 * alter a ticket without invalidating the signature.
 */

export type TicketClaims = {
  /** ticket id */
  tid: string;
  /** event id */
  eid: string;
  /** registration id */
  rid: string;
  /** student (user) id */
  uid: string;
  /** human readable ticket code */
  code: string;
  /** unique token id, mirrored in tickets.token_jti */
  jti: string;
};

export type TokenVerification =
  | { valid: true; claims: TicketClaims; expiresAt: Date }
  | { valid: false; reason: TokenFailureReason };

export type TokenFailureReason =
  | "MALFORMED"
  | "BAD_SIGNATURE"
  | "EXPIRED"
  | "UNTRUSTED_ISSUER";

const encoder = new TextEncoder();

function signingKey() {
  return encoder.encode(env.ticketSigningSecret);
}

/**
 * A ticket stays verifiable until `TICKET_GRACE_HOURS` after the event ends,
 * and always at least 24h from issuance.
 */
export function computeTokenExpiry(eventEndsAt: Date, issuedAt = new Date()): Date {
  const graceEnd = new Date(eventEndsAt.getTime() + env.ticketGraceHours * 3_600_000);
  const minimum = new Date(issuedAt.getTime() + 24 * 3_600_000);
  return graceEnd.getTime() > minimum.getTime() ? graceEnd : minimum;
}

export async function signTicketToken(
  claims: Omit<TicketClaims, "jti">,
  expiresAt: Date,
  jti: string,
): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(env.ticketIssuer)
    .setSubject(claims.tid)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(signingKey());
}

export async function verifyTicketToken(token: string): Promise<TokenVerification> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.split(".").length !== 3) {
    return { valid: false, reason: "MALFORMED" };
  }

  try {
    const { payload } = await jwtVerify(trimmed, signingKey(), {
      issuer: env.ticketIssuer,
      algorithms: ["HS256"],
    });

    const claims = payload as unknown as Partial<TicketClaims>;
    if (!claims.tid || !claims.eid || !claims.rid || !claims.uid || !payload.jti) {
      return { valid: false, reason: "MALFORMED" };
    }

    const expiresAt =
      typeof payload.exp === "number" ? new Date(payload.exp * 1000) : new Date(0);

    return {
      valid: true,
      claims: {
        tid: String(claims.tid),
        eid: String(claims.eid),
        rid: String(claims.rid),
        uid: String(claims.uid),
        code: String(claims.code ?? ""),
        jti: String(payload.jti ?? ""),
      },
      expiresAt,
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const message = err instanceof Error ? err.message : "";
    if (name === "JWTExpired" || /expired/i.test(message)) {
      return { valid: false, reason: "EXPIRED" };
    }
    if (name === "JWTClaimValidationFailed" || /issuer/i.test(message)) {
      return { valid: false, reason: "UNTRUSTED_ISSUER" };
    }
    return { valid: false, reason: "BAD_SIGNATURE" };
  }
}

/* ------------------------------------------------------------------ */
/* Ticket identifiers + QR rendering                                  */
/* ------------------------------------------------------------------ */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

/** e.g. CP-7FK3QM-9ZW2TA — cryptographically random, human readable. */
export function generateTicketCode(prefix = "CP"): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length];
  }
  return `${prefix}-${out.slice(0, 6)}-${out.slice(6, 12)}`;
}

export function newTokenJti(): string {
  return randomUUID().replace(/-/g, "");
}

const QR_COLORS = { dark: "#0b1120", light: "#ffffff" };

/** PNG data URL — used on the ticket page and inside the confirmation email. */
export async function renderQrDataUrl(payload: string, width = 520): Promise<string> {
  return toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width,
    color: QR_COLORS,
    type: "image/png",
  });
}

/** Raw PNG buffer — used for the /qr download route and email attachment. */
export async function renderQrPng(payload: string, width = 520): Promise<Buffer> {
  return toBuffer(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width,
    color: QR_COLORS,
  });
}
