"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signOutAction } from "@/app/actions/auth";
import {
  updateProfileAction,
  type ProfileActionState,
} from "@/app/actions/profile";
import { FormMessage } from "@/components/auth/form-message";

interface ProfilePanelProps {
  email: string;
  fullName: string;
  initials: string;
}

const initialState: ProfileActionState = {
  status: "idle",
  message: "",
};

export function ProfilePanel({ email, fullName, initials }: ProfilePanelProps) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState,
  );

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent"
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">
              {fullName || "Your name"}
            </p>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="profile-edit-heading"
        className="rounded-xl border border-border bg-surface p-5"
      >
        <h2
          id="profile-edit-heading"
          className="text-base font-semibold text-foreground"
        >
          Profile details
        </h2>
        <form action={formAction} className="mt-4 space-y-4">
          {state.status === "error" ? (
            <FormMessage tone="error">{state.message}</FormMessage>
          ) : null}
          {state.status === "success" ? (
            <FormMessage tone="success">{state.message}</FormMessage>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              readOnly
              className="min-h-11 rounded-lg border border-border bg-surface-muted px-3 text-base text-muted"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-full-name" className="text-sm font-medium">
              Full name
            </label>
            <input
              id="profile-full-name"
              name="full_name"
              type="text"
              defaultValue={fullName}
              autoComplete="name"
              maxLength={120}
              className="min-h-11 rounded-lg border border-border bg-background px-3 text-base"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:opacity-95 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      <section
        aria-labelledby="account-settings-heading"
        className="rounded-xl border border-border bg-surface p-5"
      >
        <h2
          id="account-settings-heading"
          className="text-base font-semibold text-foreground"
        >
          Account settings
        </h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          <li className="flex min-h-12 items-center justify-between gap-3 py-2">
            <span className="text-foreground">Display currency</span>
            <span className="text-muted">INR (₹)</span>
          </li>
          <li className="flex min-h-12 items-center justify-between gap-3 py-2">
            <span className="text-foreground">Password</span>
            <Link
              href="/forgot-password"
              className="font-medium text-accent hover:underline"
            >
              Reset password
            </Link>
          </li>
          <li className="flex min-h-12 items-center justify-between gap-3 py-2">
            <span className="text-foreground">Sign-in method</span>
            <span className="text-muted">Email &amp; password</span>
          </li>
        </ul>

        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-surface-muted sm:w-auto"
          >
            Log out
          </button>
        </form>
      </section>
    </div>
  );
}
