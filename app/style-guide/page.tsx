import { Button } from "@/components/ui/Button";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { RouteStub } from "@/components/ui/RouteStub";

const swatches = [
  ["Ink", "bg-ink", "text-paper"],
  ["Paper", "bg-paper", "text-ink"],
  ["Signal", "bg-signal", "text-ink"],
  ["Deep", "bg-deep", "text-paper"],
  ["Sage", "bg-sage", "text-ink"],
  ["Amber · pending", "bg-amber", "text-ink"],
  ["Danger · errors", "bg-danger", "text-ink"],
];
const statuses: BadgeStatus[] = [
  "active",
  "pending",
  "accepted",
  "declined",
  "completed",
];
export default function StyleGuidePage() {
  return (
    <div className="space-y-space-12 rounded-card bg-paper p-space-4 font-ui text-body text-ink sm:p-space-8">
      <header className="space-y-space-3">
        <p className="text-small font-semibold">
          Trayl / Design foundation
        </p>
        <h1 className="text-display font-semibold tracking-tight">
          Made for the journey.
        </h1>
        <p>
          Fonts, tokens and reusable primitives. These samples do not submit
          data.
        </p>
      </header>
      <section aria-labelledby="palette" className="space-y-space-4">
        <h2 id="palette" className="text-h2 font-semibold">
          Color palette
        </h2>
        <div className="grid grid-cols-2 gap-space-3 sm:grid-cols-4">
          {swatches.map(([label, bg, fg]) => (
            <div
              key={label}
              className={`rounded-control border border-sage/20 p-space-4 text-small font-semibold ${bg} ${fg}`}
            >
              {label}
            </div>
          ))}
        </div>
        <p className="text-small">
          Amber is reserved for pending states; danger for errors, declines and
          cancellations. Use ink or deep for readable body text on paper.
        </p>
      </section>
      <section aria-labelledby="type" className="space-y-space-4">
        <h2 id="type" className="text-h2 font-semibold">
          Typography
        </h2>
        <p className="text-display">Display / On the way</p>
        <p className="text-h1">H1 / Every journey connects</p>
        <p className="text-h2">H2 / A little closer</p>
        <p className="text-body">
          Body / Space Grotesk for headlines, body copy and UI.
        </p>
        <p className="text-small">
          Small / Supporting copy with room to breathe.
        </p>
        <p className="font-mono-data text-mono-data">
          JAI → DEL · 17:30 · ACCEPTED
        </p>
        <p className="text-small">
          IBM Plex Mono is reserved for route data, times and statuses.
        </p>
      </section>
      <section aria-labelledby="buttons" className="space-y-space-6">
        <h2 id="buttons" className="text-h2 font-semibold">
          Buttons
        </h2>
        {(["primary", "secondary", "ghost"] as const).map((variant) => (
          <div key={variant} className="space-y-space-3">
            <h3 className="font-semibold capitalize">{variant}</h3>
            <div className="flex flex-wrap items-center gap-space-3">
              {(["sm", "md", "lg"] as const).map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {variant} · {size}
                </Button>
              ))}
              <Button variant={variant} loading loadingText="Working...">
                Continue
              </Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
            </div>
          </div>
        ))}
        <p className="text-small">
          Tab through buttons to inspect focus rings. All sizes have a minimum
          44px touch target.
        </p>
      </section>
      <section aria-labelledby="badges" className="space-y-space-4">
        <h2 id="badges" className="text-h2 font-semibold">
          Status badges
        </h2>
        <div className="flex flex-wrap gap-space-3">
          {statuses.map((variant) => (
            <Badge key={variant} variant={variant} />
          ))}
        </div>
      </section>
      <section aria-labelledby="routes" className="space-y-space-4">
        <h2 id="routes" className="text-h2 font-semibold">
          Route stubs
        </h2>
        <Card className="space-y-space-6">
          <RouteStub from="JAIPUR" to="GURGAON" />
          <RouteStub from="JAI" to="DEL" glyph="arrow" />
          <RouteStub from="Mumbai" to="Bengaluru" glyph="plane" />
          <RouteStub
            from="Thiruvananthapuram"
            to="Visakhapatnam"
            glyph="arrow"
          />
        </Card>
      </section>
      <section aria-labelledby="cards" className="space-y-space-4">
        <h2 id="cards" className="text-h2 font-semibold">
          Cards and shape
        </h2>
        <div className="grid gap-space-4 sm:grid-cols-2">
          <Card className="space-y-space-4">
            <h3 className="text-h2 font-semibold">A ticket, simply framed.</h3>
            <RouteStub from="JAIPUR" to="GURGAON" glyph="arrow" />
            <div className="flex flex-wrap items-center gap-space-3">
              <span className="font-mono-data text-mono-data">
                12 OCT · 17:30
              </span>
              <Badge variant="active" />
            </div>
          </Card>
          <Card className="space-y-space-3">
            <h3 className="text-h2 font-semibold">Quiet edges</h3>
            <p>
              Cards use a 12px radius and a 1px sage border at 20% opacity, with
              no shadow. Buttons use a tighter 4px radius. Status pills alone
              use a fully rounded silhouette.
            </p>
            <Button variant="secondary">Control radius</Button>
          </Card>
        </div>
      </section>
      <section aria-labelledby="spacing" className="space-y-space-4">
        <h2 id="spacing" className="text-h2 font-semibold">
          Spacing
        </h2>
        <p>
          4, 8, 12, 16, 24, 32, 48 and 64px. Use the space-* tokens for padding,
          gaps and margins.
        </p>
        <p className="text-small">
          Reduced-motion preferences apply globally. This foundation adds no
          animations.
        </p>
      </section>
    </div>
  );
}
