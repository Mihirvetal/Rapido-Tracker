import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose new password",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      description="Enter a new password for your account."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
