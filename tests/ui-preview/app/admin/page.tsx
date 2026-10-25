import { AdminReports } from "@/components/admin-reports";
import { AdminTables } from "@/components/admin-tables";
import { parseAdminFilters } from "@/lib/admin/filters";
import { journey } from "../../data";
export default function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const empty = Boolean(searchParams.empty);
  return (
    <AdminTables
      reports={
        <AdminReports
          currentUserId="admin"
          filters={parseAdminFilters(searchParams)}
          reports={{
            total: empty ? 0 : 1,
            rows: empty
              ? []
              : [
                  {
                    id: "report",
                    request_id: journey.id,
                    message_id: "message",
                    reporter_name: "Reporter",
                    reported_name: "Reported traveller",
                    reported_user_id: "sender",
                    reported_is_active: true,
                    reason:
                      "A report with long explanatory text that should wrap within this table cell.",
                    status: "open",
                    created_at: "2026-10-03T12:00:00Z",
                    message: {
                      body: "A reported message for review.",
                      media_path: null,
                      media_name: null,
                      media_type: null,
                    },
                  },
                ],
          }}
        />
      }
      currentUserId="admin"
      filters={parseAdminFilters(searchParams)}
      users={{
        total: empty ? 0 : 45,
        rows: empty
          ? []
          : [
              {
                id: journey.id,
                name: "User with a longer display name",
                phone: "+92 300 1234567",
                email: "long.contact.address.for.testing@example.com",
                created_at: "2026-09-27T12:00:00Z",
                is_active: true,
              },
            ],
      }}
      journeys={{ total: empty ? 0 : 22, rows: empty ? [] : [journey] }}
      requests={{
        total: empty ? 0 : 21,
        rows: empty
          ? []
          : [
              {
                id: journey.id,
                sender_name: "Sender",
                traveller_name: "Traveller",
                from_city: "Karachi",
                to_city: "Lahore",
                status: "pending",
                created_at: "2026-09-27T12:00:00Z",
              },
            ],
      }}
    />
  );
}
