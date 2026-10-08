"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, Spinner } from "@/components/ui";
import { apiFetch, ApiClientError } from "@/lib/api-client";

export function DeleteEventButton({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/events/${eventId}`, { method: "DELETE" });
      router.push("/organizer/events");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete the event");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
        <Icon name="trash" className="h-4 w-4" />
        Delete event
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-xl border border-rose-800/60 bg-rose-950/30 p-4">
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-sm text-rose-100">
        Delete <span className="font-semibold">{title}</span>? Registrations, tickets and check-in
        history for this event are removed too. This cannot be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-danger" onClick={remove} disabled={busy}>
          {busy ? <Spinner /> : <Icon name="trash" className="h-4 w-4" />}
          Yes, delete permanently
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setConfirming(false)}
          disabled={busy}
        >
          Keep event
        </button>
      </div>
    </div>
  );
}
