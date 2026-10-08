"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Icon } from "@/components/icons";
import { Alert, Card, Spinner } from "@/components/ui";
import { useAuth } from "@/components/auth-context";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { Role, SessionUserDto } from "@/lib/types";

const DEMO = {
  STUDENT: { email: "student@example.com", password: "Student@123" },
  ORGANIZER: { email: "organizer@example.com", password: "Organizer@123" },
} as const;

function Shell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <Icon name="arrowLeft" className="h-4 w-4" />
          Back to home
        </Link>
        <Card className="p-7">
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </Card>
        <div className="mt-5 text-center text-sm text-slate-400">{footer}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Login                                                              */
/* ------------------------------------------------------------------ */

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent, override?: { email: string; password: string }) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ user: SessionUserDto; redirectTo: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: {
            email: override?.email ?? email,
            password: override?.password ?? password,
          },
        },
      );
      await refresh();
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : data.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed");
      setBusy(false);
    }
  }

  async function quickLogin(role: Role) {
    const demo = DEMO[role];
    setEmail(demo.email);
    setPassword(demo.password);
    await submit(new Event("submit") as unknown as FormEvent, demo);
  }

  return (
    <Shell
      title="Welcome back"
      subtitle="Sign in to manage your tickets or scan attendees at the gate."
      footer={
        <>
          New to CampusPass?{" "}
          <Link href="/register" className="font-semibold text-indigo-300 hover:text-indigo-200">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error" title="Could not sign in">{error}</Alert>}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            placeholder="you@campus.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner /> : <Icon name="lock" className="h-4 w-4" />}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          One-click demo access
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="btn-secondary justify-start text-xs"
            onClick={() => void quickLogin("STUDENT")}
            disabled={busy}
          >
            <Icon name="user" className="h-4 w-4 text-indigo-300" />
            student@example.com
          </button>
          <button
            type="button"
            className="btn-secondary justify-start text-xs"
            onClick={() => void quickLogin("ORGANIZER")}
            disabled={busy}
          >
            <Icon name="shield" className="h-4 w-4 text-cyan-300" />
            organizer@example.com
          </button>
        </div>
        <p className="mt-3 text-[11px] text-slate-600">
          Passwords are Student@123 / Organizer@123 — development only.
        </p>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Register                                                           */
/* ------------------------------------------------------------------ */

export function RegisterForm() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    studentId: "",
    role: "STUDENT" as Role,
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const data = await apiFetch<{ user: SessionUserDto; redirectTo: string }>(
        "/api/auth/register",
        { method: "POST", body: form },
      );
      await refresh();
      router.push(data.redirectTo);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.details) setFieldErrors(err.details as Record<string, string>);
      } else {
        setError("Registration failed");
      }
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Create your account"
      subtitle="Students get instant signed QR tickets. Organizers get a scanning dashboard."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-indigo-300 hover:text-indigo-200">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error" title="Could not create account">{error}</Alert>}

        <div>
          <span className="label">I am a</span>
          <div className="grid grid-cols-2 gap-2">
            {(["STUDENT", "ORGANIZER"] as Role[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => set("role", role)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  form.role === role
                    ? "border-indigo-500 bg-indigo-500/15 text-white"
                    : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700"
                }`}
                aria-pressed={form.role === role}
              >
                <Icon name={role === "STUDENT" ? "user" : "shield"} className="h-4 w-4" />
                {role === "STUDENT" ? "Student" : "Organizer"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            className="input"
            required
            minLength={2}
            maxLength={120}
            placeholder="Aarav Sharma"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-rose-300">{fieldErrors.name}</p>}
        </div>

        <div>
          <label className="label" htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            className="input"
            required
            autoComplete="email"
            placeholder="you@campus.edu"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-rose-300">{fieldErrors.email}</p>}
        </div>

        {form.role === "STUDENT" && (
          <div>
            <label className="label" htmlFor="student-id">
              Student / roll number <span className="normal-case text-slate-600">(optional)</span>
            </label>
            <input
              id="student-id"
              className="input"
              maxLength={40}
              placeholder="CS21B1001"
              value={form.studentId}
              onChange={(e) => set("studentId", e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="reg-password">
            Password
          </label>
          <input
            id="reg-password"
            type="password"
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-rose-300">{fieldErrors.password}</p>
          )}
          <p className="mt-1.5 text-[11px] text-slate-600">
            Stored as a bcrypt hash (cost 12) — never in plaintext.
          </p>
        </div>

        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner /> : <Icon name="bolt" className="h-4 w-4" />}
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </Shell>
  );
}
