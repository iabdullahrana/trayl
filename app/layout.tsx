import type { Metadata, Viewport } from "next";
import { SessionHistoryGuard } from "@/components/session-history-guard";
import { BottomNav } from "@/components/bottom-nav";
import { getCurrentUser } from "@/lib/auth/user";
import "./globals.css";
import { spaceGrotesk, ibmPlexMono } from "@/lib/fonts";
import { ChatInboxProvider } from "@/components/chat-inbox-provider";
import { loadInbox } from "@/app/messages/actions";
import { ErrorToastProvider } from "@/components/error-toast";

// TODO: Add app/favicon.ico and metadata icons when the Trayl logo is supplied.
export const metadata: Metadata = {
  title: "Trayl",
  description:
    "Trayl connects travellers willing to carry documents or small packages with people who need them sent along the same route.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// The shared layout depends on the current request's authenticated user.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await getCurrentUser();

  const inbox = user ? await loadInbox() : null;
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-dvh">
        {user && <SessionHistoryGuard />}
        <ErrorToastProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:p-3 focus:font-semibold"
          >
            Skip to content
          </a>
          <ChatInboxProvider
            key={user?.id || "guest"}
            userId={user?.id || ""}
            initial={inbox?.snapshot || { chats: [], unread: {} }}
            initialError={inbox?.error}
          >
            <main
              id="main-content"
              tabIndex={-1}
              className={`mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 sm:pt-10 ${user ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-8"}`}
            >
              {children}
            </main>
            {user && <BottomNav />}
          </ChatInboxProvider>
        </ErrorToastProvider>
      </body>
    </html>
  );
}
