"use server";
import { chatSafetyError } from "@/lib/chat/safety";
import { getChatAccess } from "@/lib/chat/server";
import {
  messageColumns,
  uuidPattern,
  validCursor,
  type Cursor,
  type Message,
} from "@/lib/chat/types";

export async function sendMessage(
  requestId: string,
  id: string,
  body: string,
): Promise<{ message?: Message; error?: string }> {
  if (
    typeof id !== "string" ||
    !uuidPattern.test(id) ||
    typeof body !== "string" ||
    !body.trim() ||
    Array.from(body.trim()).length > 2000
  )
    return { error: "Enter a message of 1–2000 characters." };
  try {
    const access = await getChatAccess(requestId);
    if (!access) return { error: "This chat is no longer available." };
    const { supabase, user } = access;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        id,
        request_id: requestId,
        sender_id: user.id,
        body: body.trim(),
      })
      .select(messageColumns)
      .single();
    if (!error && data) return { message: data as Message };
    // A timed-out response may have committed. Return only the caller's exact
    // original message, even if the chat was blocked/locked or rate-limited
    // since it committed. Never overwrite an ID or another user's row.
    if (error?.code === "23505" || chatSafetyError(error)) {
      const existing = await supabase
        .from("messages")
        .select(messageColumns)
        .eq("id", id)
        .eq("request_id", requestId)
        .eq("sender_id", user.id)
        .maybeSingle();
      if (!existing.error && existing.data?.body === body.trim())
        return { message: existing.data as Message };
    }
    return {
      error:
        chatSafetyError(error) ||
        "Message could not be confirmed. Retry to send it safely.",
    };
  } catch {
    return { error: "Connection failed. Retry to send your message." };
  }
}

export async function loadMessages(
  requestId: string,
  cursor?: Cursor,
  direction: "before" | "after" = "before",
): Promise<{ messages?: Message[]; hasMore?: boolean; error?: string }> {
  if (
    (cursor && !validCursor(cursor)) ||
    !["before", "after"].includes(direction)
  )
    return { error: "Invalid message cursor." };
  try {
    const access = await getChatAccess(requestId);
    if (!access) return { error: "This chat is no longer available." };
    const ascending = direction === "after";
    let query = access.supabase
      .from("messages")
      .select(messageColumns)
      .eq("request_id", requestId)
      .order("created_at", { ascending })
      .order("id", { ascending })
      .limit(51);
    if (cursor) {
      const op = ascending ? "gt" : "lt";
      query = query.or(
        `created_at.${op}.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.${op}.${cursor.id})`,
      );
    }
    const { data, error } = await query;
    if (error) return { error: "Unable to load messages. Please try again." };
    const rows = (data ?? []) as Message[];
    const page = rows.slice(0, 50);
    return {
      messages: ascending ? page : page.reverse(),
      hasMore: rows.length > 50,
    };
  } catch {
    return {
      error: "Unable to load messages. Check your connection and retry.",
    };
  }
}

// Only the authenticated recipient's unread rows can be updated. RLS and the
// column-level read_at grant independently enforce the same rule in Postgres.
export async function markChatRead(
  requestId: string,
): Promise<{ readAt?: string; error?: string }> {
  try {
    const access = await getChatAccess(requestId);
    if (!access) return { error: "This chat is no longer available." };
    const readAt = new Date().toISOString();
    const { error } = await access.supabase
      .from("messages")
      .update({ read_at: readAt })
      .eq("request_id", requestId)
      .neq("sender_id", access.user.id)
      .is("read_at", null)
      .lte("created_at", readAt);
    if (error) return { error: "Unable to mark messages read. Please retry." };
    return { readAt };
  } catch {
    return { error: "Unable to mark messages read. Check your connection." };
  }
}
