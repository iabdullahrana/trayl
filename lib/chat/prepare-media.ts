"use client";
import {
  resizedDimensions,
  sanitizeFilename,
  validateFile,
} from "@/lib/chat/media";
export async function prepareMedia(file: File): Promise<File> {
  const error = validateFile(file);
  if (error) throw new Error(error);
  if (!file.type.startsWith("image/"))
    return new File([file], sanitizeFilename(file.name), { type: file.type });
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const dimensions = resizedDimensions(
      image.naturalWidth,
      image.naturalHeight,
    );
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Unable to prepare this image.")),
        "image/webp",
        0.8,
      ),
    );
    const name =
      sanitizeFilename(file.name.replace(/\.[^.]*$/, "")).slice(0, 90) +
      (blob.type === "image/webp" ? ".webp" : ".png");
    const prepared = new File([blob], name, { type: blob.type });
    const preparedError = validateFile(prepared);
    if (preparedError) throw new Error(preparedError);
    return prepared;
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes("15 MB")
        ? error.message
        : "We couldn't prepare this image. Try a different image.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
