"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  respondToRequest,
  type RequestState,
} from "@/app/dashboard/request-actions";
import type { DashboardRequest } from "@/lib/requests/dashboard";
import { useErrorToast } from "@/components/error-toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RouteStub } from "@/components/ui/RouteStub";

function DecisionButtons() {
  const { pending, data } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-space-3">
      <Button
        type="submit"
        name="status"
        value="accepted"
        disabled={pending}
        loading={pending && data?.get("status") === "accepted"}
        loadingText="Accepting..."
      >
        Accept
      </Button>
      <Button
        type="submit"
        name="status"
        value="declined"
        variant="secondary"
        disabled={pending}
        loading={pending && data?.get("status") === "declined"}
        loadingText="Declining..."
      >
        Decline
      </Button>
    </div>
  );
}
export function RequestTicket({
  request,
  direction,
}: {
  request: DashboardRequest;
  direction: "received" | "sent";
}) {
  const [decision, setDecision] = useState<"accepted" | "declined" | null>(
    null,
  );
  const [drawing, setDrawing] = useState(false);
  const [justAccepted, setJustAccepted] = useState(false);
  const chatLink = useRef<HTMLAnchorElement>(null);
  const [state, action] = useFormState(
    async (previous: RequestState, form: FormData) => {
      const result = await respondToRequest(previous, form);
      if (result.success) {
        const accepted = form.get("status") === "accepted";
        setDecision(accepted ? "accepted" : "declined");
        if (accepted) {
          setJustAccepted(true);
          setDrawing(
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          );
        }
      }
      return result;
    },
    {},
  );
  useErrorToast(state);
  useEffect(() => {
    if (!drawing) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (preference.matches) setDrawing(false);
    };
    preference.addEventListener("change", stop);
    // Finish even if the user changes tabs while the CSS animation is hidden.
    const timer = window.setTimeout(() => setDrawing(false), 900);
    return () => {
      window.clearTimeout(timer);
      preference.removeEventListener("change", stop);
    };
  }, [drawing]);
  useEffect(() => {
    if (justAccepted && !drawing)
      chatLink.current?.focus({ preventScroll: true });
  }, [justAccepted, drawing]);
  const status = decision ?? request.status;
  return (
    <Card
      className={`request-ticket ${status === "accepted" ? "match-accepted" : ""} ${drawing ? "match-drawing" : ""}`}
    >
      <div className="mb-space-4 flex flex-wrap items-center justify-between gap-space-3">
        <h3 className="min-w-0 break-words font-semibold">
          {request.otherName}
        </h3>
        <Badge variant={status} />
      </div>
      <RouteStub
        from={request.journey.from_city}
        to={request.journey.to_city}
        glyph="none"
        className="request-route"
        onAnimationEnd={(event) => {
          if (event.animationName === "dashboard-match-draw") setDrawing(false);
        }}
      />
      <p className="mt-space-3 font-mono-data text-mono-data text-deep">
        {request.journey.travel_date} ·{" "}
        {request.journey.travel_time.slice(0, 5)} UTC
      </p>
      {direction === "received" && status === "pending" && (
        <form action={action} className="mt-space-6">
          <input type="hidden" name="request_id" value={request.id} />
          <DecisionButtons />
          {state.error && (
            <p role="alert" className="mt-space-3 text-small text-danger">
              {state.error}
            </p>
          )}
        </form>
      )}
      {state.success && (
        <p role="status" className="mt-space-3 text-small text-deep">
          {state.success}
        </p>
      )}
      {status === "accepted" &&
        (drawing ? (
          <p role="status" className="mt-space-4 text-small text-deep">
            Match confirmed.
          </p>
        ) : (
          <div className="mt-space-6">
            <Link
              ref={chatLink}
              href={`/chat/${request.id}`}
              className="inline-flex min-h-12 items-center rounded-control bg-signal px-space-4 py-space-3 font-semibold text-ink focus-visible:outline-deep"
            >
              Open chat
            </Link>
            {request.status === "accepted" && (
              <div className="mt-space-4 border-t border-sage/20 pt-space-4 text-small">
                <h4 className="font-semibold">Contact details</h4>
                {request.contactError ? (
                  <p className="mt-space-2 text-danger">
                    {request.contactError}
                  </p>
                ) : (
                  <dl className="mt-space-3 grid gap-space-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-deep">Phone</dt>
                      <dd className="break-words">
                        {request.contact?.phone || "Not provided"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-deep">Email</dt>
                      <dd className="break-all">
                        {request.contact?.email || "Not provided"}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            )}
          </div>
        ))}
    </Card>
  );
}
