"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { beginRecoveryOtpAction } from "@/app/actions/otp-auth";
import { FormMessage } from "@/components/auth/form-message";
import {
  authDebugLog,
  createAuthRequestId,
  startTimer,
} from "@/lib/auth/debug-logger";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
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
    authDebugLog({
      event: "recovery.form_submitted",
      flow: "recovery",
      stage: "form_submit",
      location: "client",
      requestId,
      status: "started",
    });

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    startTransition(async () => {
      const timer = startTimer();
      const result = await beginRecoveryOtpAction({ email, requestId });

      authDebugLog({
        event: "recovery.action_response_received",
        flow: "recovery",
        stage: "server_action",
        location: "client",
        requestId: result.requestId,
        status: result.status === "error" ? "failure" : "success",
        elapsedMs: timer(),
        resultStatus: result.status,
      });

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      setInfo(
        "If an account exists for that email, you will receive a password reset link shortly. Open the link, then choose a new password.",
      );
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {info ? <FormMessage tone="success">{info}</FormMessage> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
          disabled={Boolean(info)}
        />
      </div>

      {!info ? (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-95 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send reset link"}
        </button>
      ) : null}

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
