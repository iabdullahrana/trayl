import { AdminReports, type ReportRow } from "@/components/admin-reports";
import { requireAdmin } from "@/lib/admin/server";
import { adminSections, parseAdminFilters } from "@/lib/admin/filters";
import {
  AdminTables,
  type Page,
  type UserRow,
  type JourneyRow,
  type RequestRow,
} from "@/components/admin-tables";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireAdmin();
  const filters = parseAdminFilters(searchParams);
  const results = await Promise.all(
    adminSections.map((entity) =>
      filters[entity].error
        ? Promise.resolve({ data: { rows: [], total: 0 }, error: null })
        : supabase.rpc(
            entity === "reports"
              ? "admin_reports_filtered"
              : "admin_list_filtered",
            {
              ...(entity === "reports" ? {} : { entity }),
              status_filter: filters[entity].status,
              page_number: filters[entity].page,
              date_from: filters[entity].from || null,
              date_to: filters[entity].to || null,
            },
          ),
    ),
  );
  if (results.some((result) => result.error || !result.data))
    throw new Error("Unable to load admin tables.");
  const users = results[0].data as Page<UserRow>;
  const journeys = results[1].data as Page<JourneyRow>;
  const requests = results[2].data as Page<RequestRow>;
  const reports = results[3].data as Page<ReportRow>;
  reports.rows = await Promise.all(
    reports.rows.map(async (report) => {
      if (report.status !== "open" || !report.message_id) return report;
      const { data, error } = await supabase.rpc("admin_report_message", {
        report_id: report.id,
      });
      if (error) throw new Error("Unable to load reported message content.");
      return { ...report, message: data?.[0] };
    }),
  );
  return (
    <AdminTables
      users={users}
      journeys={journeys}
      requests={requests}
      filters={filters}
      currentUserId={user.id}
      reports={
        <AdminReports
          reports={reports}
          filters={filters}
          currentUserId={user.id}
        />
      }
    />
  );
}
