export type Message = {
  id: string;
  request_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  media_path: string | null;
  read_at?: string | null;
  media_type?: "image" | "video" | "document" | null;
  media_name?: string | null;
  media_size?: number | null;
};
export type Cursor = { id: string; created_at: string };
export type LocalMessage = Message & {
  delivery?: "uploading" | "sending" | "failed";
  uploadProgress?: number;
  localMediaUrl?: string;
};
export const messageColumns =
  "id, request_id, sender_id, body, created_at, media_path, media_type, media_name, media_size, read_at";
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validCursor(value: Cursor) {
  return (
    typeof value?.id === "string" &&
    uuidPattern.test(value.id) &&
    typeof value.created_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value.created_at,
    ) &&
    Number.isFinite(Date.parse(value.created_at))
  );
}
export function mergeMessages(
  current: LocalMessage[],
  incoming: Message[],
): LocalMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    const existing = byId.get(message.id);
    byId.set(message.id, {
      ...message,
      read_at: message.read_at || existing?.read_at || null,
    });
  }
  return [...byId.values()].sort((a, b) => {
    const time = Date.parse(a.created_at) - Date.parse(b.created_at);
    const micros = (value: string) =>
      (value.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0").slice(3, 6);
    return (
      time ||
      micros(a.created_at).localeCompare(micros(b.created_at)) ||
      a.id.localeCompare(b.id)
    );
  });
}
export function dayLabel(timestamp: string, now = new Date()) {
  const date = new Date(timestamp);
  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  if (date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10))
    return "Today";
  if (date.toISOString().slice(0, 10) === yesterday.toISOString().slice(0, 10))
    return "Yesterday";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
