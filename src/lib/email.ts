import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { env } from "@/lib/env";
import { formatDateRange } from "@/lib/format";

export type TicketEmailInput = {
  to: string;
  studentName: string;
  event: {
    id: string;
    title: string;
    venue: string;
    startsAt: Date;
    endsAt: Date;
  };
  ticket: {
    id: string;
    code: string;
  };
  qrDataUrl: string;
  qrPngBase64: string;
  ticketUrl: string;
};

export type EmailOutcome = {
  status: "SENT" | "MOCKED" | "FAILED";
  providerMessageId?: string | null;
  error?: string | null;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function buildTicketEmailHtml(input: TicketEmailInput): string {
  const when = formatDateRange(input.event.startsAt, input.event.endsAt);
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0b1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f172a;border:1px solid #1e293b;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#06b6d4 100%);">
                <p style="margin:0;color:#e0e7ff;font-size:12px;letter-spacing:2px;text-transform:uppercase;">${env.appName} · Entry Ticket</p>
                <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">You're going to ${escapeHtml(input.event.title)} 🎟️</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;color:#e2e8f0;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 18px;">Hi ${escapeHtml(input.studentName)},</p>
                <p style="margin:0 0 22px;">Your registration is confirmed. Show the QR code below at the entrance — it will be scanned and verified on the spot.</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;border:1px solid #1e293b;border-radius:14px;">
                  <tr><td style="padding:14px 18px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:38%;">Attendee</td><td style="padding:14px 18px;border-bottom:1px solid #1e293b;color:#f8fafc;font-size:14px;">${escapeHtml(input.studentName)}</td></tr>
                  <tr><td style="padding:14px 18px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Event</td><td style="padding:14px 18px;border-bottom:1px solid #1e293b;color:#f8fafc;font-size:14px;">${escapeHtml(input.event.title)}</td></tr>
                  <tr><td style="padding:14px 18px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Venue</td><td style="padding:14px 18px;border-bottom:1px solid #1e293b;color:#f8fafc;font-size:14px;">${escapeHtml(input.event.venue)}</td></tr>
                  <tr><td style="padding:14px 18px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date &amp; time</td><td style="padding:14px 18px;border-bottom:1px solid #1e293b;color:#f8fafc;font-size:14px;">${escapeHtml(when)}</td></tr>
                  <tr><td style="padding:14px 18px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Ticket ID</td><td style="padding:14px 18px;color:#22d3ee;font-size:14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(input.ticket.code)}</td></tr>
                </table>

                <div style="margin:26px 0;text-align:center;background:#ffffff;border-radius:16px;padding:18px;">
                  <img src="${input.qrDataUrl}" width="220" height="220" alt="Ticket QR code" style="display:block;margin:0 auto;width:220px;height:220px;" />
                  <p style="margin:12px 0 0;color:#0f172a;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Scan at the entrance</p>
                </div>

                <p style="margin:0 0 10px;color:#cbd5e1;font-size:14px;font-weight:600;">Entry instructions</p>
                <ul style="margin:0 0 22px;padding-left:20px;color:#cbd5e1;font-size:14px;line-height:1.7;">
                  <li>Arrive 10 minutes early and open your ticket on your phone (or use the QR above).</li>
                  <li>One ticket = one entry. Re-scanning the same QR is rejected automatically.</li>
                  <li>Tickets are cryptographically signed — screenshots of altered codes will not work.</li>
                  <li>Carry your campus ID if the venue requests additional verification.</li>
                </ul>

                <a href="${input.ticketUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-size:14px;font-weight:600;">View my digital ticket</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #1e293b;color:#64748b;font-size:12px;line-height:1.6;">
                This is an automated confirmation from ${escapeHtml(env.appName)}. Ticket ID ${escapeHtml(input.ticket.code)} was issued to ${escapeHtml(input.to)}.
                If you did not register for this event, you can ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends the confirmation email through Resend.
 *
 * If RESEND_API_KEY / EMAIL_FROM are not configured (or EMAIL_MOCK_MODE=true)
 * the email is logged instead of sent so registration never fails because of
 * missing mail credentials.
 */
export async function sendTicketConfirmationEmail(
  input: TicketEmailInput,
): Promise<EmailOutcome> {
  const subject = `Your Ticket Confirmation - ${input.event.title}`;
  const html = buildTicketEmailHtml(input);

  let outcome: EmailOutcome;

  if (env.emailMockMode) {
    console.info(
      `[mailer:mock] to=${input.to} subject="${subject}" ticket=${input.ticket.code}` +
        ` (set RESEND_API_KEY + EMAIL_FROM to send real mail)`,
    );
    outcome = { status: "MOCKED", providerMessageId: null, error: null };
  } else {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.emailFrom,
          to: [input.to],
          subject,
          html,
          attachments: [
            {
              filename: `ticket-${input.ticket.code}.png`,
              content: input.qrPngBase64,
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend responded ${response.status}: ${body.slice(0, 300)}`);
      }

      const payload = (await response.json()) as { id?: string };
      outcome = { status: "SENT", providerMessageId: payload.id ?? null, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown mailer error";
      console.error("[mailer] failed to send confirmation email:", message);
      outcome = { status: "FAILED", providerMessageId: null, error: message };
    }
  }

  // Persist an audit row — never let mailer bookkeeping break registration.
  try {
    await db.insert(emailLogs).values({
      toEmail: input.to,
      subject,
      status: outcome.status,
      provider: env.emailMockMode ? "mock" : "resend",
      providerMessageId: outcome.providerMessageId ?? null,
      error: outcome.error ?? null,
      ticketId: input.ticket.id,
      html: env.emailMockMode ? html : null,
    });
  } catch (err) {
    console.error("[mailer] could not write email log:", err);
  }

  return outcome;
}
