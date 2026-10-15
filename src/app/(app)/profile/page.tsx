import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { PageHeading } from "@/components/ui/page-heading";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Profile",
};

/** Auth-bound page — allow request-time rendering under Cache Components. */
export const instant = false;

function getInitials(fullName: string | null, email: string): string {
  const name = fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const letters = parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "");
    return letters.join("") || "U";
  }
  return (email[0] ?? "U").toUpperCase();
}

async function ProfileContent() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login?next=/profile");
  }

  const userId = claimsData.claims.sub;
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const fullName = profile?.full_name ?? "";

  return (
    <ProfilePanel
      email={email}
      fullName={fullName}
      initials={getInitials(fullName, email)}
    />
  );
}

export default function ProfilePage() {
  return (
    <div className="page-container">
      <PageHeading
        title="Profile"
        description="Your account details and settings."
      />
      <Suspense
        fallback={
          <p className="text-sm text-muted" role="status">
            Loading profile…
          </p>
        }
      >
        <ProfileContent />
      </Suspense>
    </div>
  );
}
