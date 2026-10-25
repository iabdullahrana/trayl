import { AnimatedCount } from "@/components/ui/AnimatedCount";
import Link from "next/link";
import { RequestTicket } from "@/components/request-ticket";
import { Card } from "@/components/ui/Card";
import type { DashboardRequest } from "@/lib/requests/dashboard";
export function RequestList({
  requests,
  direction,
  embedded = false,
}: {
  requests: DashboardRequest[];
  direction: "received" | "sent";
  embedded?: boolean;
}) {
  const groups = new Map<string, DashboardRequest[]>();
  for (const request of requests)
    groups.set(request.journey_id, [
      ...(groups.get(request.journey_id) ?? []),
      request,
    ]);
  const title =
    direction === "received" ? "Requests Received" : "Requests Sent";
  return (
    <section
      className={
        embedded
          ? ""
          : "dashboard-screen bg-paper px-space-4 py-space-6 font-ui text-body text-ink sm:px-space-6"
      }
      aria-label={title}
    >
      <div className="mx-auto max-w-3xl">
        {!embedded && (
          <Link
            href="/dashboard"
            className="mb-space-4 inline-flex min-h-11 items-center text-small text-deep underline focus-visible:outline-deep"
          >
            Dashboard
          </Link>
        )}
        {embedded ? (
          <h2 className="text-h2 font-semibold">{title}</h2>
        ) : (
          <h1 className="text-h1 font-semibold">{title}</h1>
        )}
        <p className="mt-space-2 text-small text-deep">
          <AnimatedCount
            value={requests.filter((r) => r.status === "pending").length}
          />{" "}
          {direction === "received"
            ? "requests waiting for your response."
            : "requests waiting for a response."}{" "}
          Refresh to see the latest status. Chat and contact details open after
          acceptance.
        </p>
        <div className="mt-space-6 space-y-space-8">
          {!requests.length && (
            <Card>
              <p className="text-deep">
                {direction === "received"
                  ? "No requests yet. People can request to connect when they find your journey."
                  : "You haven’t sent a request yet. Find a journey that fits your route."}
              </p>
            </Card>
          )}
          {Array.from(groups.entries()).map(([id, rows]) => (
            <section
              key={id}
              aria-label={`${rows[0].journey.from_city} to ${rows[0].journey.to_city}`}
            >
              <ul className="space-y-space-4">
                {rows.map((request) => (
                  <li key={request.id}>
                    <RequestTicket request={request} direction={direction} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
