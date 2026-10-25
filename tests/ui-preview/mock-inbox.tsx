"use client";
import { useSearchParams } from "next/navigation";
export function useChatInbox() {
  const empty = useSearchParams().get("empty");
  return {
    snapshot: {
      chats: empty
        ? []
        : [
            {
              request_id: "11111111-1111-4111-8111-111111111111",
              other_name: "A traveller with a longer display name",
              from_city: "Jaipur",
              to_city: "Gurgaon",
              travel_date: "2099-10-10",
              last_body: "See you at the station entrance.",
              last_media_type: null,
              last_message_at: "2026-10-03T12:00:00Z",
              activity_at: "2026-10-03T12:00:00Z",
            },
          ],
      unread: empty ? {} : { "11111111-1111-4111-8111-111111111111": 3 },
    },
    error: "",
    refresh() {},
  };
}
