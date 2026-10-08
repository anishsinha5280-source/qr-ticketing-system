import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TicketCard } from "@/components/ticket-card";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui";
import { requirePageUser } from "@/lib/page-auth";
import { getStudentTicket } from "@/lib/services/tickets";

export const metadata: Metadata = { title: "My ticket" };
export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser("STUDENT");

  const result = await getStudentTicket(id, user.id);
  if (!result) notFound();

  const ticket = result.dto;

  return (
    <AppShell role="STUDENT" title={ticket.code}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/my-events" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <Icon name="arrowLeft" className="h-4 w-4" />
          My events
        </Link>
        <Link href={`/events/${ticket.event.id}`} className="btn-secondary px-3 py-2 text-xs">
          Event details
          <Icon name="chevronRight" className="h-3.5 w-3.5" />
        </Link>
      </div>

      {ticket.status === "CHECKED_IN" && (
        <div className="mb-5">
          <Alert tone="info" title="Already checked in">
            This ticket was scanned at the gate. It cannot be used for entry again.
          </Alert>
        </div>
      )}

      <TicketCard ticket={ticket} />

      <p className="mt-6 text-center text-xs text-slate-600">
        Ticket ID {ticket.code} · issued {new Date(ticket.issuedAt).toISOString().slice(0, 10)} ·
        QR payload is an HMAC-SHA256 signed token verified only on the server
      </p>
    </AppShell>
  );
}
