export const adminSections = [
  "users",
  "journeys",
  "requests",
  "reports",
] as const;
export type AdminSection = (typeof adminSections)[number];
export const statusOptions = {
  users: ["all", "active", "inactive"],
  journeys: ["all", "active", "completed", "cancelled"],
  requests: ["all", "pending", "accepted", "declined"],
  reports: ["all", "open", "reviewed"],
};
export type AdminFilters = Record<
  AdminSection,
  { page: number; status: string; from?: string; to?: string; error?: string }
>;

export function parseAdminFilters(
  params: Record<string, string | string[] | undefined>,
): AdminFilters {
  return Object.fromEntries(
    adminSections.map((section) => {
      const rawPage = params[`${section}_page`];
      const number =
        typeof rawPage === "string" && /^\d+$/.test(rawPage)
          ? Number(rawPage)
          : 1;
      const status = params[`${section}_status`];
      const date = (key: string) => {
        const value = params[key];
        if (!value) return "";
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
          return null;
        const parsed = new Date(`${value}T00:00:00Z`);
        return Number.isFinite(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
          ? value
          : null;
      };
      const from = date(`${section}_from`),
        to = date(`${section}_to`);
      const error =
        from === null || to === null
          ? "Enter a valid start and end date."
          : from && to && from > to
            ? "Start date must be on or before end date."
            : undefined;
      return [
        section,
        {
          from: from ?? "",
          to: to ?? "",
          error,
          page:
            Number.isSafeInteger(number) && number >= 1 && number <= 100000
              ? number
              : 1,
          status:
            typeof status === "string" &&
            statusOptions[section].includes(status)
              ? status
              : "all",
        },
      ];
    }),
  ) as AdminFilters;
}

export function adminQuery(
  filters: AdminFilters,
  section: AdminSection,
  page: number,
) {
  const query = new URLSearchParams();
  for (const name of adminSections) {
    query.set(
      `${name}_page`,
      String(name === section ? page : filters[name].page),
    );
    query.set(`${name}_status`, filters[name].status);
    if (filters[name].from) query.set(`${name}_from`, filters[name].from!);
    if (filters[name].to) query.set(`${name}_to`, filters[name].to!);
  }
  return `/admin?${query}#${section}`;
}
