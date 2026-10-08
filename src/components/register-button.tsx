"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, Spinner } from "@/components/ui";
import { useAuth } from "@/components/auth-context";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { EventDto, TicketDto } from "@/lib/types";

type RegisterResponse = {
  registration: { id: string };
  ticket: TicketDto;
  email: { status: "SENT" | "MOCKED" | "FAILED"; message: string };
};

export function RegisterButton({ event }: { event: EventDto }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  const ended = new Date(event.endsAt).getTime() < Date.now();
  const alreadyRegistered = Boolean(event.myRegistration);
  const disabled = busy || event.isFull || ended || alreadyRegistered;

  async function register() {
    setBusy(true);
    setNotice(null);
    try {
      const data = await apiFetch<RegisterResponse>(`/api/events/${event.id}/register`, {
        method: "POST",
      });
      setNotice({
        tone: "success",
        text:
          data.email.status === "SENT"
            ? "Ticket issued — confirmation email sent."
            : data.email.status === "MOCKED"
              ? "Ticket issued — email mocked (no RESEND_API_KEY configured)."
              : "Ticket issued — email delivery failed, but your ticket is valid.",
      });
      router.refresh();
      setTimeout(() => router.push(`/ticket/${data.ticket.id}`), 700);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          router.push(`/login?next=/events/${event.id}`);
          return;
        }
        setNotice({ tone: "error", text: err.message });
      } else {
        setNotice({ tone: "error", text: "Could not register for this event" });
      }
    } finally {
      setBusy(false);
    }
  }

  if (alreadyRegistered && event.myRegistration?.ticketId) {
    return (
      <div className="space-y-3">
        <Alert tone="success" title="You're registered">
          Your signed QR ticket is ready.
        </Alert>
        <a href={`/ticket/${event.myRegistration.ticketId}`} className="btn-primary w-full py-3">
          <Icon name="ticket" className="h-4 w-4" />
          View my ticket
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notice && <Alert tone={notice.tone === "error" ? "error" : "success"}>{notice.text}</Alert>}

      {ended ? (
        <Alert tone="info" title="Registration closed">
          This event has already ended.
        </Alert>
      ) : event.isFull ? (
        <Alert tone="warning" title="EVENT FULL">
          All {event.capacity} seats are taken. The backend rejects further registrations.
        </Alert>
      ) : null}

      <button
        type="button"
        className={`w-full py-3.5 ${disabled ? "btn-secondary cursor-not-allowed" : "btn-primary"}`}
        onClick={register}
        disabled={disabled}
      >
        {busy ? <Spinner /> : <Icon name="bolt" className="h-4 w-4" />}
        {busy
          ? "Issuing ticket…"
          : ended
            ? "Event ended"
            : event.isFull
              ? "EVENT FULL"
              : `Register for this event${event.availableSeats ? ` · ${event.availableSeats} seats left` : ""}`}
      </button>

      {!loading && !user && (
        <p className="text-center text-xs text-slate-500">
          You will be asked to sign in as a student before registering.
        </p>
      )}
      {user && user.role === "ORGANIZER" && (
        <p className="text-center text-xs text-slate-500">
          Organizer accounts cannot register as attendees — switch to a student account.
        </p>
      )}
    </div>
  );
}
