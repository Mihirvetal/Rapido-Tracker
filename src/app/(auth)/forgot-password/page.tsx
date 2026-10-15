import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      description="We will email you a secure link to choose a new password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
