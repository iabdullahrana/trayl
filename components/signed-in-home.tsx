import { CityCombobox } from "@/components/ui/CityCombobox";
import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { getHomeOverview } from "@/lib/home/overview";
import { todayUTC } from "@/lib/journeys/validation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RouteStub } from "@/components/ui/RouteStub";
import { Badge } from "@/components/ui/Badge";
import { RequestControls } from "@/components/request-controls";

export default async function SignedInHome() {
  const { user, profile } = await requireUser();
  const overview = await getHomeOverview(user.id);
  const name = profile?.name.trim() || "traveller";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const inputClass =
    "min-h-11 w-full min-w-0 max-w-full rounded-control border border-deep/30 bg-paper px-space-3 py-space-2 text-body font-normal focus-visible:outline-deep";
  return (
    <section className="home-screen bg-paper px-space-4 py-space-4 font-ui text-body text-ink sm:px-space-6 sm:py-space-6">
      <div className="mx-auto max-w-3xl space-y-space-4">
        <header className="flex items-start justify-between gap-space-3">
          <h1 className="min-w-0 text-display font-semibold tracking-tight">
            Hey {name}
          </h1>
          <Link
            href="/dashboard"
            aria-label={`Open dashboard for ${name}`}
            title={name}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-deep text-small font-semibold text-paper focus-visible:outline-deep"
          >
            <span aria-hidden="true">{initials}</span>
          </Link>
        </header>
        <section aria-label="Your next journey" className="space-y-space-3">
          <form action="/post-journey" method="get">
            <Button type="submit" size="md" className="w-full">
              Post a journey
            </Button>
          </form>
          <form
            action="/search"
            method="get"
            aria-label="Find a journey"
            className="grid min-w-0 grid-cols-2 gap-space-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <label className="flex min-w-0 flex-col gap-space-1 text-small font-medium">
              From
              <CityCombobox name="from" placeholder="Lahore" />
            </label>
            <label className="flex min-w-0 flex-col gap-space-1 text-small font-medium">
              To
              <CityCombobox name="to" placeholder="Islamabad" />
            </label>
            <label className="flex min-w-0 flex-col gap-space-1 text-small font-medium">
              Date
              <input
                name="date"
                type="date"
                defaultValue={todayUTC()}
                required
                className={inputClass}
              />
            </label>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="self-end"
            >
              Search
            </Button>
          </form>
        </section>
        <section aria-labelledby="active-home-title">
          <div className="flex items-center justify-between gap-space-2">
            <h2 id="active-home-title" className="text-body font-semibold">
              Your active journeys
            </h2>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 shrink-0 items-center text-small text-deep underline underline-offset-4"
            >
              View all
            </Link>
          </div>
          {overview.journeysError ? (
            <p role="status" className="text-small text-danger">
              {overview.journeysError}
            </p>
          ) : overview.journeys.length ? (
            <ul className="grid gap-space-2 sm:grid-cols-2">
              {overview.journeys.map((journey) => (
                <li key={journey.id}>
                  <Card variant="row" className="home-compact-card">
                    <RouteStub
                      from={journey.from_city}
                      to={journey.to_city}
                      compact
                    />
                    <div className="mt-space-2 flex flex-wrap items-center justify-between gap-space-1">
                      <span className="font-mono-data text-xs text-deep">
                        {journey.travel_date} ·{" "}
                        {journey.travel_time.slice(0, 5)} UTC
                      </span>
                      <Badge variant="active" className="text-xs">
                        Active
                      </Badge>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-deep">
              You don’t have any journeys posted. Post one to get started.
            </p>
          )}
        </section>
        {overview.requestsError ? (
          <p role="status" className="text-small text-danger">
            {overview.requestsError}{" "}
            <Link
              href="/dashboard/requests-received"
              className="inline-flex min-h-11 items-center underline"
            >
              Requests Received
            </Link>
          </p>
        ) : (
          overview.requests.length > 0 && (
            <section aria-labelledby="pending-home-title">
              <div className="flex flex-wrap items-center justify-between gap-space-2">
                <h2 id="pending-home-title" className="text-body font-semibold">
                  Requests needing a response
                </h2>
                <Link
                  href="/dashboard/requests-received"
                  className="inline-flex min-h-11 items-center text-small text-deep underline underline-offset-4"
                >
                  View all requests
                </Link>
              </div>
              <ul className="grid gap-space-2 sm:grid-cols-2">
                {overview.requests.map((request) => (
                  <li key={request.id}>
                    <Card variant="row" className="home-compact-card">
                      <p className="mb-space-2 break-words text-small font-semibold">
                        {request.senderName}
                      </p>
                      <RouteStub
                        from={request.journeys.from_city}
                        to={request.journeys.to_city}
                        compact
                      />
                      <RequestControls requestId={request.id} compact />
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )
        )}
        <Link
          href="/search"
          className="inline-flex min-h-11 items-center gap-space-2 text-small font-semibold text-deep underline underline-offset-4"
        >
          Explore all journeys <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
