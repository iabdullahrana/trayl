import { CityCombobox } from "@/components/ui/CityCombobox";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/user";
import { todayUTC } from "@/lib/journeys/validation";
import SignedInHome from "@/components/signed-in-home";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RouteStub } from "@/components/ui/RouteStub";

import { SplitFlap } from "@/components/ui/SplitFlap";

const steps = [
  [
    "Post your journey. Or find one.",
    "Travelling? Share your cities, date and time. Sending a document or small package? Search for someone taking that route.",
  ],
  [
    "Request to connect.",
    "Choose a journey and send a request. You’ll need to log in at this point; browsing is open to everyone.",
  ],
  [
    "Wait for the traveller to accept.",
    "The traveller reviews the request and chooses whether to accept. A request alone doesn’t confirm a handover.",
  ],
  [
    "Talk it through in chat.",
    "Once accepted, your chat opens. Agree on the item, meeting place and handover details before you meet.",
  ],
  [
    "Meet and hand it over.",
    "Meet in a public place. Check the item together and confirm how it will reach the person at the other end.",
  ],
];
const linkFocus = "focus-visible:outline-signal focus-visible:outline-offset-4";
export default async function HomePage() {
  const { user } = await getCurrentUser();
  if (user) return <SignedInHome />;
  return (
    <div className="landing-page bg-paper font-ui text-body text-ink">
      <section
        className="ink-grain bg-ink text-paper"
        aria-labelledby="hero-title"
      >
        <div className="mx-auto max-w-6xl px-space-4 sm:px-space-8">
          <header className="flex min-h-20 flex-wrap items-center justify-between gap-space-2 border-b border-sage/20 py-space-3">
            <Link
              href="/"
              className={`inline-flex min-h-11 items-center font-semibold tracking-tight ${linkFocus}`}
              aria-label="Trayl home"
            >
              Trayl
            </Link>
            <nav
              aria-label="Account"
              className="flex items-center gap-space-2 text-small"
            >
              <Link
                href="/login"
                className={`inline-flex min-h-11 items-center px-space-3 ${linkFocus}`}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className={`inline-flex min-h-11 items-center rounded-control border border-sage/40 px-space-3 ${linkFocus}`}
              >
                Sign up{" "}
                <span aria-hidden="true" className="ml-space-2">
                  ↗
                </span>
              </Link>
            </nav>
          </header>
          <div className="pb-space-16 pt-space-12 sm:py-space-16">
            <p className="mb-space-6 text-small text-sage">
              Documents. Small packages. Journeys already happening.
            </p>
            <h1
              id="hero-title"
              className="max-w-3xl text-display font-semibold tracking-tight"
            >
              Your document needs to go.
              <br />
              <span className="text-signal">Someone’s already going.</span>
            </h1>
            <div className="hero-route my-space-8 max-w-3xl border-y border-sage/30 py-space-6">
              <p className="mb-space-4 text-small text-sage">
                Picture this journey
              </p>
              <RouteStub
                fromContent={<SplitFlap text="LAHORE" />}
                toContent={<SplitFlap text="ISLAMABAD" offset={6} />}
                from="LAHORE"
                to="ISLAMABAD"
                className="hero-route-stub"
              />
              <div className="mt-space-4 flex flex-wrap items-center justify-between gap-space-3">
                <span className="font-mono-data text-mono-data text-paper">
                  Today · 5:30 PM
                </span>
                <span className="text-small text-sage">
                  Illustrative route · not a live listing
                </span>
              </div>
            </div>
            <div className="flex max-w-3xl flex-col justify-between gap-space-6 sm:flex-row sm:items-start">
              <p className="max-w-md text-body text-paper/80">
                Find someone headed the same way. Request to connect, agree on
                the details in chat, and arrange a handover.
              </p>
              <Link
                href="/post-journey"
                className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-space-3 rounded-control bg-signal px-space-6 py-space-3 font-semibold text-ink ${linkFocus}`}
              >
                Post a journey <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section
        id="find-journey"
        aria-labelledby="search-title"
        className="border-b border-deep/15"
      >
        <div className="mx-auto max-w-6xl px-space-4 py-space-12 sm:px-space-8">
          <div className="mb-space-6 flex flex-wrap items-baseline justify-between gap-space-3">
            <h2 id="search-title" className="text-h2 font-semibold">
              Where does it need to go?
            </h2>
            <p className="text-small text-deep">
              Search first. No account needed.
            </p>
          </div>
          <Card>
            <form
              action="/search"
              method="get"
              className="grid min-w-0 gap-space-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
            >
              <label className="flex min-w-0 flex-col gap-space-2 text-small font-semibold">
                From
                <CityCombobox name="from" placeholder="Lahore" />
              </label>
              <label className="flex min-w-0 flex-col gap-space-2 text-small font-semibold">
                To
                <CityCombobox name="to" placeholder="Islamabad" />
              </label>
              <label className="flex min-w-0 flex-col gap-space-2 text-small font-semibold">
                Date
                <input
                  name="date"
                  type="date"
                  defaultValue={todayUTC()}
                  min={todayUTC()}
                  required
                  className="landing-input font-mono-data"
                />
              </label>
              <Button type="submit" className="w-full">
                Search journeys <span aria-hidden="true">→</span>
              </Button>
            </form>
          </Card>
        </div>
      </section>
      <section
        aria-labelledby="how-title"
        className="mx-auto grid max-w-6xl gap-space-8 px-space-4 py-space-16 sm:px-space-8 lg:grid-cols-[1fr_2fr]"
      >
        <div>
          <p className="mb-space-3 text-small text-deep">
            From a route to a handover
          </p>
          <h2 id="how-title" className="text-h1 font-semibold tracking-tight">
            A conversation
            <br />
            comes first.
          </h2>
        </div>
        <ol className="divide-y divide-deep/15 border-y border-deep/15">
          {steps.map(([title, detail], index) => (
            <li
              key={title}
              className="grid grid-cols-[2rem_1fr] gap-space-3 py-space-6 sm:gap-space-6"
            >
              <span
                aria-hidden="true"
                className="text-small font-semibold text-deep"
              >
                0{index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-space-2 text-small text-deep">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section
        aria-labelledby="trust-title"
        className="border-y border-deep/15 bg-deep/5"
      >
        <div className="mx-auto grid max-w-6xl gap-space-8 px-space-4 py-space-12 sm:px-space-8 lg:grid-cols-2">
          <div>
            <p className="mb-space-3 text-small text-deep">
              Know what you can rely on
            </p>
            <h2
              id="trust-title"
              className="text-h1 font-semibold tracking-tight"
            >
              Clear details.
              <br />
              An informed decision.
            </h2>
            <p className="mt-space-4 max-w-md text-deep">
              Use the conversation to ask questions before agreeing to carry or
              hand over an item. Meet in public, and never share OTPs or payment
              details.
            </p>
          </div>
          <dl className="space-y-space-6">
            <div>
              <dt className="font-semibold">In-app chat, after acceptance</dt>
              <dd className="mt-space-2 text-small text-deep">
                Discuss the item and meeting arrangements in your shared chat.
                Reporting and blocking are available if something feels wrong.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">ID verification</dt>
              <dd className="mt-space-2 text-small text-deep">
                ID verification is not available yet. An account or accepted
                request is not proof of someone’s identity.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Ratings</dt>
              <dd className="mt-space-2 text-small text-deep">
                Ratings are not available yet. Ask questions directly; don’t
                assume a profile has a reviewed handover history.
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <footer className="bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-space-4 px-space-4 py-space-8 sm:flex-row sm:items-center sm:justify-between sm:px-space-8">
          <p className="font-semibold">
            Trayl
            <span className="mt-space-1 block text-small font-normal text-sage">
              A little help, along the way.
            </span>
          </p>
          <nav aria-label="Footer" className="flex gap-space-6">
            <Link
              href="/login"
              className={`inline-flex min-h-11 items-center text-small ${linkFocus}`}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className={`inline-flex min-h-11 items-center text-small ${linkFocus}`}
            >
              Sign up
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
