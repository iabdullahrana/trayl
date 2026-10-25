"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
export function InviteFriend({
  from = "",
  to = "",
}: {
  from?: string;
  to?: string;
}) {
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    setStatus("");
    const query = new URLSearchParams({ from, to });
    const url = new URL(
      from || to ? `/search?${query}` : "/",
      window.location.origin,
    ).href;
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied. Send it to someone heading this way.");
    } catch {
      setStatus("Copy the link below to share it.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mt-space-6">
      <h2 className="font-semibold">Invite a friend</h2>
      <p className="mt-space-1 text-small text-deep">
        {from && to
          ? `Know someone travelling from ${from} to ${to}? Invite them.`
          : "Know someone with a journey coming up? Invite them to share their route."}
      </p>
      <Button
        variant="secondary"
        size="sm"
        className="mt-space-3"
        loading={busy}
        onClick={copy}
      >
        Copy invite link
      </Button>
      {link && (
        <label className="mt-space-3 block text-small">
          Share this link
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="mt-space-1 min-h-11 w-full min-w-0 rounded-control border border-sage/30 bg-paper px-space-3"
          />
        </label>
      )}
      <p role="status" className="mt-space-2 text-small text-deep">
        {status}
      </p>
    </Card>
  );
}
