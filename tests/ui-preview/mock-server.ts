import { journey, requests } from "./data";
export async function getCurrentUser() {
  return { user: null, profile: null };
}
export async function requireUser() {
  return { user: { id: "owner" }, profile: { name: "Ali Khan" } };
}
export async function getHomeOverview() {
  return {
    journeys: [
      { ...journey, created_at: new Date(Date.now() - 120000).toISOString() },
    ],
    requests: [
      {
        id: "pending",
        sender_id: "sender",
        senderName: "A sender with a long display name",
        journeys: journey,
      },
    ],
  };
}
export async function getRequests() {
  return requests;
}
export function getSupabaseConfig() {
  return null;
}
export async function searchJourneys(filters: {
  from: string;
  to: string;
  date: string;
}) {
  return {
    journeys:
      filters.from === "NoMatches"
        ? []
        : [
            {
              ...journey,
              from_city: filters.from || journey.from_city,
              to_city: filters.to || journey.to_city,
              travel_date: filters.date,
            },
          ],
  };
}
export function createClient() {
  const query: any = {
    select: () => query,
    eq: () => query,
    order: () => query,
    range: () => query,
    then: (done: any) =>
      Promise.resolve({
        data: [
          {
            ...journey,
            created_at: new Date(Date.now() - 120000).toISOString(),
          },
        ],
        error: null,
      }).then(done),
  };
  return {
    from: () => query,
    auth: { getUser: async () => ({ data: { user: { id: "sender" } } }) },
  };
}
