export function relativeTime(dateTime: string, now: number): string {
  const timestamp = Date.parse(dateTime);
  if (!Number.isFinite(timestamp)) return "Time unavailable";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  const days = Math.floor(seconds / 86400);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
