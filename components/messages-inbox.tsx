"use client";
import { Button } from "@/components/ui/Button";
import { RouteStub } from "@/components/ui/RouteStub";
import { Badge } from "@/components/ui/Badge";
import { AnimatedCount } from "@/components/ui/AnimatedCount";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { EmptyTicket } from "@/components/ui/EmptyTicket";
import Link from "next/link";
import { useChatInbox } from "@/components/chat-inbox-provider";
import { messagePreview } from "@/lib/chat/inbox";
export function MessagesInbox() {
  const { snapshot, error, refresh, goToPage, loading } = useChatInbox();
  return (
    <section className="inbox-screen bg-paper px-space-4 py-space-6 font-ui text-body text-ink sm:px-space-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-h1 font-semibold">Messages</h1>
        {error && (
          <div
            role="status"
            className="mt-space-4 rounded-control border border-danger/30 p-space-4 text-danger"
          >
            {error}{" "}
            <button
              onClick={refresh}
              className="min-h-11 px-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}
        {!error && !snapshot.chats.length && (
          <div className="mt-space-6 border-y border-sage/30 py-space-8 text-deep">
            <EmptyTicket />
            <p>No conversations yet. Chats open once a request is accepted.</p>
          </div>
        )}
        <ul className="mt-space-6 divide-y divide-sage/30 border-y border-sage/30">
          {snapshot.chats.map((chat) => (
            <li key={chat.request_id}>
              <Link
                href={`/chat/${chat.request_id}`}
                className="grid min-h-24 grid-cols-[minmax(0,1fr)_auto] items-start gap-space-3 py-space-4 focus-visible:outline-deep"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="break-words font-semibold">
                    {chat.other_name}
                  </h2>
                  <div className="mt-space-2">
                    <RouteStub
                      from={chat.from_city}
                      to={chat.to_city}
                      compact
                    />
                  </div>
                  <p className="mt-space-1 font-mono-data text-mono-data text-deep">
                    {chat.travel_date}
                  </p>
                  <p className="mt-2 truncate text-sm text-deep">
                    {messagePreview(chat)}
                  </p>
                </div>
                <div className="flex max-w-24 shrink-0 flex-col items-end gap-2 text-right">
                  {chat.last_message_at && (
                    <span className="font-mono-data text-xs text-deep">
                      <RelativeTime dateTime={chat.last_message_at} />
                    </span>
                  )}
                  {
                    <span hidden={!(snapshot.unread[chat.request_id] || 0)}>
                      <Badge
                        variant="unread"
                        aria-label={`${snapshot.unread[chat.request_id]} unread messages`}
                      >
                        <AnimatedCount
                          value={snapshot.unread[chat.request_id] || 0}
                        />
                      </Badge>
                    </span>
                  }
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {((snapshot.page ?? 1) > 1 || snapshot.hasMore) && (
          <nav
            aria-label="Conversation pages"
            className="mt-4 flex justify-between gap-3"
          >
            <Button
              variant="secondary"
              disabled={loading || (snapshot.page ?? 1) === 1}
              onClick={() => goToPage((snapshot.page ?? 1) - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={loading || !snapshot.hasMore}
              onClick={() => goToPage((snapshot.page ?? 1) + 1)}
            >
              Next
            </Button>
          </nav>
        )}
        <p className="mt-3 text-xs text-deep">Message times in UTC.</p>
      </div>
    </section>
  );
}
