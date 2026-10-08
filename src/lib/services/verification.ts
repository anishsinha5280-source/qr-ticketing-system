import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { checkIns, events, tickets, users } from "@/db/schema";
import { env } from "@/lib/env";
import { verifyTicketToken } from "@/lib/ticket-token";
import type { VerifyTicketResponse } from "@/lib/types";

export type VerifyInput = {
  token: string;
  expectedEventId?: string | null;
  scannerId: string;
  scannerName: string;
  method: "QR_SCAN" | "MANUAL";
};

const HEADLINES = {
  SUCCESS: "CHECK-IN SUCCESSFUL",
  ALREADY_USED: "ALREADY USED",
  INVALID: "INVALID TICKET",
} as const;

function invalid(reason: string, internalReason: string): VerifyTicketResponse {
  // Internal reasons are logged server-side only; the client receives a generic,
  // non-leaky message so forged tokens cannot be used to probe the system.
  console.warn(`[verify] rejected (${internalReason}): ${reason}`);
  return {
    result: "INVALID",
    headline: HEADLINES.INVALID,
    message: "This QR code is not a valid ticket for entry.",
  };
}

/**
 * Verifies a signed ticket token and, when valid, atomically marks it CHECKED_IN.
 *
 * Order of checks (all server side):
 *  1. cryptographic signature (HMAC-SHA256 / JWT)
 *  2. token expiry
 *  3. ticket exists in the database
 *  4. token belongs to the expected event
 *  5. ticket status is usable (VALID)
 *  6. not already checked in  -> "ALREADY USED"
 *  7. atomic conditional UPDATE inside a transaction with row lock
 */
export async function verifyAndCheckIn(input: VerifyInput): Promise<VerifyTicketResponse> {
  const verification = await verifyTicketToken(input.token);
  if (!verification.valid) {
    return invalid(verification.reason, `token:${verification.reason}`);
  }

  const claims = verification.claims;

  const rows = await db
    .select({ ticket: tickets, event: events, student: users })
    .from(tickets)
    .innerJoin(events, eq(events.id, tickets.eventId))
    .innerJoin(users, eq(users.id, tickets.userId))
    .where(eq(tickets.id, claims.tid))
    .limit(1);

  const row = rows[0];
  if (!row) return invalid("ticket row not found", `unknown:${claims.tid}`);

  const { ticket, event, student } = row;

  // Token/DB integrity: the signed claims must match the stored ticket exactly.
  if (
    ticket.eventId !== claims.eid ||
    ticket.registrationId !== claims.rid ||
    ticket.userId !== claims.uid ||
    ticket.tokenJti !== claims.jti
  ) {
    return invalid("claims mismatch", `mismatch:${claims.tid}`);
  }

  if (input.expectedEventId && input.expectedEventId !== ticket.eventId) {
    return invalid("ticket belongs to another event", `event-mismatch:${ticket.eventId}`);
  }

  if (ticket.status === "CANCELLED") return invalid("ticket cancelled", `cancelled:${ticket.id}`);
  if (ticket.status === "EXPIRED") return invalid("ticket expired", `expired:${ticket.id}`);

  const graceEnd = event.endsAt.getTime() + env.ticketGraceHours * 3_600_000;
  if (Date.now() > Math.max(graceEnd, ticket.tokenExpiresAt.getTime())) {
    return invalid("verification window closed", `window-closed:${ticket.id}`);
  }

  const attendee = {
    id: student.id,
    name: student.name,
    email: student.email,
    studentId: student.studentId,
  };
  const eventDto = {
    id: event.id,
    title: event.title,
    venue: event.venue,
    startsAt: event.startsAt.toISOString(),
  };

  /* ------------------------- ALREADY USED ------------------------- */
  if (ticket.status === "CHECKED_IN") {
    const firstCheckIn = await firstCheckInAt(ticket.id);
    return {
      result: "ALREADY_USED",
      headline: HEADLINES.ALREADY_USED,
      message: "This ticket has already been scanned and cannot be used again.",
      attendee,
      event: eventDto,
      ticket: { id: ticket.id, code: ticket.code, status: ticket.status },
      firstCheckInAt: firstCheckIn,
    };
  }

  /* --------------------- ATOMIC CHECK-IN -------------------------- */
  const outcome = await db.transaction(async (tx) => {
    // Lock the ticket row so concurrent scans of the same QR serialise.
    const locked = await tx
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticket.id))
      .for("update")
      .limit(1);
    const current = locked[0];
    if (!current) return { result: "INVALID" as const };

    if (current.status !== "VALID") {
      const firstCheckIn = await tx
        .select({ at: checkIns.checkedInAt })
        .from(checkIns)
        .where(eq(checkIns.ticketId, ticket.id))
        .limit(1);
      return {
        result: "ALREADY_USED" as const,
        firstCheckInAt:
          firstCheckIn[0]?.at.toISOString() ??
          current.checkedInAt?.toISOString() ??
          new Date().toISOString(),
      };
    }

    const now = new Date();
    // Conditional update: only a VALID ticket can flip to CHECKED_IN.
    const updated = await tx
      .update(tickets)
      .set({ status: "CHECKED_IN", checkedInAt: now })
      .where(and(eq(tickets.id, ticket.id), eq(tickets.status, "VALID")))
      .returning({ id: tickets.id });

    if (updated.length === 0) {
      return { result: "ALREADY_USED" as const, firstCheckInAt: now.toISOString() };
    }

    await tx
      .insert(checkIns)
      .values({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        userId: ticket.userId,
        scannedById: input.scannerId,
        method: input.method,
        checkedInAt: now,
      })
      // The unique index on check_ins.ticket_id is the final safety net.
      .onConflictDoNothing({ target: checkIns.ticketId });

    return { result: "SUCCESS" as const, checkedInAt: now };
  });

  if (outcome.result === "INVALID") return invalid("ticket vanished", `vanished:${ticket.id}`);

  if (outcome.result === "ALREADY_USED") {
    return {
      result: "ALREADY_USED",
      headline: HEADLINES.ALREADY_USED,
      message: "This ticket has already been scanned and cannot be used again.",
      attendee,
      event: eventDto,
      ticket: { id: ticket.id, code: ticket.code, status: "CHECKED_IN" },
      firstCheckInAt: outcome.firstCheckInAt,
    };
  }

  return {
    result: "SUCCESS",
    headline: HEADLINES.SUCCESS,
    message: `Welcome, ${student.name}. Entry granted.`,
    attendee,
    event: eventDto,
    ticket: { id: ticket.id, code: ticket.code, status: "CHECKED_IN" },
    checkedInAt: outcome.checkedInAt.toISOString(),
    scannedBy: input.scannerName,
  };
}

async function firstCheckInAt(ticketId: string): Promise<string> {
  const rows = await db
    .select({ at: checkIns.checkedInAt })
    .from(checkIns)
    .where(eq(checkIns.ticketId, ticketId))
    .orderBy(checkIns.checkedInAt)
    .limit(1);
  return (
    rows[0]?.at.toISOString() ?? new Date().toISOString()
  );
}
