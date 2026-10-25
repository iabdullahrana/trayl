import "@/app/globals.css";
import { spaceGrotesk, ibmPlexMono } from "@/lib/fonts";
import { ErrorToastProvider } from "@/components/error-toast";
import { PreviewFrame } from "../mock-frame";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-dvh">
        <ErrorToastProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-white focus:p-3"
          >
            Skip to content
          </a>
          <PreviewFrame>{children}</PreviewFrame>
        </ErrorToastProvider>
      </body>
    </html>
  );
}
