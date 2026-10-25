"use client";

import { useRef, useState, type ReactNode } from "react";

const tabs = [
  { id: "journeys", label: "My Journeys" },
  { id: "received", label: "Requests Received" },
  { id: "sent", label: "Requests Sent" },
];

export function DashboardTabs({
  journeys,
  received,
  sent,
}: {
  journeys: ReactNode;
  received: ReactNode;
  sent: ReactNode;
}) {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const panels = [journeys, received, sent];
  return (
    <>
      <div
        role="tablist"
        aria-label="Dashboard"
        className="mb-space-6 mt-space-6 flex max-w-full gap-space-1 overflow-x-auto rounded-control border border-deep/30 bg-paper p-space-1"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected === index}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft")
                next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              setSelected(next);
              buttons.current[next]?.focus();
            }}
            className={`min-h-12 shrink-0 whitespace-nowrap rounded-control px-space-4 py-space-3 text-small font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-deep ${selected === index ? "bg-signal text-ink" : "text-deep"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={selected !== index}
          tabIndex={0}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-deep"
        >
          {panels[index]}
        </div>
      ))}
    </>
  );
}
