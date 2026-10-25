export type Conversation = {
  request_id: string;
  other_name: string;
  from_city: string;
  to_city: string;
  travel_date: string;
  last_body: string | null;
  last_media_type: string | null;
  last_message_at: string | null;
  activity_at: string | null;
};
export type InboxSnapshot = {
  page?: number;
  hasMore?: boolean;
  hasUnread?: boolean;
  chats: Conversation[];
  unread: Record<string, number>;
};
export function messagePreview(chat: Conversation) {
  if (chat.last_media_type === "image") return "Photo";
  if (chat.last_media_type === "video") return "Video";
  if (chat.last_media_type === "document") return "Document";
  return chat.last_body || "Say hello to start the conversation.";
}
