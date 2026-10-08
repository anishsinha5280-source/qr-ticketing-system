"use client";

import { useState, type FormEvent } from "react";

import { Icon } from "@/components/icons";
import { Alert, Card, Spinner } from "@/components/ui";
import { useAuth } from "@/components/auth-context";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { SessionUserDto } from "@/lib/types";

export function ProfileForm({ user }: { user: SessionUserDto }) {
  const { refresh } = useAuth();
  const [name, setName] = useState(user.name);
  const [studentId, setStudentId] = useState(user.studentId ?? "");
  const [profileMsg, setProfileMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyProfile, setBusyProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyPw, setBusyPw] = useState(false);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusyProfile(true);
    setProfileMsg(null);
    try {
      await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: { name, studentId: studentId.trim() === "" ? null : studentId.trim() },
      });
      await refresh();
      setProfileMsg({ tone: "success", text: "Profile updated." });
    } catch (err) {
      setProfileMsg({
        tone: "error",
        text: err instanceof ApiClientError ? err.message : "Could not update profile",
      });
    } finally {
      setBusyProfile(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setBusyPw(true);
    setPwMsg(null);
    try {
      await apiFetch("/api/auth/password", {
        method: "PUT",
        body: { currentPassword, newPassword },
      });
      setPwMsg({ tone: "success", text: "Password changed. Use it the next time you sign in." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwMsg({
        tone: "error",
        text: err instanceof ApiClientError ? err.message : "Could not change password",
      });
    } finally {
      setBusyPw(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="text-base font-semibold text-white">Personal details</h2>
        <p className="mt-1 text-sm text-slate-500">Shown on your tickets and to gate organizers.</p>

        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          {profileMsg && <Alert tone={profileMsg.tone}>{profileMsg.text}</Alert>}

          <div>
            <label className="label" htmlFor="profile-name">
              Full name
            </label>
            <input
              id="profile-name"
              className="input"
              value={name}
              minLength={2}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="profile-email">
              Email
            </label>
            <input id="profile-email" className="input opacity-60" value={user.email} disabled />
            <p className="mt-1 text-[11px] text-slate-600">
              Email is the unique account identifier and cannot be changed.
            </p>
          </div>

          {user.role === "STUDENT" && (
            <div>
              <label className="label" htmlFor="profile-student-id">
                Roll number
              </label>
              <input
                id="profile-student-id"
                className="input"
                value={studentId}
                maxLength={40}
                placeholder="CS21B1001"
                onChange={(e) => setStudentId(e.target.value)}
              />
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={busyProfile}>
            {busyProfile ? <Spinner /> : <Icon name="check" className="h-4 w-4" />}
            Save changes
          </button>
        </form>
      </Card>

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-white">Password</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hashed with bcrypt (cost 12). Changing it does not sign you out here.
          </p>

          <form onSubmit={changePassword} className="mt-5 space-y-4">
            {pwMsg && <Alert tone={pwMsg.tone}>{pwMsg.text}</Alert>}

            <div>
              <label className="label" htmlFor="current-password">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                className="input"
                value={currentPassword}
                autoComplete="current-password"
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                className="input"
                value={newPassword}
                minLength={8}
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={busyPw}>
              {busyPw ? <Spinner /> : <Icon name="lock" className="h-4 w-4" />}
              Update password
            </button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-white">Session</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Account role</dt>
              <dd className="font-medium text-slate-200">{user.role}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">User ID</dt>
              <dd className="truncate font-mono text-xs text-slate-400">{user.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Member since</dt>
              <dd className="font-medium text-slate-200">
                {new Date(user.createdAt).toISOString().slice(0, 10)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
