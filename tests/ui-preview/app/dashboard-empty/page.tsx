import { MyJourneys } from "@/components/my-journeys";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { RequestList } from "@/components/request-list";
export default function Page() {
  return (
    <section className="dashboard-screen bg-paper px-space-4 py-space-6 font-ui text-body text-ink sm:px-space-6 sm:py-space-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-h1 font-semibold">Dashboard</h1>
        <DashboardTabs
          journeys={<MyJourneys journeys={[]} now={Date.now()} />}
          received={<RequestList direction="received" requests={[]} embedded />}
          sent={<RequestList direction="sent" requests={[]} embedded />}
        />
      </div>
    </section>
  );
}
