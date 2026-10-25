"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  confirmHandover,
  loadHandover,
  claimHandoverMoment,
} from "@/app/chat/handover-actions";
import type { HandoverSnapshot } from "@/lib/chat/handover";
import { Button } from "@/components/ui/Button";
import { RouteStub } from "@/components/ui/RouteStub";
export function ChatHandover({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const panel = useRef<HTMLDetailsElement>(null);
  const claimed = useRef(false);
  const [delivery, setDelivery] = useState<HandoverSnapshot>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const mounted = useRef(false),
    inFlight = useRef(false);
  const refresh = useCallback(
    async (confirm = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      if (confirm) setConfirming(true);
      try {
        const result = await (confirm
          ? confirmHandover(requestId)
          : loadHandover(requestId));
        if (!mounted.current) return;
        setError(result.error || "");
        setNotice(result.warning || "");
        if (result.handover) {
          setDelivery(result.handover);
          if (result.handover.firstMoment) setCelebrate(true);
        }
      } catch {
        if (mounted.current)
          setError(
            "Couldn’t check the handover. Please retry before confirming again.",
          );
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setBusy(false);
          setConfirming(false);
        }
      }
    },
    [requestId],
  );
  useEffect(() => {
    mounted.current = true;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    tick();
    const timer = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);
  useEffect(() => {
    if (!panel.current) return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const claim = async () => {
      if (
        !open ||
        !visible ||
        !delivery?.completedAt ||
        claimed.current ||
        document.visibilityState !== "visible"
      )
        return;
      claimed.current = true;
      try {
        const result = await claimHandoverMoment(requestId);
        if (!mounted.current) return;
        if (result.error) setNotice(result.error);
        if (result.firstMoment) setCelebrate(true);
      } catch {
        if (mounted.current)
          setNotice("Delivery saved. Your milestone couldn’t sync.");
      }
    };
    void claim();
    document.addEventListener("visibilitychange", claim);
    return () => document.removeEventListener("visibilitychange", claim);
  }, [open, visible, delivery?.completedAt, requestId]);
  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(() => setCelebrate(false), 700);
    return () => clearTimeout(timer);
  }, [celebrate]);
  async function download() {
    if (!delivery) return;
    setDownloading(true);
    setError("");
    try {
      const { downloadDeliveryCard } = await import("@/lib/chat/share-card");
      await downloadDeliveryCard(delivery);
    } catch {
      setError("Couldn’t download your card. Please try again.");
    } finally {
      setDownloading(false);
    }
  }
  return (
    <details
      ref={panel}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="chat-handover mx-space-3 my-space-2 max-h-[40dvh] min-h-11 shrink overflow-y-auto rounded-card border border-sage/30 bg-paper px-space-3"
    >
      <summary className="min-h-11 cursor-pointer py-space-3 text-small font-semibold">
        {delivery?.completedAt
          ? "Handover complete · Your delivery card"
          : delivery?.mine
            ? "Handover · Waiting for their confirmation"
            : "Confirm a handover"}
      </summary>
      <div
        className={`space-y-space-3 pb-space-3 ${celebrate ? "first-moment" : ""}`}
      >
        {!delivery && !error && (
          <p role="status" className="text-small text-deep">
            Checking handover...
          </p>
        )}
        {delivery?.completedAt ? (
          <>
            <RouteStub from={delivery.from} to={delivery.to} compact />
            <p className="font-mono-data text-small">{delivery.date}</p>
            <p className="text-small text-deep">
              {celebrate
                ? "Your first delivery, confirmed by both of you."
                : "Both of you confirmed the handover."}{" "}
              Delivered via Trayl.
            </p>
            <Button
              size="sm"
              variant="secondary"
              loading={downloading}
              onClick={download}
            >
              Download delivery card
            </Button>
            <p className="text-small text-sage">
              Includes your route and date. No names or contact details.
            </p>
          </>
        ) : delivery ? (
          <>
            <p className="text-small text-deep">
              {delivery.mine
                ? "You’ve confirmed. The delivery card unlocks when the other person confirms too."
                : delivery.theirs
                  ? "They’ve confirmed. Has the item reached its recipient?"
                  : "Tap only after the item has reached its recipient. Both people must confirm."}
            </p>
            {!delivery.mine && (
              <Button
                size="sm"
                loading={confirming}
                disabled={busy}
                onClick={() => void refresh(true)}
              >
                Confirm item delivered
              </Button>
            )}
          </>
        ) : null}
        {notice && (
          <p role="status" className="text-small text-deep">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-small text-danger">
            {error}{" "}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Retry status
            </Button>
          </p>
        )}
      </div>
    </details>
  );
}
