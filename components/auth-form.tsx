"use client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useErrorToast } from "@/components/error-toast";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { login, signup } from "@/app/auth-actions";
import type { AuthField, AuthState } from "@/lib/auth/validation";

function SubmitButton({ isSignup }: { isSignup: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      loading={pending}
      loadingText={isSignup ? "Creating account..." : "Logging in..."}
      className="w-full"
    >
      {isSignup ? "Create account" : "Log in"}
    </Button>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [state, action] = useFormState<AuthState, FormData>(
    isSignup ? signup : login,
    {},
  );
  useErrorToast(state);
  const field = (
    name: AuthField,
    label: string,
    type: string,
    autoComplete: string,
    required = true,
  ) => (
    <div>
      <label
        htmlFor={name}
        className="mb-space-2 block text-small font-semibold text-ink"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={name === "password" && isSignup ? 8 : undefined}
        maxLength={
          name === "name"
            ? 100
            : name === "phone"
              ? 30
              : name === "email"
                ? 254
                : 128
        }
        aria-invalid={Boolean(state.fieldErrors?.[name])}
        aria-describedby={
          state.fieldErrors?.[name]
            ? `${name}-error`
            : name === "password" && isSignup
              ? "password-hint"
              : undefined
        }
        className="min-h-12 w-full min-w-0 rounded-control border border-deep/30 bg-paper px-space-3 py-space-3 font-ui text-body text-ink focus-visible:outline-deep aria-[invalid=true]:border-danger"
      />
      {name === "password" && isSignup && (
        <p id="password-hint" className="mt-space-2 text-small text-deep">
          Use at least 8 characters.
        </p>
      )}
      {state.fieldErrors?.[name] && (
        <p id={`${name}-error`} className="mt-space-2 text-small text-danger">
          {state.fieldErrors[name]}
        </p>
      )}
    </div>
  );

  return (
    <div className="auth-screen flex min-h-dvh flex-col bg-paper px-space-4 py-space-4 font-ui text-body text-ink sm:px-space-8">
      <header>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-small font-semibold text-deep underline-offset-4 hover:underline focus-visible:outline-deep"
        >
          Trayl
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center py-space-8">
        <Card
          className="w-full max-w-[420px]"
          role="region"
          aria-labelledby="auth-title"
        >
          <h1 id="auth-title" className="text-h2 font-semibold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-space-2 text-small text-deep">
            {isSignup
              ? "Sign up to start sharing journeys."
              : "Log in with your email and password."}
          </p>
          <form action={action} className="mt-space-6 space-y-space-6">
            {isSignup && field("name", "Name", "text", "name")}
            {field("email", "Email", "email", "email")}
            {field(
              "password",
              "Password",
              "password",
              isSignup ? "new-password" : "current-password",
            )}
            {isSignup &&
              field("phone", "Phone (optional)", "tel", "tel", false)}
            {isSignup && (
              <div>
                <label className="flex min-h-12 cursor-pointer items-start gap-space-3 rounded-control border border-deep/30 p-space-3 text-body font-medium text-ink">
                  <input
                    type="checkbox"
                    name="is_adult_confirmed"
                    required
                    aria-invalid={Boolean(
                      state.fieldErrors?.is_adult_confirmed,
                    )}
                    aria-describedby={
                      state.fieldErrors?.is_adult_confirmed
                        ? "adult-error"
                        : undefined
                    }
                    className="mt-0.5 h-5 w-5 shrink-0 accent-deep focus-visible:outline-deep"
                  />
                  <span>I confirm I am 18 years or older.</span>
                </label>
                {state.fieldErrors?.is_adult_confirmed && (
                  <p
                    id="adult-error"
                    className="mt-space-2 text-small text-danger"
                  >
                    {state.fieldErrors.is_adult_confirmed}
                  </p>
                )}
              </div>
            )}
            <div aria-live="polite" aria-atomic="true">
              {state.error && (
                <p
                  role="alert"
                  className="rounded-control border border-danger/30 bg-danger/5 p-space-3 text-small text-danger"
                >
                  {state.error}
                </p>
              )}
              {state.fieldErrors && (
                <p role="alert" className="text-small text-danger">
                  Please check the highlighted fields.
                </p>
              )}
              {state.success && (
                <p
                  role="status"
                  className="rounded-control border border-signal/30 bg-signal/10 p-space-3 text-small text-deep"
                >
                  {state.success}
                </p>
              )}
            </div>
            {!state.success && <SubmitButton isSignup={isSignup} />}
          </form>
          <p className="mt-space-6 text-center text-small text-deep">
            {isSignup ? "Already have an account? " : "New to Trayl? "}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4 focus-visible:outline-deep"
            >
              {isSignup ? "Log in" : "Create an account"}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
