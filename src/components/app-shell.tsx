"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Logo, Spinner } from "@/components/ui";
import { useAuth } from "@/components/auth-context";
import { initials } from "@/lib/format";
import type { Role } from "@/lib/types";

type NavItem = { href: string; label: string; icon: IconName };

const NAV: Record<Role, NavItem[]> = {
  STUDENT: [
    { href: "/dashboard", label: "Dashboard", icon: "grid" },
    { href: "/events", label: "Browse events", icon: "calendar" },
    { href: "/my-events", label: "My events", icon: "ticket" },
    { href: "/profile", label: "Profile", icon: "user" },
  ],
  ORGANIZER: [
    { href: "/organizer/dashboard", label: "Dashboard", icon: "grid" },
    { href: "/organizer/events", label: "Events", icon: "calendar" },
    { href: "/organizer/scanner", label: "QR scanner", icon: "scan" },
    { href: "/organizer/checkins", label: "Check-ins", icon: "list" },
  ],
};

const PUBLIC_NAV: NavItem[] = [{ href: "/events", label: "Browse events", icon: "calendar" }];

export function AppShell({
  role,
  children,
  title,
}: {
  role?: Role;
  children: ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const items = role ? NAV[role] : PUBLIC_NAV;
  const resolvedUser = user;

  async function handleLogout() {
    setSigningOut(true);
    await logout();
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/70 p-5 backdrop-blur lg:flex">
        <Link href={role === "ORGANIZER" ? "/organizer/dashboard" : "/dashboard"}>
          <Logo />
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        {role && (
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Signed in as</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-100">
              {resolvedUser?.name ?? "…"}
            </p>
            <p className="truncate text-xs text-slate-500">{resolvedUser?.email}</p>
            <span className="pill mt-2 border-indigo-500/40 bg-indigo-500/10 text-indigo-300">
              {role === "ORGANIZER" ? "Organizer" : "Student"}
            </span>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/85 px-4 py-3 backdrop-blur lg:px-8">
          <button
            type="button"
            className="btn-ghost -ml-2 px-2 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            <Icon name="list" className="h-5 w-5" />
          </button>

          <div className="lg:hidden">
            <Logo compact />
          </div>

          <p className="hidden text-sm text-slate-500 lg:block">{title ?? ""}</p>

          <div className="ml-auto flex items-center gap-2">
            {resolvedUser ? (
              <>
                <span className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 py-1 pl-1 pr-3 sm:flex">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 text-[11px] font-bold text-white">
                    {initials(resolvedUser.name)}
                  </span>
                  <span className="text-xs font-medium text-slate-300">{resolvedUser.name}</span>
                </span>
                <button
                  type="button"
                  className="btn-secondary px-3 py-2"
                  onClick={handleLogout}
                  disabled={signingOut}
                >
                  {signingOut ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Icon name="logout" className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : loading ? (
              <Spinner className="h-4 w-4 text-slate-500" />
            ) : (
              <Link href="/login" className="btn-primary px-3 py-2">
                Sign in
              </Link>
            )}
          </div>
        </header>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="border-b border-slate-800 bg-slate-950/95 px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <footer className="border-t border-slate-800/60 px-4 py-5 text-center text-xs text-slate-600 lg:px-8">
          CampusPass · Signed QR ticketing with atomic check-in · Demo credentials are for
          development only
        </footer>
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border border-indigo-500/40 bg-indigo-500/10 text-white"
          : "border border-transparent text-slate-400 hover:bg-slate-900/70 hover:text-slate-100"
      }`}
    >
      <Icon name={item.icon} className="h-4.5 w-4.5" />
      {item.label}
      {active && <Icon name="chevronRight" className="ml-auto h-4 w-4 text-indigo-300" />}
    </Link>
  );
}
