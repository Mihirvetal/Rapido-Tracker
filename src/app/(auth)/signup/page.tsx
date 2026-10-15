import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create account"
      description="Track daily earnings and operating costs."
    >
      <SignupForm />
    </AuthShell>
  );
}
