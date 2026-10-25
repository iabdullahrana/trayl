"use server";
import { revalidatePath } from "next/cache";
import { getChatAccess } from "@/lib/chat/server";
import { uuidPattern } from "@/lib/chat/types";
import type { ChatSendState } from "@/lib/chat/safety";
export type SafetyResult = { error?: string; success?: string };
export async function loadChatSafety(
  requestId: string,
): Promise<{ state: ChatSendState; error?: string }> {
  try {
    const access = await getChatAccess(requestId);
    if (!access) return { state: "unavailable" };
    const { data, error } = await access.supabase.rpc("chat_send_state", {
      chat_id: requestId,
    });
    if (
      error ||
      !["available", "blocked", "locked", "unavailable"].includes(data)
    )
      throw error;
    return { state: data as ChatSendState };
  } catch {
    return {
      state: "unavailable",
      error: "Unable to check chat availability. Please retry.",
    };
  }
}
export async function reportChat(
  requestId: string,
  messageId: string | null,
  reason: string,
): Promise<SafetyResult> {
  if (
    (messageId !== null &&
      (typeof messageId !== "string" || !uuidPattern.test(messageId))) ||
    typeof reason !== "string" ||
    !reason.trim() ||
    Array.from(reason.trim()).length > 2000
  )
    return { error: "Enter a reason of 1–2,000 characters." };
  try {
    const access = await getChatAccess(requestId);
    if (!access) return { error: "This conversation is not available." };
    // RLS verifies that any supplied message belongs to this same chat.
    const { error } = await access.supabase.from("message_reports").insert({
      request_id: requestId,
      message_id: messageId,
      reporter_id: access.user.id,
      reason: reason.trim(),
    });
    if (error?.code === "23505")
      return { success: "You already have an open report for this item." };
    if (error)
      return { error: "We couldn't submit your report. Please retry." };
    revalidatePath("/admin");
    return { success: "Report submitted for review." };
  } catch {
    return {
      error: "We couldn't submit your report. Check your connection and retry.",
    };
  }
}
export async function blockChatUser(requestId: string): Promise<SafetyResult> {
  try {
    const access = await getChatAccess(requestId);
    if (!access) return { error: "This conversation is not available." };
    const { error } = await access.supabase
      .from("user_blocks")
      .insert({ blocker_id: access.user.id, blocked_id: access.otherId });
    if (error && error.code !== "23505")
      return { error: "We couldn't block this user. Please retry." };
    revalidatePath("/chat/[requestId]", "page");
    return {
      success: "User blocked. Neither of you can send messages to the other.",
    };
  } catch {
    return {
      error: "We couldn't block this user. Check your connection and retry.",
    };
  }
}
