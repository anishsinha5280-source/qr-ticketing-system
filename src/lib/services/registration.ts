import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { events, registrations, tickets } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { sendTicketConfirmationEmail, type EmailOutcome } from "@/lib/email";
import { ApiError, conflict, notFound } from "@/lib/http";
import {
  computeTokenExpiry,
  generateTicketCode,
  newTokenJti,
  renderQrDataUrl,
  renderQrPng,
  signTicketToken,
} from "@/lib/ticket-token";
import type { RegistrationDto, TicketDto } from "@/lib/types";
import { buildTicketDto } from "@/lib/services/tickets";

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}

export type RegisterResult = {
  registration: RegistrationDto;
  ticket: TicketDto;
  email: EmailOutcome;
};

/**
 * Registers a student for an event and issues a signed QR ticket.
 *
 * Capacity + duplicate protection happen inside a serialisable transaction with
 * the event row locked (`SELECT ... FOR UPDATE`), so two concurrent requests can
 * never push an event over capacity and a student can never be registered twice.
 */
export async function registerStudentForEvent(
  eventId: string,
  student: SessionUser,
): Promise<RegisterResult> {
  if (student.role !== "STUDENT") {
    throw new ApiError(403, "FORBIDDEN", "Only student accounts can register for events");
  }

  const issued = await db.transaction(async (tx) => {
    const lockedEvents = await tx
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .for("update")
      .limit(1);
    const event = lockedEvents[0];
    if (!event || !event.isPublished) throw notFound("Event not found");
    if (event.endsAt.getTime() < Date.now()) {
      throw new ApiError(422, "EVENT_CLOSED", "Registration for this event has closed");
    }

    const existing = await tx
      .select()
      .from(registrations)
      .where(
        and(eq(registrations.eventId, eventId), eq(registrations.userId, student.id)),
      )
      .limit(1);
    if (existing[0]) {
      throw conflict(
        "ALREADY_REGISTERED",
        "You are already registered for this event",
        { registrationId: existing[0].id },
      );
    }

    const [seatRow] = await tx
      .select({ total: count() })
      .from(registrations)
      .where(
        and(eq(registrations.eventId, eventId), eq(registrations.status, "CONFIRMED")),
      );
    const taken = Number(seatRow?.total ?? 0);
    if (taken >= event.capacity) {
      throw conflict("EVENT_FULL", "EVENT FULL — no seats left for this event");
    }

    const [registration] = await tx
      .insert(registrations)
      .values({ eventId, userId: student.id, status: "CONFIRMED" })
      .returning();

    if (!registration) throw new ApiError(500, "REGISTRATION_FAILED", "Could not register");

    const jti = newTokenJti();
    const expiresAt = computeTokenExpiry(event.endsAt);
    const code = generateTicketCode();

    let ticket;
    try {
      const inserted = await tx
        .insert(tickets)
        .values({
          code,
          registrationId: registration.id,
          eventId,
          userId: student.id,
          status: "VALID",
          tokenJti: jti,
          tokenExpiresAt: expiresAt,
        })
        .returning();
      ticket = inserted[0];
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw conflict("ALREADY_REGISTERED", "You are already registered for this event");
      }
      throw err;
    }

    if (!ticket) throw new ApiError(500, "TICKET_FAILED", "Could not issue ticket");

    const token = await signTicketToken(
      {
        tid: ticket.id,
        eid: event.id,
        rid: registration.id,
        uid: student.id,
        code: ticket.code,
      },
      expiresAt,
      jti,
    );

    return { event, registration, ticket, token, expiresAt };
  });

  /* ---------------- Mailer (never blocks registration) --------------- */
  let email: EmailOutcome = { status: "MOCKED" };
  try {
    const [qrDataUrl, qrPng] = await Promise.all([
      renderQrDataUrl(issued.token, 520),
      renderQrPng(issued.token, 520),
    ]);

    email = await sendTicketConfirmationEmail({
      to: student.email,
      studentName: student.name,
      event: {
        id: issued.event.id,
        title: issued.event.title,
        venue: issued.event.venue,
        startsAt: issued.event.startsAt,
        endsAt: issued.event.endsAt,
      },
      ticket: { id: issued.ticket.id, code: issued.ticket.code },
      qrDataUrl,
      qrPngBase64: qrPng.toString("base64"),
      ticketUrl: `${env.appUrl}/ticket/${issued.ticket.id}`,
    });
  } catch (err) {
    console.error("[registration] mailer step failed:", err);
    email = { status: "FAILED", error: err instanceof Error ? err.message : "mailer error" };
  }

  const qrDataUrl = await renderQrDataUrl(issued.token, 520);

  const ticketDto = buildTicketDto({
    ticket: issued.ticket,
    event: issued.event,
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      studentId: student.studentId,
    },
    qrDataUrl,
    qrUrl: `/api/tickets/${issued.ticket.id}/qr`,
    emailStatus: email.status,
    token: issued.token,
  });

  const registrationDto: RegistrationDto = {
    id: issued.registration.id,
    status: issued.registration.status,
    createdAt: issued.registration.createdAt.toISOString(),
    ticket: {
      id: issued.ticket.id,
      code: issued.ticket.code,
      status: issued.ticket.status,
      checkedInAt: issued.ticket.checkedInAt?.toISOString() ?? null,
    },
    event: {
      id: issued.event.id,
      title: issued.event.title,
      venue: issued.event.venue,
      startsAt: issued.event.startsAt.toISOString(),
      endsAt: issued.event.endsAt.toISOString(),
      capacity: issued.event.capacity,
      category: issued.event.category,
    },
  };

  return { registration: registrationDto, ticket: ticketDto, email };
}

/** All registrations for a student, newest first, with ticket + event data. */
export async function listMyRegistrations(userId: string): Promise<RegistrationDto[]> {
  const rows = await db
    .select({
      registration: registrations,
      event: events,
      ticket: tickets,
    })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .leftJoin(tickets, eq(tickets.registrationId, registrations.id))
    .where(eq(registrations.userId, userId))
    .orderBy(desc(registrations.createdAt));

  return rows.map(({ registration, event, ticket }) => ({
    id: registration.id,
    status: registration.status,
    createdAt: registration.createdAt.toISOString(),
    ticket: ticket
      ? {
          id: ticket.id,
          code: ticket.code,
          status: ticket.status,
          checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
        }
      : null,
    event: {
      id: event.id,
      title: event.title,
      venue: event.venue,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      capacity: event.capacity,
      category: event.category,
    },
  }));
}

