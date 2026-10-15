"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { completePasswordResetAction } from "@/app/actions/otp-auth";
import { FormMessage } from "@/components/auth/form-message";
import {
  authDebugLog,
  createAuthRequestId,
  startTimer,
} from "@/lib/auth/debug-logger";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/errors";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setInfo(null);

    const requestId = createAuthRequestId();
    const flow = "recovery" as const;
    const location = "client" as const;

    authDebugLog({
      event: "recovery.reset_form_submitted",
      flow,
      stage: "form_submit",
      location,
      requestId,
      status: "started",
    });

    const passwordError = validatePassword(password);
    if (passwordError) {
      authDebugLog({
        event: "recovery.reset_client_validation_failed",
        flow,
        stage: "client_validation",
        location,
        requestId,
        status: "failure",
        reason: "password_policy",
      });
      setError(passwordError);
      return;
    }

    if (password !== confirm) {
      authDebugLog({
        event: "recovery.reset_client_validation_failed",
        flow,
        stage: "client_validation",
        location,
        requestId,
        status: "failure",
        reason: "password_mismatch",
      });
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const timer = startTimer();
      const result = await completePasswordResetAction({ password, requestId });

      authDebugLog({
        event: "recovery.reset_action_response_received",
        flow,
        stage: "server_action",
        location,
        requestId: result.requestId,
        status: result.status === "error" ? "failure" : "success",
        elapsedMs: timer(),
        resultStatus: result.status,
      });

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      setInfo("Password updated. Sign in with your new password.");
      authDebugLog({
        event: "recovery.navigate_login",
        flow,
        stage: "navigation",
        location,
        requestId: result.requestId,
        status: "started",
        destination: "/login",
      });
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {info ? <FormMessage tone="success">{info}</FormMessage> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-password" className="text-sm font-medium">
          New password
        </label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-confirm" className="text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="reset-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
        />
        <p className="text-xs text-muted">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-95 disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update password"}
      </button>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
