import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { events } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { ScannerClient } from "@/components/scanner-client";
import { Icon } from "@/components/icons";
import { Card, PageHeader } from "@/components/ui";
import { requirePageUser } from "@/lib/page-auth";

export const metadata: Metadata = { title: "QR scanner" };
export const dynamic = "force-dynamic";

export default async function ScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageUser("ORGANIZER");

  const rows = await db
    .select({ id: events.id, title: events.title, startsAt: events.startsAt })
    .from(events)
    .where(eq(events.organizerId, user.id))
    .orderBy(events.startsAt);

  const scoped = rows.find((row) => row.id === sp.eventId);

  return (
    <AppShell role="ORGANIZER" title="QR entry scanner">
      <PageHeader
        icon="scan"
        title="QR entry scanner"
        subtitle={
          scoped
            ? `Gate locked to “${scoped.title}” — tokens for other events are rejected.`
            : "Scan attendee QR codes. Signature verification and check-in happen on the server."
        }
        actions={
          <>
            {scoped && (
              <Link href="/organizer/scanner" className="btn-secondary">
                <Icon name="x" className="h-4 w-4" />
                Clear event filter
              </Link>
            )}
            <Link href="/organizer/checkins" className="btn-secondary">
              <Icon name="list" className="h-4 w-4" />
              Check-in history
            </Link>
          </>
        }
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <Icon name="shield" className="h-4 w-4 text-emerald-400" />
            HMAC-SHA256 signature verified server side
          </span>
          <span className="flex items-center gap-2">
            <Icon name="lock" className="h-4 w-4 text-amber-400" />
            Atomic single-use check-in (row lock + conditional update)
          </span>
          <span className="flex items-center gap-2">
            <Icon name="camera" className="h-4 w-4 text-cyan-400" />
            Camera needs HTTPS or localhost
          </span>
        </div>
      </Card>

      <ScannerClient
        events={rows.map((row) => ({ ...row, startsAt: row.startsAt.toISOString() }))}
        defaultEventId={scoped?.id}
      />
    </AppShell>
  );
}
