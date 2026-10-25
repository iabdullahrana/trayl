import Link from "next/link";
import type { ReactNode } from "react";
import {
  adminSections,
  statusOptions,
  adminQuery,
  type AdminFilters,
  type AdminSection,
} from "@/lib/admin/filters";
import { AdminAction } from "@/components/admin-action";
import { Button } from "@/components/ui/Button";
import { AdminStatus } from "@/components/admin-status";

export type UserRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  is_active: boolean;
};
export type JourneyRow = {
  id: string;
  traveller_name: string;
  from_city: string;
  to_city: string;
  travel_date: string;
  travel_time: string;
  status: string;
};
export type RequestRow = {
  id: string;
  sender_name: string;
  traveller_name: string;
  from_city: string;
  to_city: string;
  status: string;
  created_at: string | null;
};
export type Page<T> = { rows: T[]; total: number };
const created = (value: string | null) =>
  value ? `${value.slice(0, 10)} ${value.slice(11, 16)} UTC` : "—";

export function TableSection({
  name,
  filters,
  total,
  headers,
  children,
}: {
  name: AdminSection;
  filters: AdminFilters;
  total: number;
  headers: string[];
  children: ReactNode;
}) {
  const { page, status, from, to, error } = filters[name];
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <section
      id={name}
      className="min-w-0 scroll-mt-4 border-t border-sage/30 py-space-6"
    >
      <div className="mb-space-4 space-y-space-3">
        <h2 className="text-xl font-semibold capitalize">{name}</h2>
        <form
          action={`/admin#${name}`}
          method="get"
          className="flex items-end gap-space-3 overflow-x-auto py-space-2"
        >
          {adminSections
            .filter((section) => section !== name)
            .map((section) => (
              <div key={section} hidden>
                <input
                  type="hidden"
                  name={`${section}_page`}
                  value={filters[section].page}
                />
                <input
                  type="hidden"
                  name={`${section}_status`}
                  value={filters[section].status}
                />
                <input
                  type="hidden"
                  name={`${section}_from`}
                  value={filters[section].from || ""}
                />
                <input
                  type="hidden"
                  name={`${section}_to`}
                  value={filters[section].to || ""}
                />
              </div>
            ))}
          <input type="hidden" name={`${name}_page`} value="1" />
          <label className="shrink-0 text-small">
            <span className="mb-1 block">Status</span>
            <select
              name={`${name}_status`}
              defaultValue={status}
              className="min-h-11 rounded-control border border-deep/30 bg-paper px-space-3 capitalize focus-visible:outline-deep"
            >
              {statusOptions[name].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="shrink-0 text-small">
            <span className="mb-1 block">
              {name === "journeys" ? "Travel from" : "Created from (UTC)"}
            </span>
            <input
              type="date"
              name={`${name}_from`}
              defaultValue={from}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${name}-filter-error` : undefined}
              className="min-h-11 rounded-control border border-deep/30 bg-paper px-3 font-mono-data text-small focus-visible:outline-deep"
            />
          </label>
          <label className="shrink-0 text-small">
            <span className="mb-1 block">Through</span>
            <input
              type="date"
              name={`${name}_to`}
              defaultValue={to}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${name}-filter-error` : undefined}
              className="min-h-11 rounded-control border border-deep/30 bg-paper px-3 font-mono-data text-small focus-visible:outline-deep"
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            className="shrink-0"
          >
            Filter
          </Button>
        </form>
      </div>
      {error && (
        <p
          id={`${name}-filter-error`}
          role="alert"
          className="mb-space-3 text-small text-danger"
        >
          {error}
        </p>
      )}
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={`${name} table`}
      >
        <table className="w-full min-w-[680px] text-left text-sm">
          <caption className="sr-only">
            {name}, page {page}
          </caption>
          <thead className="border-b border-sage/40 text-deep">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-3 py-2 font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-sage/30 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:break-words">
            {children}
          </tbody>
        </table>
      </div>
      <nav
        aria-label={`${name} pagination`}
        className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <p className="font-mono-data text-small">
          {total} rows · Page {page} of {pages}
        </p>
        <div className="flex gap-4">
          {page > 1 && (
            <Link
              className="flex min-h-11 items-center font-medium underline"
              href={adminQuery(filters, name, page - 1)}
            >
              Previous
            </Link>
          )}
          {page < pages && (
            <Link
              className="flex min-h-11 items-center font-medium underline"
              href={adminQuery(filters, name, page + 1)}
            >
              Next
            </Link>
          )}
        </div>
      </nav>
    </section>
  );
}

export function AdminTables({
  users,
  journeys,
  requests,
  filters,
  currentUserId,
  reports,
}: {
  users: Page<UserRow>;
  journeys: Page<JourneyRow>;
  requests: Page<RequestRow>;
  filters: AdminFilters;
  currentUserId: string;
  reports?: ReactNode;
}) {
  const empty = (columns: number) => (
    <tr>
      <td colSpan={columns} className="text-deep">
        No matching rows on this page.
      </td>
    </tr>
  );
  return (
    <section className="admin-screen min-w-0 bg-paper font-ui text-body text-ink">
      <header className="bg-ink px-space-4 py-space-4 text-paper sm:px-space-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-h2 font-semibold">Admin</h1>
          <nav
            aria-label="Admin sections"
            className="mt-space-2 flex gap-space-6 overflow-x-auto"
          >
            {adminSections.map((name) => (
              <Link
                key={name}
                href={`#${name}`}
                className="inline-flex min-h-11 items-center text-small capitalize focus-visible:outline-signal"
              >
                {name}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-space-4 sm:px-space-6">
        <TableSection
          name="users"
          filters={filters}
          total={users.total}
          headers={["Name", "Email", "Phone", "Created", "Status", "Action"]}
        >
          {users.rows.length
            ? users.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.name}
                    <span
                      title={row.id}
                      className="mt-1 block max-w-40 truncate font-mono-data text-xs text-deep"
                    >
                      {row.id}
                    </span>
                  </td>
                  <td>{row.email || "—"}</td>
                  <td>{row.phone || "—"}</td>
                  <td className="font-mono-data text-xs">
                    {created(row.created_at)}
                  </td>
                  <td>
                    <AdminStatus
                      status={row.is_active ? "active" : "inactive"}
                    />
                  </td>
                  <td>
                    {row.is_active && row.id !== currentUserId ? (
                      <AdminAction id={row.id} action="deactivate" />
                    ) : row.id === currentUserId ? (
                      "Your account"
                    ) : (
                      "Deactivated"
                    )}
                  </td>
                </tr>
              ))
            : empty(6)}
        </TableSection>
        <TableSection
          name="journeys"
          filters={filters}
          total={journeys.total}
          headers={["Traveller", "Route", "Date / time", "Status", "Action"]}
        >
          {journeys.rows.length
            ? journeys.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.traveller_name}
                    <span
                      title={row.id}
                      className="mt-1 block max-w-40 truncate font-mono-data text-xs text-deep"
                    >
                      {row.id}
                    </span>
                  </td>
                  <td>
                    {row.from_city} → {row.to_city}
                  </td>
                  <td className="font-mono-data text-xs">
                    {row.travel_date} {row.travel_time.slice(0, 5)}
                  </td>
                  <td>
                    <AdminStatus status={row.status} />
                  </td>
                  <td>
                    {row.status !== "cancelled" ? (
                      <AdminAction id={row.id} action="cancel" />
                    ) : (
                      "Cancelled"
                    )}
                  </td>
                </tr>
              ))
            : empty(5)}
        </TableSection>
        <TableSection
          name="requests"
          filters={filters}
          total={requests.total}
          headers={["Sender", "Traveller", "Route", "Status", "Created"]}
        >
          {requests.rows.length
            ? requests.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.sender_name}
                    <span
                      title={row.id}
                      className="mt-1 block max-w-40 truncate font-mono-data text-xs text-deep"
                    >
                      {row.id}
                    </span>
                  </td>
                  <td>{row.traveller_name}</td>
                  <td>
                    {row.from_city} → {row.to_city}
                  </td>
                  <td>
                    <AdminStatus status={row.status} />
                  </td>
                  <td className="font-mono-data text-xs">
                    {created(row.created_at)}
                  </td>
                </tr>
              ))
            : empty(5)}
        </TableSection>
        {reports}
      </div>
    </section>
  );
}
