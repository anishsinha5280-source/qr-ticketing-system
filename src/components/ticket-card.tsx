/* eslint-disable @next/next/no-img-element */
import { Icon } from "@/components/icons";
import { TokenDisclosure } from "@/components/token-disclosure";
import { Badge, TicketStatusBadge } from "@/components/ui";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import type { TicketDto } from "@/lib/types";

/**
 * The digital ticket. Rendered on the server; the QR image itself is produced by
 * the backend from a signed token, so nothing here can be forged client side.
 */
export function TicketCard({ ticket }: { ticket: TicketDto }) {
  const checkedIn = ticket.status === "CHECKED_IN";

  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-indigo-600/15 via-violet-600/10 to-cyan-500/15 blur-2xl" />

      <div className="card relative overflow-hidden p-0">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 px-6 py-6 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-100">
                {ticket.event.category} · Entry ticket
              </p>
              <h2 className="mt-1.5 truncate text-xl font-bold text-white sm:text-2xl">
                {ticket.event.title}
              </h2>
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur">
              <Icon name="ticket" className="h-6 w-6" />
            </span>
          </div>
        </div>

        {/* Notch divider */}
        <div className="relative h-6 bg-slate-950/40">
          <span className="absolute -left-3 top-0 h-6 w-6 rounded-full bg-[#05070f]" />
          <span className="absolute -right-3 top-0 h-6 w-6 rounded-full bg-[#05070f]" />
          <span className="absolute left-6 right-6 top-1/2 border-t-2 border-dashed border-slate-700/70" />
        </div>

        {/* Body */}
        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={ticket.status} />
              {checkedIn && ticket.checkedInAt && (
                <Badge tone="cyan" icon="clock">
                  Entered {formatDateTime(ticket.checkedInAt)}
                </Badge>
              )}
              <EmailBadge status={ticket.emailStatus} />
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Student name" value={ticket.student.name} icon="user" />
              <Field
                label="Student email"
                value={ticket.student.email}
                icon="mail"
                mono={false}
              />
              <Field label="Venue" value={ticket.event.venue} icon="pin" />
              <Field
                label="Date"
                value={`${formatDate(ticket.event.startsAt)} · ${formatTime(ticket.event.startsAt)} – ${formatTime(ticket.event.endsAt)}`}
                icon="calendar"
              />
              <Field label="Ticket ID" value={ticket.code} icon="ticket" mono />
              <Field label="Issued" value={formatDateTime(ticket.issuedAt)} icon="clock" />
            </dl>

            {ticket.student.studentId && (
              <p className="text-xs text-slate-500">
                Roll number <span className="font-mono text-slate-400">{ticket.student.studentId}</span>
              </p>
            )}

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Entry instructions
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
                <li>· Open this ticket at the gate and show the QR code.</li>
                <li>· One ticket grants a single entry — re-scans are rejected.</li>
                <li>· The QR contains a signed token, not your personal details.</li>
                <li>· Keep your campus ID handy for spot verification.</li>
              </ul>
            </div>

            <TokenDisclosure token={ticket.token} />
          </div>

          {/* QR */}
          <div className="flex flex-col items-center gap-3 lg:w-64">
            <div className="rounded-2xl bg-white p-4 shadow-xl shadow-black/40">
              {ticket.qrDataUrl ? (
                <img
                  src={ticket.qrDataUrl}
                  alt={`QR code for ticket ${ticket.code}`}
                  width={220}
                  height={220}
                  className="h-[220px] w-[220px]"
                />
              ) : (
                <div className="grid h-[220px] w-[220px] place-items-center text-slate-500">
                  <Icon name="qr" className="h-10 w-10" />
                </div>
              )}
            </div>
            <p className="text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Scan at the entrance
            </p>
            <a href={ticket.qrUrl} download={`ticket-${ticket.code}.png`} className="btn-secondary w-full py-2 text-xs">
              <Icon name="download" className="h-3.5 w-3.5" />
              Download QR (PNG)
            </a>
            <p className="text-center text-[10px] leading-relaxed text-slate-600">
              Token expires {formatDateTime(ticket.tokenExpiresAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value: string;
  icon: "user" | "mail" | "pin" | "calendar" | "ticket" | "clock";
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
        <Icon name={icon} className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd
        className={`mt-1 truncate text-sm font-medium text-slate-100 ${mono ? "font-mono text-cyan-300" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function EmailBadge({ status }: { status: TicketDto["emailStatus"] }) {
  if (!status) return null;
  if (status === "SENT")
    return (
      <Badge tone="emerald" icon="mail">
        Email sent
      </Badge>
    );
  if (status === "MOCKED")
    return (
      <Badge tone="amber" icon="mail">
        Email mocked (dev)
      </Badge>
    );
  return (
    <Badge tone="rose" icon="mail">
      Email failed
    </Badge>
  );
}
