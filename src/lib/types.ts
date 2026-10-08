/** Shared API contracts used by both server code and client components. */

export type Role = "STUDENT" | "ORGANIZER";
export type TicketStatus = "VALID" | "CHECKED_IN" | "CANCELLED" | "EXPIRED";
export type RegistrationStatus = "CONFIRMED" | "CANCELLED";
export type EmailStatus = "SENT" | "MOCKED" | "FAILED";

export type SessionUserDto = {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentId: string | null;
  createdAt: string;
};

export type EventDto = {
  id: string;
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  category: string;
  registeredCount: number;
  checkedInCount: number;
  availableSeats: number;
  isFull: boolean;
  organizer: { id: string; name: string } | null;
  myRegistration: {
    id: string;
    status: RegistrationStatus;
    ticketId: string | null;
    ticketStatus: TicketStatus | null;
  } | null;
};

export type TicketDto = {
  id: string;
  code: string;
  status: TicketStatus;
  issuedAt: string;
  checkedInAt: string | null;
  tokenExpiresAt: string;
  qrDataUrl?: string;
  qrUrl?: string;
  /** Signed JWT payload of the QR — only returned to the ticket owner. */
  token?: string;
  event: {
    id: string;
    title: string;
    venue: string;
    startsAt: string;
    endsAt: string;
    category: string;
  };
  student: { id: string; name: string; email: string; studentId: string | null };
  emailStatus: EmailStatus | null;
};

export type RegistrationDto = {
  id: string;
  status: RegistrationStatus;
  createdAt: string;
  ticket: { id: string; code: string; status: TicketStatus; checkedInAt: string | null } | null;
  event: {
    id: string;
    title: string;
    venue: string;
    startsAt: string;
    endsAt: string;
    capacity: number;
    category: string;
  };
};

export type VerifyOutcome = "SUCCESS" | "ALREADY_USED" | "INVALID";

export type VerifyTicketResponse = {
  result: VerifyOutcome;
  /** UI headline, e.g. "CHECK-IN SUCCESSFUL". */
  headline: string;
  message: string;
  attendee?: { id: string; name: string; email: string; studentId: string | null };
  event?: { id: string; title: string; venue: string; startsAt: string };
  ticket?: { id: string; code: string; status: TicketStatus };
  /** Timestamp written by this request (only on SUCCESS). */
  checkedInAt?: string;
  /** Timestamp of the original check-in (only on ALREADY_USED). */
  firstCheckInAt?: string;
  scannedBy?: string;
};

export type OrganizerEventStats = {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  registered: number;
  checkedIn: number;
  remaining: number;
  checkInPercent: number;
};

export type AttendeeDto = {
  registrationId: string;
  ticketId: string;
  ticketCode: string;
  ticketStatus: TicketStatus;
  userId: string;
  name: string;
  email: string;
  studentId: string | null;
  registeredAt: string;
  checkedInAt: string | null;
};

export type CheckInDto = {
  id: string;
  checkedInAt: string;
  method: "QR_SCAN" | "MANUAL";
  ticketCode: string;
  ticketId: string;
  attendee: { id: string; name: string; email: string };
  event: { id: string; title: string; venue: string };
  scannedBy: { id: string; name: string } | null;
};

export type ApiErrorShape = {
  code: string;
  message: string;
  details?: Record<string, string> | unknown;
};

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: ApiErrorShape };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
