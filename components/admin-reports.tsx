import { AdminStatus } from "@/components/admin-status";
import { TableSection, type Page } from "@/components/admin-tables";
import { AdminReportAction } from "@/components/admin-report-action";
import type { AdminFilters } from "@/lib/admin/filters";
export type ReportRow = {
  id: string;
  request_id: string;
  message_id: string | null;
  reporter_name: string;
  reported_name: string;
  reported_user_id: string;
  reported_is_active: boolean;
  reason: string;
  status: "open" | "reviewed";
  created_at: string;
  message?: {
    body: string | null;
    media_path: string | null;
    media_name: string | null;
    media_type: string | null;
  };
};
export function AdminReports({
  reports,
  filters,
  currentUserId,
}: {
  reports: Page<ReportRow>;
  filters: AdminFilters;
  currentUserId: string;
}) {
  return (
    <TableSection
      name="reports"
      filters={filters}
      total={reports.total}
      headers={[
        "Reporter / reported user",
        "Reported message",
        "Reason",
        "Status / created",
        "Actions",
      ]}
    >
      {!reports.rows.length && (
        <tr>
          <td colSpan={5} className="text-deep">
            No matching reports on this page.
          </td>
        </tr>
      )}
      {reports.rows.map((report) => (
        <tr key={report.id}>
          <td>
            <p>{report.reporter_name}</p>
            <span
              title={report.id}
              className="block max-w-40 truncate font-mono-data text-xs text-deep"
            >
              {report.id}
            </span>
            <p className="mt-1 text-xs text-deep">
              Reported: {report.reported_name}
            </p>
          </td>
          <td className="max-w-xs">
            {report.status === "reviewed" ? (
              <p className="text-deep">Content access closed after review.</p>
            ) : report.message_id ? (
              <>
                <p className="whitespace-pre-wrap break-words">
                  {report.message?.body ||
                    (report.message?.media_path
                      ? "Attachment"
                      : "Message unavailable")}
                </p>
                {report.message?.media_path && (
                  <a
                    href={`/admin/reports/${report.id}/media`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex min-h-11 items-center text-deep underline"
                  >
                    Open {report.message.media_type || "attachment"}:{" "}
                    {report.message.media_name || "file"}
                  </a>
                )}
              </>
            ) : (
              <p>Conversation report (no individual message selected).</p>
            )}
          </td>
          <td className="max-w-xs whitespace-pre-wrap">{report.reason}</td>
          <td>
            <AdminStatus status={report.status} />
            <time
              className="block font-mono-data text-xs text-deep"
              dateTime={report.created_at}
            >
              {report.created_at.slice(0, 10)} {report.created_at.slice(11, 16)}{" "}
              UTC
            </time>
          </td>
          <td className="space-y-2">
            {report.status === "open" && (
              <>
                <AdminReportAction reportId={report.id} action="review" />
                {report.reported_is_active &&
                  report.reported_user_id !== currentUserId && (
                    <AdminReportAction
                      reportId={report.id}
                      action="deactivate"
                    />
                  )}
                {!report.reported_is_active && <p>User deactivated.</p>}
              </>
            )}
          </td>
        </tr>
      ))}
    </TableSection>
  );
}
