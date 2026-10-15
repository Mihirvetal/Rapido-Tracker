import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      description="Access your earnings and expense tracker."
    >
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
