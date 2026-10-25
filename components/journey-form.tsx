"use client";

import { CityCombobox } from "@/components/ui/CityCombobox";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { postJourney } from "@/app/post-journey/actions";
import { useErrorToast } from "@/components/error-toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RouteStub } from "@/components/ui/RouteStub";
import { Badge } from "@/components/ui/Badge";
import type { JourneyField, JourneyState } from "@/lib/journeys/validation";

function FormFields({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className="min-w-0 space-y-space-6">
      <legend className="sr-only">Journey details</legend>
      {children}
      <Button
        type="submit"
        loading={pending}
        loadingText="Posting journey..."
        className="w-full"
      >
        Post journey
      </Button>
    </fieldset>
  );
}

export function JourneyForm({ today }: { today: string }) {
  const [formKey, setFormKey] = useState(0);
  return (
    <JourneyFormContent
      key={formKey}
      today={today}
      onReset={() => setFormKey((key) => key + 1)}
    />
  );
}

function JourneyFormContent({
  today,
  onReset,
}: {
  today: string;
  onReset: () => void;
}) {
  const [state, action] = useFormState<JourneyState, FormData>(postJourney, {});
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!state.success || !state.firstMoment) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setCelebrating(!preference.matches);
    const stop = () => {
      if (preference.matches) setCelebrating(false);
    };
    preference.addEventListener("change", stop);
    // Remove the class after its one run, so changing preferences cannot replay it.
    const timer = window.setTimeout(() => setCelebrating(false), 700);
    return () => {
      window.clearTimeout(timer);
      preference.removeEventListener("change", stop);
    };
  }, [state.success, state.firstMoment]);
  const [values, setValues] = useState<Record<JourneyField, string>>({
    from_city: "",
    to_city: "",
    travel_date: "",
    travel_time: "",
    item_type: "document",
  });
  useErrorToast(state);
  const ticket = state.journey ?? values;
  const error = (name: JourneyField) =>
    state.fieldErrors?.[name] && (
      <p id={`${name}-error`} className="mt-space-2 text-small text-danger">
        {state.fieldErrors[name]}
      </p>
    );
  const input = (
    name: Exclude<JourneyField, "item_type">,
    label: string,
    type: string,
  ) => (
    <div className="min-w-0">
      <label
        htmlFor={name}
        className="mb-space-2 block text-small font-semibold"
      >
        {label}
      </label>
      {name === "from_city" || name === "to_city" ? (
        <CityCombobox
          id={name}
          name={name}
          required
          value={values[name]}
          placeholder={name === "from_city" ? "Lahore" : "Islamabad"}
          onChange={(city) =>
            setValues((current) => ({ ...current, [name]: city }))
          }
          aria-invalid={Boolean(state.fieldErrors?.[name])}
          aria-describedby={
            state.fieldErrors?.[name] ? `${name}-error` : undefined
          }
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required
          autoComplete="off"
          value={values[name]}
          onChange={(event) =>
            setValues((current) => ({ ...current, [name]: event.target.value }))
          }
          min={type === "date" ? today : undefined}
          max={type === "date" ? "9999-12-31" : undefined}
          maxLength={type === "text" ? 100 : undefined}
          step={type === "time" ? 60 : undefined}

          aria-invalid={Boolean(state.fieldErrors?.[name])}
          aria-describedby={
            [
              state.fieldErrors?.[name] ? `${name}-error` : "",
              type === "date" || type === "time" ? "time-hint" : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className="journey-input min-h-12 w-full min-w-0 max-w-full rounded-control border border-deep/30 bg-paper px-space-3 py-space-3 font-ui text-body text-ink placeholder:text-deep/70 focus-visible:outline-deep aria-[invalid=true]:border-danger"
        />
      )}
      {error(name)}
    </div>
  );
  return (
    <section
      className="journey-screen bg-paper px-space-4 py-space-8 font-ui text-body text-ink sm:px-space-6 sm:py-space-12"
      aria-labelledby="journey-title"
    >
      <div className="mx-auto max-w-[520px]">
        {state.success ? (
          <>
            <div role="status" className="mb-space-6">
              <span
                aria-hidden="true"
                className="mb-space-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-signal text-h2 text-ink"
              >
                ✓
              </span>
              <h1
                id="journey-title"
                className="text-h1 font-semibold tracking-tight"
                tabIndex={-1}
                ref={(node) => node?.focus()}
              >
                {state.firstMoment
                  ? "Your first journey is out there"
                  : "Journey posted"}
              </h1>
              <p className="mt-space-2 text-deep">
                Your journey is active and ready for requests.
              </p>
            </div>
            {state.notice && (
              <p role="status" className="mb-space-3 text-small text-deep">
                {state.notice}
              </p>
            )}
            <Card
              className={`space-y-space-6 ${celebrating ? "first-moment" : ""}`}
            >
              <div className="flex items-center justify-between gap-space-3">
                <p className="text-small font-semibold">Your journey</p>
                <Badge variant="active" />
              </div>
              <RouteStub
                from={ticket.from_city}
                to={ticket.to_city}
                glyph="arrow"
              />
              <div className="border-t border-dashed border-sage/40 pt-space-4">
                <p className="font-mono-data text-mono-data">
                  {ticket.travel_date} · {ticket.travel_time} UTC
                </p>
                <p className="mt-space-2 text-small text-deep">
                  {ticket.item_type === "document"
                    ? "Document"
                    : "Small Package"}
                </p>
              </div>
            </Card>
            <div className="mt-space-6 flex flex-col gap-space-3 sm:flex-row">
              <Button variant="secondary" onClick={onReset} className="flex-1">
                Post another
              </Button>
              <Link
                href="/dashboard"
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-control bg-signal px-space-4 py-space-3 font-semibold text-ink hover:bg-signal/80 focus-visible:outline-deep"
              >
                View my journeys
              </Link>
            </div>
          </>
        ) : (
          <>
            <header className="mb-space-6">
              <p className="mb-space-2 text-small text-deep">
                A little room for someone else
              </p>
              <h1
                id="journey-title"
                className="text-h1 font-semibold tracking-tight"
              >
                Post a journey
              </h1>
              <p className="mt-space-3 text-deep">
                Share where you’re going and what you can carry.
              </p>
            </header>
            <Card className="mb-space-6 space-y-space-4">
              <p className="text-small font-semibold text-deep">
                Your route, taking shape
              </p>
              <RouteStub
                from={values.from_city.trim() || "From city"}
                to={values.to_city.trim() || "To city"}
                glyph="arrow"
              />
              <p className="border-t border-dashed border-sage/40 pt-space-4 font-mono-data text-mono-data text-deep">
                {values.travel_date || "Choose date"} ·{" "}
                {values.travel_time || "Choose time"}
                {values.travel_time ? " UTC" : ""}
              </p>
            </Card>
            <form action={action} noValidate>
              <FormFields>
                {input("from_city", "From city", "text")}
                {input("to_city", "To city", "text")}
                <div className="grid min-w-0 gap-space-6 sm:grid-cols-2">
                  {input("travel_date", "Date", "date")}
                  {input("travel_time", "Time", "time")}
                </div>
                <p id="time-hint" className="text-small text-deep">
                  Enter the date and time in UTC, the time zone used for
                  journeys in this app.
                </p>
                <fieldset
                  aria-describedby={
                    state.fieldErrors?.item_type ? "item_type-error" : undefined
                  }
                  aria-invalid={Boolean(state.fieldErrors?.item_type)}
                >
                  <legend className="mb-space-2 text-small font-semibold">
                    What can you carry?
                  </legend>
                  <div className="grid grid-cols-2 gap-space-1 rounded-control border border-deep/30 p-space-1">
                    {[
                      { value: "document", label: "Document" },
                      { value: "package", label: "Small Package" },
                    ].map(({ value, label }) => (
                      <label
                        key={value}
                        className="relative min-w-0 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="item_type"
                          value={value}
                          checked={values.item_type === value}
                          onChange={() =>
                            setValues((current) => ({
                              ...current,
                              item_type: value,
                            }))
                          }
                          required
                          className="peer sr-only"
                        />
                        <span className="flex min-h-12 items-center justify-center rounded-control px-space-2 py-space-3 text-center text-small font-semibold text-deep peer-checked:bg-signal peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-deep">
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {error("item_type")}
                </fieldset>
                <div aria-live="polite" aria-atomic="true">
                  {state.fieldErrors && (
                    <p role="alert" className="text-small text-danger">
                      {Object.values(state.fieldErrors)[0]}
                    </p>
                  )}
                  {state.error && (
                    <p
                      role="alert"
                      className="rounded-control border border-danger/30 bg-danger/5 p-space-3 text-small text-danger"
                    >
                      {state.error}
                    </p>
                  )}
                </div>
              </FormFields>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
