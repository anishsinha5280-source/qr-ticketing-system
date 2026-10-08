import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";

/* ---------------------------------------------------------------- */
/* Brand                                                            */
/* ---------------------------------------------------------------- */

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-white shadow-lg shadow-indigo-900/40">
        <Icon name="ticket" className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-tight text-white">CampusPass</span>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Ticketing
          </span>
        </span>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Surfaces                                                         */
/* ---------------------------------------------------------------- */

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={`card ${hover ? "card-hover" : ""} ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-800 bg-slate-900 text-indigo-300">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: IconName;
  tone?: "indigo" | "emerald" | "amber" | "cyan" | "rose";
}) {
  const tones: Record<string, string> = {
    indigo: "text-indigo-300 bg-indigo-500/10 border-indigo-500/30",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    amber: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    cyan: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
    rose: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl border ${tones[tone]}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

export function ProgressBar({
  value,
  tone = "indigo",
  className = "",
}: {
  value: number;
  tone?: "indigo" | "emerald" | "amber" | "rose";
  className?: string;
}) {
  const tones: Record<string, string> = {
    indigo: "bg-gradient-to-r from-indigo-500 to-violet-400",
    emerald: "bg-gradient-to-r from-emerald-500 to-teal-400",
    amber: "bg-gradient-to-r from-amber-500 to-orange-400",
    rose: "bg-gradient-to-r from-rose-500 to-pink-400",
  };
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-800 ${className}`}>
      <div
        className={`h-full rounded-full ${tones[tone]} transition-all duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Status                                                           */
/* ---------------------------------------------------------------- */

export type StatusTone = "emerald" | "amber" | "rose" | "slate" | "indigo" | "cyan";

const STATUS_TONES: Record<StatusTone, string> = {
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  rose: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  slate: "border-slate-600/50 bg-slate-700/20 text-slate-300",
  indigo: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
};

export function Badge({
  children,
  tone = "slate",
  icon,
  className = "",
}: {
  children: ReactNode;
  tone?: StatusTone;
  icon?: IconName;
  className?: string;
}) {
  return (
    <span className={`pill ${STATUS_TONES[tone]} ${className}`}>
      {icon && <Icon name={icon} className="h-3 w-3" />}
      {children}
    </span>
  );
}

export function TicketStatusBadge({ status }: { status: string }) {
  if (status === "VALID")
    return (
      <Badge tone="emerald" icon="checkCircle">
        Valid
      </Badge>
    );
  if (status === "CHECKED_IN")
    return (
      <Badge tone="cyan" icon="qr">
        Checked in
      </Badge>
    );
  if (status === "CANCELLED")
    return (
      <Badge tone="rose" icon="xCircle">
        Cancelled
      </Badge>
    );
  return (
    <Badge tone="amber" icon="alert">
      {status.toLowerCase().replace("_", " ")}
    </Badge>
  );
}

export function Alert({
  tone,
  title,
  children,
  icon,
}: {
  tone: "success" | "warning" | "error" | "info";
  title?: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  const map = {
    success: { cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200", ic: "checkCircle" },
    warning: { cls: "border-amber-500/40 bg-amber-500/10 text-amber-200", ic: "alert" },
    error: { cls: "border-rose-500/40 bg-rose-500/10 text-rose-200", ic: "xCircle" },
    info: { cls: "border-indigo-500/40 bg-indigo-500/10 text-indigo-200", ic: "info" },
  } as const;
  const conf = map[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${conf.cls}`}
    >
      <Icon name={icon ?? conf.ic} className="mt-0.5 h-4.5 w-4.5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "info",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl border border-slate-800 bg-slate-900 text-slate-500">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MetaRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-800 bg-slate-950/60 text-slate-400">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
        <div className="truncate text-sm font-medium text-slate-200">{value}</div>
      </div>
    </div>
  );
}
