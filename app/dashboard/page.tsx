import { ListPagination } from "@/components/list-pagination";
import { pageNumber } from "@/lib/pagination";
import { InviteFriend } from "@/components/invite-friend";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { getRequests } from "@/lib/requests/dashboard";
import type { OwnedJourney } from "@/lib/journeys/status";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { MyJourneys } from "@/components/my-journeys";
import { RequestList } from "@/components/request-list";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const journeyPage = pageNumber(searchParams.journeysPage);
  const receivedPage = pageNumber(searchParams.receivedPage);
  const sentPage = pageNumber(searchParams.sentPage);
  const { user } = await requireUser();
  const [journeyResult, received, sent] = await Promise.all([
    createClient()
      .from("journeys")
      .select(
        "id, from_city, to_city, travel_date, travel_time, item_type, status, created_at",
      )
      .eq("traveller_id", user.id)
      .order("travel_date", { ascending: true })
      .order("travel_time", { ascending: true })
      .order("id")
      .range((journeyPage - 1) * 20, journeyPage * 20),
    getRequests("received", receivedPage),
    getRequests("sent", sentPage),
  ]);
  if (journeyResult.error) throw new Error("Unable to load your journeys.");
  return (
    <section className="dashboard-screen bg-paper px-space-4 py-space-6 font-ui text-body text-ink sm:px-space-6 sm:py-space-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-h1 font-semibold tracking-tight">Dashboard</h1>
        <DashboardTabs
          journeys={
            <>
              {" "}
              <MyJourneys
                journeys={
                  (journeyResult.data ?? []).slice(0, 20) as OwnedJourney[]
                }
                now={Date.now()}
              />
              <ListPagination
                page={journeyPage}
                hasMore={(journeyResult.data?.length ?? 0) > 20}
                parameter="journeysPage"
              />
            </>
          }
          received={
            <>
              <RequestList
                requests={received.slice(0, 20)}
                direction="received"
                embedded
              />
              <ListPagination
                page={receivedPage}
                hasMore={received.length > 20}
                parameter="receivedPage"
              />
            </>
          }
          sent={
            <>
              <RequestList
                requests={sent.slice(0, 20)}
                direction="sent"
                embedded
              />
              <ListPagination
                page={sentPage}
                hasMore={sent.length > 20}
                parameter="sentPage"
              />
            </>
          }
        />
        <InviteFriend
          from={journeyResult.data?.[0]?.from_city}
          to={journeyResult.data?.[0]?.to_city}
        />
      </div>
    </section>
  );
}
