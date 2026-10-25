import { EmptyTicket } from "@/components/ui/EmptyTicket";
import { RelativeTime } from "@/components/ui/RelativeTime";
import Link from "next/link";
import { CancelJourney } from "@/components/cancel-journey";
import { isPastJourney, type OwnedJourney } from "@/lib/journeys/status";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RouteStub } from "@/components/ui/RouteStub";

export function MyJourneys({
  journeys,
  now,
}: {
  journeys: OwnedJourney[];
  now: number;
}) {
  const upcoming = journeys.filter((journey) => !isPastJourney(journey, now));
  const history = journeys
    .filter((journey) => isPastJourney(journey, now))
    .reverse();
  const cards = (rows: OwnedJourney[], past: boolean) => (
    <ul className="space-y-space-4">
      {rows.map((journey) => (
        <li key={journey.id}>
          <Card className={past ? "journey-history-card" : ""}>
            <div className="mb-space-4 flex flex-wrap items-center justify-between gap-space-3">
              <p className="font-mono-data text-mono-data text-deep">
                {journey.travel_date} · {journey.travel_time.slice(0, 5)} UTC
              </p>
              <Badge variant={journey.status}>{journey.status}</Badge>
            </div>
            <RouteStub
              from={journey.from_city}
              to={journey.to_city}
              glyph="arrow"
            />
            <p className="mt-space-4 text-small text-deep">
              {journey.item_type === "document" ? "Document" : "Small Package"}
              {past ? " · Past journey" : ""}
            </p>
            {journey.created_at && (
              <p className="mt-space-2 text-small text-sage">
                <RelativeTime dateTime={journey.created_at} prefix="Posted " />
              </p>
            )}
            {!past && journey.status === "active" && (
              <CancelJourney journeyId={journey.id} />
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="My journeys">
      <div className="mb-space-6 flex flex-wrap items-center justify-between gap-space-3">
        <h2 className="text-h2 font-semibold">My Journeys</h2>
        <Link
          href="/post-journey"
          className="inline-flex min-h-12 items-center rounded-control bg-signal px-space-4 py-space-3 text-small font-semibold text-ink focus-visible:outline-deep"
        >
          Post a journey
        </Link>
      </div>
      {!journeys.length ? (
        <Card>
          <EmptyTicket />
          <p className="text-deep">
            You haven’t posted a journey yet. Share your next route to get
            started.
          </p>
        </Card>
      ) : upcoming.length ? (
        cards(upcoming, false)
      ) : (
        <p className="text-deep">
          No upcoming journeys. Your past routes are in History.
        </p>
      )}
      {history.length > 0 && (
        <details className="mt-space-8 border-t border-sage/30">
          <summary className="min-h-12 cursor-pointer py-space-4 font-semibold text-deep focus-visible:outline-deep">
            History ({history.length})
          </summary>
          <div className="mt-space-3">{cards(history, true)}</div>
        </details>
      )}
    </section>
  );
}
