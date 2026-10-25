# Delivery moments verification

## Automated evidence

- Application regression tests cover denied access, one-sided completion, separate visible-only milestone claims, relative-time boundaries, private canvas payload and rejected incomplete downloads.
- `supabase/tests/delivery_moments.sql` covers outsider/anonymous access, pending/declined requests, direct write denial, idempotent confirmation, blocks in both directions, inactive accounts, two-person completion, unchanged journey status and exactly-once milestones. Fixtures end in ROLLBACK.
- The new migration and those assertions were executed together in one rollback-only transaction against the linked database. The migration has **not** been deployed by this pass; run `supabase db push` to apply it permanently.
- CSS contrast/motion audit passes. The subsequent post-F8 review ran synthetic-data Chrome viewport and keyboard checks; see DESIGN_REVIEW.md and tests/ui-preview/artifacts for results. Live multi-account and physical-device checks below remain separate.

## Browser checks (375, 768, 1280px)

1. Search: change route/date and see the retained count settle over about 400ms. Check loading rows shimmer quietly, empty ticket art, no incorrect “today” label for other dates. Repeated journeys by one traveller remain honestly labelled journeys, not unique people.
2. Dashboard: verify Posted relative time advances without refresh. Pending request count changes after a decision. Copy the invite link, paste in a logged-out browser, confirm the same route filters with today's default. Deny clipboard permission: selectable fallback must remain available. No account identifier is included.
3. Inbox/nav: send several messages in the other account; unread values interpolate without duplicated spoken intermediate values. Reading them hides zero badges. Relative time continues while visible and updates after returning to the tab.
4. Post a first journey with a fresh account: confirmation pulses once. Repeat, refresh, and use another browser: no repeat pulse. An existing poster's next journey must not celebrate a first. Simulate a failed milestone RPC: journey still reports success with a quiet sync notice.
5. A/B accepted chat: A confirms delivery, download remains locked; refresh. B confirms, both panels show completion within 15 seconds while visible. Repeat confirm calls; original timestamps must stay unchanged. Pending/declined chats remain unavailable. A block in either direction denies confirmation.
6. Open the completed panel: first-handover pulse only once per account, not on subsequent open/close, reload or another delivery. A collapsed panel or hidden tab must not claim it. Download PNG: inspect long city names, route/date, fonts and branding; ensure no personal data. Repeat download; test offline/network failure and retry.
7. Mobile chat: collapsed handover panel stays compact; expanded panel scrolls within its capped height. Composer remains usable with keyboard open. No horizontal page overflow. Keyboard can focus summary, confirm, retry, download, invite and fallback input; all targets remain at least 44px.
8. Primary buttons compress only while pressed (mouse, touch and keyboard), releasing immediately. Secondary/admin buttons do not scale. Grain on hero/chat header should be barely perceptible, with no overlay blocking clicks.
9. Enable reduced motion before loading and toggle it during a count transition: no count tween, press scaling, pulse, route draw or shimmer. All data and actions remain available. Verify no noisy live-region announcements from the relative-time ticker.
10. Navigate away during a pending status/claim request; check console, timer cleanup, no state updates on unmounted components and no extra chat subscriptions.

The PNG is a shareable summary of participant confirmations, not independent proof of delivery or identity verification.
