import { redirect } from "next/navigation";
import { getChatAccess } from "@/lib/chat/server";
import { loadMessages } from "@/app/chat/actions";
import { loadChatSafety } from "@/app/chat/safety-actions";
import { ChatViewport } from "@/components/chat-viewport";
import { ChatThread } from "@/components/chat-thread";

export default async function ChatPage({
  params,
}: {
  params: { requestId: string };
}) {
  const access = await getChatAccess(params.requestId);
  if (!access) redirect("/dashboard");
  const [name, initial, safety] = await Promise.all([
    access.supabase
      .from("profile_directory")
      .select("name")
      .eq("id", access.otherId)
      .maybeSingle(),
    loadMessages(params.requestId),
    loadChatSafety(params.requestId),
  ]);
  if (name.error || initial.error)
    throw new Error("Unable to load this chat. Please try again.");
  const j = access.journey;
  const departure = new Date(
    `${j.travel_date}T${j.travel_time}Z`,
  ).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return (
    <ChatViewport>
      <ChatThread
        key={params.requestId}
        requestId={params.requestId}
        userId={access.user.id}
        otherId={access.otherId}
        otherName={name.data?.name || "Chat participant"}
        journeyFrom={j.from_city}
        journeyTo={j.to_city}
        journeyLabel={`${departure} UTC`}
        initialMessages={initial.messages ?? []}
        initialSendState={safety.state}
        initialHasMore={initial.hasMore ?? false}
      />
    </ChatViewport>
  );
}
