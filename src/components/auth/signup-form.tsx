"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { beginSignupAction } from "@/app/actions/otp-auth";
import { FormMessage } from "@/components/auth/form-message";
import {
  authDebugLog,
  createAuthRequestId,
  startTimer,
} from "@/lib/auth/debug-logger";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/errors";

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      event: "signup.form_submitted",
      flow: "signup",
      stage: "form_submit",
      location: "client",
      requestId,
      status: "started",
    });

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    startTransition(async () => {
      const timer = startTimer();
      const result = await beginSignupAction({
        email,
        password,
        fullName,
        requestId,
      });

      authDebugLog({
        event: "signup.action_response_received",
        flow: "signup",
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

      if (result.status === "authenticated") {
        router.replace("/");
        router.refresh();
        return;
      }

      if (result.status === "check_email") {
        setInfo(
          "Account created. Check your email and click the confirmation link from Supabase, then sign in with your password.",
        );
        setPassword("");
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {info ? <FormMessage tone="success">{info}</FormMessage> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-name" className="text-sm font-medium">
          Full name
        </label>
        <input
          id="signup-name"
          name="full_name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
          disabled={Boolean(info)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="signup-email"
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
          disabled={Boolean(info)}
        />
        <p className="text-xs text-muted">
          At least {MIN_PASSWORD_LENGTH} characters. You will confirm via the
          email link Supabase sends.
        </p>
      </div>

      {!info ? (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-95 disabled:opacity-60"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      ) : (
        <Link
          href="/login"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-95"
        >
          Go to sign in
        </Link>
      )}

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
