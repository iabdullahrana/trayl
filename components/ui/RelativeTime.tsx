"use client";
import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/relative-time";
export function RelativeTime({
  dateTime,
  prefix = "",
}: {
  dateTime: string;
  prefix?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    tick();
    const timer = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [dateTime]);
  return (
    <time dateTime={dateTime} title={dateTime}>
      {prefix}
      {now === null ? dateTime.slice(0, 10) : relativeTime(dateTime, now)}
    </time>
  );
}
