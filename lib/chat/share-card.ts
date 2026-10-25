import type { HandoverSnapshot } from "@/lib/chat/handover";
// No names, contacts, request IDs, remote images, or public storage objects.
export async function downloadDeliveryCard(delivery: HandoverSnapshot) {
  if (!delivery.completedAt)
    throw new Error("Both people must confirm the handover first.");
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Image downloads aren’t supported in this browser.");
  const styles = getComputedStyle(document.body);
  const color = (name: string) => styles.getPropertyValue(`--${name}`).trim();
  context.fillStyle = color("paper");
  context.fillRect(0, 0, 1080, 1350);
  context.fillStyle = color("ink");
  context.fillRect(0, 0, 1080, 190);
  const ui =
    styles.getPropertyValue("--font-space-grotesk").trim() || "sans-serif";
  const mono =
    styles.getPropertyValue("--font-ibm-plex-mono").trim() || "monospace";
  context.fillStyle = color("paper");
  context.font = `500 32px ${ui}`;
  context.fillText("DELIVERY COMPLETE", 80, 112);
  context.strokeStyle = color("deep");
  context.lineWidth = 2;
  context.strokeRect(60, 260, 960, 950);
  context.fillStyle = color("ink");
  const city = (value: string, y: number) => {
    let size = 52;
    let lines: string[] = [];
    do {
      context.font = `500 ${size}px ${mono}`;
      lines = [];
      let line = "";
      for (const char of Array.from(value.toUpperCase())) {
        if (context.measureText(line + char).width > 880) {
          lines.push(line.trim());
          line = char;
        } else line += char;
      }
      if (line) lines.push(line.trim());
      if (lines.length <= 4) break;
      size -= 2;
    } while (size >= 16);
    lines.forEach((text, index) =>
      context.fillText(text, 100, y + index * (size + 10)),
    );
  };
  city(delivery.from, 350);
  context.strokeStyle = color("signal");
  context.lineWidth = 5;
  context.setLineDash([12, 12]);
  context.beginPath();
  context.moveTo(100, 595);
  context.lineTo(980, 595);
  context.stroke();
  context.setLineDash([]);
  city(delivery.to, 680);
  context.font = `400 32px ${mono}`;
  context.fillText(delivery.date, 100, 965);
  context.font = `500 32px ${ui}`;
  context.fillText("Confirmed by both people", 100, 1075);
  context.font = `500 30px ${ui}`;
  context.fillText("Delivered via Trayl", 80, 1280);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Couldn’t create the image. Please try again.")),
      "image/png",
    ),
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `delivery-${delivery.date}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give mobile browsers time to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
