"use server";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import type { Conversation, InboxSnapshot } from "@/lib/chat/inbox";

export async function loadInbox(page = 1): Promise<{
  snapshot?: InboxSnapshot;
  error?: string;
}> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return { error: "Please log in to view your messages." };
    const client = createClient();
    const currentPage = Math.max(1, Math.min(100000, Math.floor(page) || 1));
    const offset = (currentPage - 1) * 20;
    const [chatsResult, unreadExists] = await Promise.all([
      client
        .rpc("chat_inbox")
        .order("activity_at", { ascending: false, nullsFirst: false })
        .order("request_id")
        .range(offset, offset + 20),
      client.rpc("unread_counts").gt("unread", 0).limit(1),
    ]);
    if (chatsResult.error || unreadExists.error)
      throw new Error("Inbox unavailable");
    const chats = (chatsResult.data ?? []).slice(0, 20) as Conversation[];
    const unread: Record<string, number> = {};
    if (chats.length) {
      const counts = await client
        .rpc("unread_counts")
        .in(
          "request_id",
          chats.map((chat) => chat.request_id),
        )
        .limit(20);
      if (counts.error) throw counts.error;
      for (const row of counts.data ?? [])
        unread[row.request_id] = Number(row.unread);
    }
    return {
      snapshot: {
        chats,
        unread,
        page: currentPage,
        hasMore: (chatsResult.data?.length ?? 0) > 20,
        hasUnread: Boolean(unreadExists.data?.length),
      },
    };
  } catch {
    return { error: "Unable to load conversations. Please retry." };
  }
}
