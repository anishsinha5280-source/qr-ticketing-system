import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  checkIns,
  emailLogs,
  events,
  registrations,
  tickets,
  users,
  type Event,
  type Ticket,
} from "@/db/schema";
import { notFound } from "@/lib/http";
import {
  renderQrDataUrl,
  renderQrPng,
  signTicketToken,
  type TicketClaims,
} from "@/lib/ticket-token";
import type {
  AttendeeDto,
  CheckInDto,
  EmailStatus,
  TicketDto,
  TicketStatus,
} from "@/lib/types";

type StudentInfo = {
  id: string;
  name: string;
  email: string;
  studentId: string | null;
};

export function buildTicketDto(args: {
  ticket: Ticket;
  event: Event;
  student: StudentInfo;
  qrDataUrl?: string;
  qrUrl?: string;
  emailStatus?: EmailStatus | null;
  /** Signed QR payload — only ever included for the ticket owner. */
  token?: string;
}): TicketDto {
  const { ticket, event, student } = args;
  return {
    id: ticket.id,
    code: ticket.code,
    status: ticket.status as TicketStatus,
    issuedAt: ticket.issuedAt.toISOString(),
    checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
    tokenExpiresAt: ticket.tokenExpiresAt.toISOString(),
    qrDataUrl: args.qrDataUrl,
    token: args.token,
    qrUrl: args.qrUrl ?? `/api/tickets/${ticket.id}/qr`,
    event: {
      id: event.id,
      title: event.title,
      venue: event.venue,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      category: event.category,
    },
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      studentId: student.studentId,
    },
    emailStatus: args.emailStatus ?? null,
  };
}

async function latestEmailStatus(ticketId: string): Promise<EmailStatus | null> {
  const rows = await db
    .select({ status: emailLogs.status })
    .from(emailLogs)
    .where(eq(emailLogs.ticketId, ticketId))
    .orderBy(desc(emailLogs.createdAt))
    .limit(1);
  return (rows[0]?.status as EmailStatus) ?? null;
}

/**
 * Re-signs the stored ticket claims (same jti + expiry that are persisted in the
 * DB) and renders the QR. Signing always happens on the server — the client only
 * ever receives the finished image.
 */
type TicketAccess = { userId: string } | { organizerId: string };

type TicketRow = {
  ticket: Ticket;
  event: Event;
  student: { id: string; name: string; email: string; studentId: string | null };
};

async function loadTicketRow(ticketId: string, access: TicketAccess): Promise<TicketRow | null> {
  const condition =
    "userId" in access
      ? and(eq(tickets.id, ticketId), eq(tickets.userId, access.userId))
      : and(eq(tickets.id, ticketId), eq(events.organizerId, access.organizerId));

  const rows = await db
    .select({ ticket: tickets, event: events, student: users })
    .from(tickets)
    .innerJoin(events, eq(events.id, tickets.eventId))
    .innerJoin(users, eq(users.id, tickets.userId))
    .where(condition)
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    ticket: row.ticket,
    event: row.event,
    student: {
      id: row.student.id,
      name: row.student.name,
      email: row.student.email,
      studentId: row.student.studentId,
    },
  };
}

async function presentTicket(row: TicketRow, options: { includeToken?: boolean } = {}) {
  const claims: Omit<TicketClaims, "jti"> = {
    tid: row.ticket.id,
    eid: row.event.id,
    rid: row.ticket.registrationId,
    uid: row.ticket.userId,
    code: row.ticket.code,
  };
  const token = await signTicketToken(claims, row.ticket.tokenExpiresAt, row.ticket.tokenJti);
  const qrDataUrl = await renderQrDataUrl(token, 560);
  const emailStatus = await latestEmailStatus(row.ticket.id);

  return {
    dto: buildTicketDto({
      ticket: row.ticket,
      event: row.event,
      student: {
        id: row.student.id,
        name: row.student.name,
        email: row.student.email,
        studentId: row.student.studentId,
      },
      qrDataUrl,
      emailStatus,
      token: options.includeToken ? token : undefined,
    }),
    token: options.includeToken ? token : undefined,
    qrDataUrl,
  };
}

/** Ticket for its owner (student). The signed token is only ever returned to the owner. */
export async function getStudentTicket(ticketId: string, userId: string) {
  const row = await loadTicketRow(ticketId, { userId });
  return row ? presentTicket(row, { includeToken: true }) : null;
}

/** Ticket for the organizer of the event it belongs to (no raw token). */
export async function getTicketForOrganizer(ticketId: string, organizerId: string) {
  const row = await loadTicketRow(ticketId, { organizerId });
  return row ? presentTicket(row, { includeToken: false }) : null;
}

/** Raw PNG bytes for the ticket QR (download / <img src> route). */
export async function getStudentTicketQrPng(ticketId: string, userId: string) {
  return renderTicketQrPng(await loadTicketRow(ticketId, { userId }));
}

export async function getTicketQrPngForOrganizer(ticketId: string, organizerId: string) {
  return renderTicketQrPng(await loadTicketRow(ticketId, { organizerId }));
}

async function renderTicketQrPng(row: TicketRow | null) {
  if (!row) throw notFound("Ticket not found");
  const token = await signTicketToken(
    {
      tid: row.ticket.id,
      eid: row.event.id,
      rid: row.ticket.registrationId,
      uid: row.ticket.userId,
      code: row.ticket.code,
    },
    row.ticket.tokenExpiresAt,
    row.ticket.tokenJti,
  );
  return renderQrPng(token, 640);
}

/* ------------------------------------------------------------------ */
/* Organizer views                                                    */
/* ------------------------------------------------------------------ */

export async function listAttendees(
  eventId: string,
  options: { q?: string; status?: "ALL" | "VALID" | "CHECKED_IN" },
): Promise<AttendeeDto[]> {
  const conditions = [eq(registrations.eventId, eventId)];
  if (options.status && options.status !== "ALL") {
    conditions.push(eq(tickets.status, options.status as TicketStatus));
  }
  if (options.q && options.q.trim()) {
    const term = `%${options.q.trim()}%`;
    conditions.push(or(ilike(users.name, term), ilike(users.email, term), ilike(tickets.code, term))!);
  }

  const rows = await db
    .select({
      registration: registrations,
      ticket: tickets,
      user: users,
    })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .leftJoin(tickets, eq(tickets.registrationId, registrations.id))
    .where(and(...conditions))
    .orderBy(desc(registrations.createdAt));

  return rows.map(({ registration, ticket, user }) => ({
    registrationId: registration.id,
    ticketId: ticket?.id ?? "",
    ticketCode: ticket?.code ?? "—",
    ticketStatus: (ticket?.status as TicketStatus) ?? "VALID",
    userId: user.id,
    name: user.name,
    email: user.email,
    studentId: user.studentId,
    registeredAt: registration.createdAt.toISOString(),
    checkedInAt: ticket?.checkedInAt?.toISOString() ?? null,
  }));
}

export async function listCheckIns(
  organizerId: string,
  options: { eventId?: string; limit?: number },
): Promise<CheckInDto[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  const myEventIds = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.organizerId, organizerId));
  const ids = myEventIds.map((row) => row.id);
  if (ids.length === 0) return [];

  const conditions = [inArray(checkIns.eventId, ids)];
  if (options.eventId && ids.includes(options.eventId)) {
    conditions.push(eq(checkIns.eventId, options.eventId));
  }

  const rows = await db
    .select({
      checkIn: checkIns,
      ticket: tickets,
      attendee: users,
      event: events,
    })
    .from(checkIns)
    .innerJoin(tickets, eq(tickets.id, checkIns.ticketId))
    .innerJoin(users, eq(users.id, checkIns.userId))
    .innerJoin(events, eq(events.id, checkIns.eventId))
    .where(and(...conditions))
    .orderBy(desc(checkIns.checkedInAt))
    .limit(limit);

  // Resolve scanner names in one extra query (keeps the join graph simple).
  const scannerIds = [...new Set(rows.map((row) => row.checkIn.scannedById).filter(Boolean))] as string[];
  const scanners = scannerIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, scannerIds))
    : [];
  const scannerMap = new Map(scanners.map((s) => [s.id, s.name]));

  return rows.map(({ checkIn, ticket, attendee, event }) => ({
    id: checkIn.id,
    checkedInAt: checkIn.checkedInAt.toISOString(),
    method: checkIn.method,
    ticketCode: ticket.code,
    ticketId: ticket.id,
    attendee: { id: attendee.id, name: attendee.name, email: attendee.email },
    event: { id: event.id, title: event.title, venue: event.venue },
    scannedBy: checkIn.scannedById
      ? { id: checkIn.scannedById, name: scannerMap.get(checkIn.scannedById) ?? "Organizer" }
      : null,
  }));
}
