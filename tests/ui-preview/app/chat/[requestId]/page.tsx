import { ChatThread } from "@/components/chat-thread";
import { ChatViewport } from "@/components/chat-viewport";
const requestId = "11111111-1111-4111-8111-111111111111";
export default function Page() {
  return (
    <ChatViewport>
      <ChatThread
        requestId={requestId}
        userId="owner"
        otherId="sender"
        otherName="A traveller with a longer name"
        journeyFrom="Jaipur"
        journeyTo="Gurgaon"
        journeyLabel="10 Oct 2099, 5:30 PM UTC"
        initialSendState="available"
        initialHasMore={true}
        initialMessages={[
          {
            id: "one",
            request_id: requestId,
            sender_id: "sender",
            body: "Let’s meet by the station entrance. Longwordswithoutspacescanalsobesentandshouldneveroverflowthemessagebubble.",
            created_at: "2026-10-03T12:00:00Z",
            read_at: null,
            media_path: null,
            media_type: null,
            media_name: null,
            media_size: null,
          },
          {
            id: "two",
            request_id: requestId,
            sender_id: "owner",
            body: "That works. See you there.",
            created_at: "2026-10-03T12:01:00Z",
            read_at: "2026-10-03T12:02:00Z",
            media_path: null,
            media_type: null,
            media_name: null,
            media_size: null,
          },
          {
            id: "three",
            request_id: requestId,
            sender_id: "sender",
            body: "Meeting point",
            created_at: "2026-10-03T12:03:00Z",
            read_at: null,
            media_path: "preview/ticket.svg",
            media_type: "image",
            media_name: "meeting-point.png",
            media_size: 500,
          },
        ]}
      />
    </ChatViewport>
  );
}
