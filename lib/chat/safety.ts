export type ChatSendState = "available" | "blocked" | "locked" | "unavailable";
export function chatSafetyError(
  error?: { message?: string; code?: string } | null,
) {
  if (error?.message?.includes("CHAT_RATE_LIMIT"))
    return "You can send up to 30 messages per minute. Please wait a minute and try again.";
  if (error?.message?.includes("CHAT_BLOCKED"))
    return "You can't send messages in this chat";
  if (error?.message?.includes("CHAT_LOCKED"))
    return "This chat closed for new messages seven days after the journey. You can still read its history.";
  if (error?.message?.includes("CHAT_UNAVAILABLE"))
    return "You can't send messages in this chat";
  return undefined;
}
