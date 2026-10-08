/**
 * Shared, dependency-free formatting helpers.
 *
 * All date rendering uses a single fixed timezone (APP_TIMEZONE, default UTC)
 * so that server-rendered HTML and client-rendered HTML always agree — no
 * hydration mismatches. Override with NEXT_PUBLIC_APP_TIMEZONE.
 */

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "UTC";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: DateInput): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

export function formatTime(value: DateInput): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : "—";
}

export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "—";
}

export function formatDateRange(start: DateInput, end: DateInput): string {
  const s = toDate(start);
  const e = toDate(end);
  if (!s) return "—";
  const sameDay = e && e.toISOString().slice(0, 10) === s.toISOString().slice(0, 10);
  if (!e) return `${formatDate(s)} · ${formatTime(s)}`;
  return sameDay
    ? `${formatDate(s)} · ${formatTime(s)} – ${formatTime(e)}`
    : `${formatDate(s)} ${formatTime(s)} → ${formatDate(e)} ${formatTime(e)}`;
}

export function toLocalInputValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function daysUntil(value: DateInput): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export function countdownLabel(value: DateInput): string {
  const days = daysUntil(value);
  if (days === null) return "—";
  if (days < 0) return "Event ended";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 30) return `In ${days} days`;
  const months = Math.round(days / 30);
  return `In ${months} month${months === 1 ? "" : "s"}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}
