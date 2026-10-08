import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";
import { PageHeader } from "@/components/ui";
import { publicUser } from "@/lib/auth";
import { requirePageUser } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requirePageUser();

  return (
    <AppShell
      role={user.role}
      title="Profile"
    >
      <PageHeader icon="user" title="My profile" subtitle="Manage your details and password." />
      <ProfileForm user={publicUser(user)} />
    </AppShell>
  );
}
