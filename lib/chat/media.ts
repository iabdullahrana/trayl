export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
export const MEDIA_TYPES = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "application/pdf": "document",
} as const;
export type MediaKind = "image" | "video" | "document";
export type MediaInput = {
  path: string;
  name: string;
  size: number;
  type: MediaKind;
};
export function validateFile(file: { size: number; type: string }) {
  if (!Object.prototype.hasOwnProperty.call(MEDIA_TYPES, file.type))
    return "Choose a JPEG, PNG, WebP, GIF, MP4, MOV, or PDF file.";
  if (file.size <= 0) return "This file is empty. Please choose another file.";
  if (file.size > MAX_MEDIA_BYTES)
    return "That file is too large. Choose a file up to 15 MB.";
  return null;
}
export function mediaKind(mime: string): MediaKind {
  return MEDIA_TYPES[mime as keyof typeof MEDIA_TYPES];
}
export function sanitizeFilename(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "")
      .slice(-100)
      .replace(/^\.+/, "") || "attachment"
  );
}
export function validMediaPath(
  requestId: string,
  path: unknown,
): path is string {
  return (
    typeof path === "string" &&
    path.startsWith(`${requestId}/`) &&
    /^[0-9a-f-]{36}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,99}$/i.test(
      path,
    )
  );
}
export function validMedia(requestId: string, media: MediaInput) {
  return (
    !!media &&
    validMediaPath(requestId, media.path) &&
    typeof media.name === "string" &&
    media.name.length > 0 &&
    media.name.length <= 100 &&
    ["image", "video", "document"].includes(media.type) &&
    Number.isSafeInteger(media.size) &&
    media.size > 0 &&
    media.size <= MAX_MEDIA_BYTES
  );
}
export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}
export function resizedDimensions(width: number, height: number) {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
