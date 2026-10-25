export const journey = {
  id: "11111111-1111-4111-8111-111111111111",
  traveller_id: "owner",
  traveller_name: "A traveller with a longer display name",
  from_city: "Karachi",
  to_city: "Lahore",
  travel_date: "2099-10-10",
  travel_time: "09:30:00",
  item_type: "document" as const,
  status: "active" as const,
};
export const requests = ["pending", "accepted", "declined"].map(
  (status, index) => ({
    id: String(index),
    journey_id: journey.id,
    sender_id: "sender",
    status: status as "pending" | "accepted" | "declined",
    created_at: "2026-09-27T12:00:00Z",
    journey,
    otherName: "A sender with a longer name",
    contact:
      status === "accepted"
        ? {
            phone: "+92 300 1234567",
            email: "long.contact.address.for.testing@example.com",
          }
        : null,
  }),
);
