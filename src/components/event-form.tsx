"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Icon } from "@/components/icons";
import { Alert, Card, Spinner } from "@/components/ui";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { toLocalInputValue } from "@/lib/format";

export type EventFormValues = {
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  category: string;
  isPublished: boolean;
};

const EMPTY: EventFormValues = {
  title: "",
  description: "",
  venue: "",
  startsAt: "",
  endsAt: "",
  capacity: 100,
  category: "Campus",
  isPublished: true,
};

export function EventForm({
  eventId,
  initial,
  minimumCapacity = 1,
}: {
  eventId?: string;
  initial?: Partial<EventFormValues>;
  minimumCapacity?: number;
}) {
  const router = useRouter();
  const isEdit = Boolean(eventId);
  const [form, setForm] = useState<EventFormValues>({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      title: form.title,
      description: form.description,
      venue: form.venue,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      capacity: Number(form.capacity),
      category: form.category,
      isPublished: form.isPublished,
    };

    try {
      if (isEdit) {
        await apiFetch(`/api/events/${eventId}`, { method: "PUT", body: payload });
        setSaved(true);
        router.refresh();
      } else {
        const data = await apiFetch<{ event: { id: string } }>("/api/events", {
          method: "POST",
          body: payload,
        });
        router.push(`/organizer/events/${data.event.id}`);
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.details) setFieldErrors(err.details as Record<string, string>);
      } else {
        setError("Could not save the event");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-white">
        {isEdit ? "Edit event" : "Create a new event"}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Capacity is enforced by the database and re-checked inside a transaction at registration
        time.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
        {error && <Alert tone="error" title="Could not save">{error}</Alert>}
        {saved && <Alert tone="success">Event updated.</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">
              Event title
            </label>
            <input
              id="title"
              className="input"
              required
              minLength={3}
              maxLength={180}
              value={form.title}
              placeholder="AWS Cloud Career Kickoff"
              onChange={(e) => set("title", e.target.value)}
            />
            <FieldError value={fieldErrors.title} />
          </div>

          <div>
            <label className="label" htmlFor="venue">
              Venue
            </label>
            <input
              id="venue"
              className="input"
              required
              minLength={2}
              maxLength={180}
              value={form.venue}
              placeholder="Main Auditorium, Block A"
              onChange={(e) => set("venue", e.target.value)}
            />
            <FieldError value={fieldErrors.venue} />
          </div>

          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <input
              id="category"
              className="input"
              maxLength={60}
              value={form.category}
              placeholder="Workshop"
              onChange={(e) => set("category", e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="startsAt">
              Starts at
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              className="input"
              required
              value={form.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
            <FieldError value={fieldErrors.startsAt} />
          </div>

          <div>
            <label className="label" htmlFor="endsAt">
              Ends at
            </label>
            <input
              id="endsAt"
              type="datetime-local"
              className="input"
              required
              value={form.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
            />
            <FieldError value={fieldErrors.endsAt} />
          </div>

          <div>
            <label className="label" htmlFor="capacity">
              Total capacity
            </label>
            <input
              id="capacity"
              type="number"
              min={minimumCapacity}
              max={100000}
              className="input"
              required
              value={form.capacity}
              onChange={(e) => set("capacity", Number(e.target.value))}
            />
            <p className="mt-1 text-[11px] text-slate-600">
              Cannot be lower than the number of students already registered
              {minimumCapacity > 1 ? ` (minimum ${minimumCapacity})` : ""}.
            </p>
            <FieldError value={fieldErrors.capacity} />
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-500"
                checked={form.isPublished}
                onChange={(e) => set("isPublished", e.target.checked)}
              />
              <span className="text-sm text-slate-300">Published to students</span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className="input min-h-32"
              required
              minLength={10}
              value={form.description}
              placeholder="What happens at this event, who should come, what to bring…"
              onChange={(e) => set("description", e.target.value)}
            />
            <FieldError value={fieldErrors.description} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Spinner /> : <Icon name={isEdit ? "check" : "plus"} className="h-4 w-4" />}
            {isEdit ? "Save changes" : "Create event"}
          </button>
          {!isEdit && (
            <button type="button" className="btn-secondary" onClick={() => router.back()}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}

function FieldError({ value }: { value?: string }) {
  if (!value) return null;
  return <p className="mt-1 text-xs text-rose-300">{value}</p>;
}

export function defaultEventFormValues(startHourOffsetDays = 7): EventFormValues {
  const start = new Date(Date.now() + startHourOffsetDays * 86_400_000);
  start.setUTCHours(15, 0, 0, 0);
  const end = new Date(start.getTime() + 2.5 * 3_600_000);
  return {
    ...EMPTY,
    startsAt: toLocalInputValue(start),
    endsAt: toLocalInputValue(end),
  };
}
