"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { beginLoginOtpAction } from "@/app/actions/otp-auth";
import { FormMessage } from "@/components/auth/form-message";
import {
  authDebugLog,
  createAuthRequestId,
  startTimer,
} from "@/lib/auth/debug-logger";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

function messageForAuthError(code: string | null): string | null {
  if (!code) {
    return null;
  }
  switch (code) {
    case "auth_callback":
    case "exchange_failed":
    case "confirm_failed":
    case "provider_error":
      return "That confirmation link was invalid. Request a new email or try signing in.";
    case "expired":
      return "That confirmation or reset link has expired. Sign up or request a new reset email.";
    case "missing_code":
    case "missing_token":
      return "That link was incomplete. Open the latest email link, or try again.";
    case "auth_confirm":
      return "Email confirmation failed. Open the latest link from your email.";
    default:
      return "Sign-in was invalid or expired. Please try again.";
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeRedirectPath(searchParams.get("next"), "/");
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    messageForAuthError(urlError),
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);

    const requestId = createAuthRequestId();
    authDebugLog({
      event: "login.form_submitted",
      flow: "login",
      stage: "form_submit",
      location: "client",
      requestId,
      status: "started",
    });

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    startTransition(async () => {
      const timer = startTimer();
      const result = await beginLoginOtpAction({ email, password, requestId });

      authDebugLog({
        event: "login.action_response_received",
        flow: "login",
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

      if (result.status !== "authenticated") {
        setError("Unable to sign in. Please try again.");
        return;
      }

      router.replace(next);
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="login-password" className="text-sm font-medium">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-95 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
