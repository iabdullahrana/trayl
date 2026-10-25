"use server";
import { chatSafetyError } from "@/lib/chat/safety";
import { createClient } from "@/lib/supabase/server";
import { getChatAccess } from "@/lib/chat/server";
import { messageColumns, uuidPattern, type Message } from "@/lib/chat/types";
import { validMedia, validMediaPath, type MediaInput } from "@/lib/chat/media";

export type MediaResult = {
  message?: Message;
  error?: string;
  uploadRemoved?: boolean;
  cleanupPending?: boolean;
};

export async function cleanupMediaUpload(
  requestId: string,
  id: string,
  path: string,
): Promise<MediaResult> {
  if (
    !uuidPattern.test(requestId) ||
    !uuidPattern.test(id) ||
    !validMediaPath(requestId, path)
  )
    return { error: "Invalid attachment." };
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return {
        error: "Please log in again to retry this attachment.",
        cleanupPending: true,
      };
    const lookup = () =>
      supabase
        .from("messages")
        .select(messageColumns)
        .eq("id", id)
        .eq("request_id", requestId)
        .eq("sender_id", user.id)
        .maybeSingle();
    const existing = await lookup();
    if (existing.data?.media_path === path)
      return { message: existing.data as Message };
    // This RPC serializes with media insertion. A claim prevents late inserts;
    // an already committed message prevents the claim. Never delete blindly.
    const claim = await supabase.rpc("prepare_chat_media_cleanup", {
      chat_id: requestId,
      object_path: path,
    });
    if (claim.error || !claim.data) {
      const confirmed = await lookup();
      if (confirmed.data?.media_path === path)
        return { message: confirmed.data as Message };
      return {
        error: "Could not finish attachment cleanup. Reconnect and retry.",
        cleanupPending: true,
      };
    }
    const removed = await supabase.storage.from("chat-media").remove([path]);
    if (removed.error)
      return {
        error:
          "Attachment cleanup is waiting for a connection. Retry when online.",
        cleanupPending: true,
      };
    return { uploadRemoved: true };
  } catch {
    return {
      error:
        "Attachment cleanup is waiting for a connection. Retry when online.",
      cleanupPending: true,
    };
  }
}

export async function sendMediaMessage(
  requestId: string,
  id: string,
  caption: string,
  media: MediaInput,
): Promise<MediaResult> {
  if (
    typeof requestId !== "string" ||
    !uuidPattern.test(requestId) ||
    typeof id !== "string" ||
    !uuidPattern.test(id) ||
    typeof caption !== "string" ||
    Array.from(caption.trim()).length > 2000 ||
    !validMedia(requestId, media)
  )
    return {
      error:
        "Check the attachment and keep its caption under 2,000 characters.",
    };
  let safetyError: string | undefined;
  try {
    const access = await getChatAccess(requestId);
    if (access) {
      const { supabase, user } = access;
      const existing = await supabase
        .from("messages")
        .select(messageColumns)
        .eq("id", id)
        .eq("request_id", requestId)
        .eq("sender_id", user.id)
        .maybeSingle();
      if (
        !existing.error &&
        existing.data?.media_path === media.path &&
        (existing.data.body ?? "") === caption.trim()
      )
        return { message: existing.data as Message };
      if (!existing.error && !existing.data) {
        const { data, error } = await supabase
          .from("messages")
          .insert({
            id,
            request_id: requestId,
            sender_id: user.id,
            body: caption.trim() || null,
            media_path: media.path,
            media_type: media.type,
            media_name: media.name,
            media_size: media.size,
          })
          .select(messageColumns)
          .single();
        if (!error && data) return { message: data as Message };
        safetyError = chatSafetyError(error);
      }
    }
  } catch {
    /* A lost response is reconciled by the serialized cleanup below. */
  }
  const cleanup = await cleanupMediaUpload(requestId, id, media.path);
  if (cleanup.message) return cleanup;
  return {
    ...cleanup,
    error: cleanup.cleanupPending
      ? cleanup.error
      : safetyError ||
        "The attachment wasn't sent. Its upload was removed; retry to upload again.",
  };
}
