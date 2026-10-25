"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  House,
  Plus,
  Search,
  MessageCircle,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { useChatInbox } from "@/components/chat-inbox-provider";
import { LogoutControl } from "@/components/logout-control";

const navigation = [
  { href: "/", label: "Home", short: "Home", Icon: House },
  { href: "/post-journey", label: "Post Journey", short: "Post", Icon: Plus },
  { href: "/search", label: "Search", short: "Search", Icon: Search },
  {
    href: "/messages",
    label: "Messages",
    short: "Messages",
    Icon: MessageCircle,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    short: "Dashboard",
    Icon: LayoutDashboard,
  },
];
export function BottomNav() {
  const pathname = usePathname();
  const { snapshot } = useChatInbox();
  const unread =
    snapshot.hasUnread ||
    Object.values(snapshot.unread).some((count) => count > 0);
  const list = useRef<HTMLUListElement>(null);
  const [highlight, setHighlight] = useState({ x: 0, width: 0 });
  const hidden = pathname.startsWith("/chat/");
  useEffect(() => {
    const node = list.current;
    if (!node) return;
    const measure = () => {
      const active = node.querySelector<HTMLElement>('[aria-current="page"]');
      setHighlight(
        active
          ? { x: active.parentElement!.offsetLeft, width: active.offsetWidth }
          : { x: 0, width: 0 },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [pathname, hidden]);
  if (hidden) return null;
  return (
    <nav aria-label="Main navigation" className="floating-nav">
      <ul ref={list} className="floating-nav-list">
        <li
          aria-hidden="true"
          className="floating-nav-highlight"
          style={{
            width: highlight.width,
            transform: `translateX(${highlight.x}px)`,
            visibility: highlight.width ? "visible" : "hidden",
          }}
        />
        {navigation.map(({ href, label, short, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li
              key={href}
              className={
                active ? "floating-nav-item is-active" : "floating-nav-item"
              }
            >
              <Link
                href={href}
                prefetch={false}
                aria-label={
                  label +
                  (href === "/messages" && unread ? ", unread messages" : "")
                }
                aria-current={active ? "page" : undefined}
                data-press="primary"
                className="floating-nav-link"
              >
                <span
                  className={`relative shrink-0 ${href === "/post-journey" ? "nav-post-icon" : ""}`}
                >
                  <Icon
                    size={20}
                    strokeWidth={href === "/post-journey" ? 2.5 : 1.8}
                    aria-hidden="true"
                  />
                  {href === "/messages" && unread && (
                    <span aria-hidden="true" className="nav-unread-dot" />
                  )}
                </span>
                {active && (
                  <span className="floating-nav-label" aria-hidden="true">
                    {short}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li className="floating-nav-item">
          <LogoutControl compact />
        </li>
      </ul>
    </nav>
  );
}
