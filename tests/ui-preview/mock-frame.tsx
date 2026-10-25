"use client";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
export function PreviewFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const loggedIn = !["/", "/login", "/signup", "/style-guide"].includes(path);
  return (
    <>
      <main
        id="main-content"
        tabIndex={-1}
        className={`mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 sm:pt-10 ${loggedIn ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "pb-8"}`}
      >
        {children}
      </main>
      {loggedIn && <BottomNav />}
    </>
  );
}
