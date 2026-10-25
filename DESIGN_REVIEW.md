# Final design review after F8

## Result and evidence

The production components were reviewed in headless Chrome at **375 × 812**, **768 × 1024**, and **1280 × 900**. The isolated preview uses the real Tailwind configuration, fonts, layouts and components with synthetic data and mocked server actions. `/home` in this harness represents the authenticated branch of production `/`; it is not a new production route.

The final viewport sweep covers 19 page/state fixtures at each width (57 cases). It measures page scroll width, interactive target bounds and computed focus outlines while actually pressing Tab through the controls. Native checkbox/radio targets are measured using their associated labels. Admin tables/filter bars and dashboard tabs intentionally scroll internally; the document must not scroll horizontally. No remaining sub-44px targets, missing focus outlines or page-wide overflow were found in these fixtures. No uncaught browser page errors were recorded. All 108 application tests and the production build (including lint/type checks) passed.

Separate keyboard interaction checks cover expanded search, dashboard arrow-key selection, accepted-request focus moving to Open chat, chat dialogs and Escape restoration, attachment preview, image-viewer opening/Escape restoration, delivery-card PNG download, first-post pulse expiration, button press/release, and reduced-motion changes during a counter transition. A 375 × 480 viewport check confirms the composer stays inside the viewport with the handover panel expanded.

This is **not** a live multi-account Supabase end-to-end test, a Safari/Firefox sign-off, or a physical phone keyboard test. The app's authorization, realtime and storage behavior remains covered by the separate automated/database checks and CHAT_TEST_PLAN.md. Native video controls and actual iOS/Android keyboard panning still warrant a device check.

Evidence is saved in `tests/ui-preview/artifacts/audit.json`, `interactions.json`, the viewport PNGs, and `delivery-card.png`. Reproduction instructions are in [tests/ui-preview/README.md](tests/ui-preview/README.md). The browser scripts use this workstation's installed Chrome and bundled Playwright, and do not touch real user accounts.

## Refinements made in this pass

- Raised the shared minimum width/height rule to include links. Browser measurements found short “Log in”, “Users” and “Next” links narrower than 44px; these now meet the target without per-page patches.
- Removed the first-post pulse class after its single run and immediately when reduced motion is enabled. Toggling preferences later can no longer replay an old celebration.
- Kept keyboard outlines inside the scrollable handover panel so its overflow clipping does not hide the ring.
- Allowed the handover disclosure and safety reminder to shrink and scroll when the visible chat viewport is short. They previously competed with the composer when expanded.
- Updated the isolated preview to cover F8 components, real design tokens, correct guest/authenticated navigation, all four admin tables and empty states. No production feature, schema change or new package was added.

## Motion inventory

| Motion                           | Trigger                       | Verified behavior                                                       |
| -------------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| Hero route draw, 1.2s            | Guest landing                 | One entrance; disabled under reduced motion                             |
| Accepted route draw, 0.75s       | Successful request acceptance | One local confirmation; Open chat remains keyboard accessible           |
| Primary press scale, 110ms, 0.97 | Active primary button press   | Releases on pointer/key up; disabled under reduced motion               |
| Count interpolation, about 400ms | Count changes                 | Limited to counts/badges; media-query change cancels pending frames     |
| First-moment pulse, 650ms        | Genuine first post/handover   | Once per milestone; class expires, no repeat from reopening/preferences |
| Skeleton shimmer, 1800ms         | Content loading               | Content-shaped loading only; static under reduced motion                |
| Spinner                          | Pending action/media load     | Task feedback only; static under reduced motion                         |

No incidental hover scaling, card fades, slide-ins, scroll entrances or bouncing typing dots were found. Hover color changes remain immediate. Grain is static and restricted to the hero/chat header. CSS globally disables animation, transition and smooth scrolling under reduced motion; the counter also stops its JavaScript frames. The browser recorded no running animations on reduced-motion landing/style-guide/loading-counter fixtures. There are four allowlisted custom CSS keyframes; the spinner comes from Tailwind.

## Contrast

| Text / surface                    | Ratio   | Result       |
| --------------------------------- | ------- | ------------ |
| Sage `#6A746E` / paper `#F7F8F4`  | 4.54:1  | AA body text |
| Paper `#F7F8F4` / ink `#0E1512`   | 17.35:1 | AA body text |
| Dark-surface sage `#9CA6A0` / ink | 7.38:1  | AA body text |
| Ink / signal                      | 8.06:1  | AA body text |

The earlier token correction already meets the requested ratios, so no further color-token adjustment was made. `node scripts/audit-design.mjs` checks these ratios, synchronized hex/RGB tokens and the motion allowlist. This does not claim whole-app WCAG certification; the read-receipt issue below remains.

## Visual decisions for review — deliberately not silently restyled

1. **Bottom navigation on Home, Search, Dashboard, Inbox and Admin:** the white/slate surface and blue unread badge look older than the paper/deep/signal screens. It also shares space with Admin's separate dark navigation. A consistent navigation styling decision would be useful; its layout and colors remain unchanged here.
2. **Error, 404, toast and generic loading surfaces:** these still use the older slate/white/red palette, rounded controls and, for toasts, a shadow. The screenshot of the shared error screen makes the difference particularly clear. Their controls work, but they feel separate from the ticket system. The root error fallback also does not load the normal font variables.
3. **Chat read receipts:** signal green on paper measures about 2.15:1, below the 3:1 non-text contrast target. Single/double-check shapes and accessible labels distinguish the states, but the read glyph remains visually light. Decide between a darker green foreground or a dark backing; changing the main signal token would also alter buttons and outgoing bubbles, so it was not changed silently.

The denser admin tables, quieter inbox rows and darker chat header are intentional. The main landing → search → post → dashboard → chat flow otherwise shares a consistent type, spacing, color and route-stub vocabulary. The downloadable delivery card matches those tokens and excludes personal contact information.

## Viewport and keyboard matrix

“Pass” below means the synthetic Chrome fixture passed overflow/target/focus checks at that viewport, not that every possible backend state or browser was exercised.

| Surface                                       | 375px | 768px | 1280px |
| --------------------------------------------- | ----- | ----- | ------ |
| Public landing                                | Pass  | Pass  | Pass   |
| Authenticated Home                            | Pass  | Pass  | Pass   |
| Login / Signup                                | Pass  | Pass  | Pass   |
| Post journey                                  | Pass  | Pass  | Pass   |
| Search results / empty                        | Pass  | Pass  | Pass   |
| Dashboard / empty                             | Pass  | Pass  | Pass   |
| Requests Received / Sent                      | Pass  | Pass  | Pass   |
| Inbox / empty                                 | Pass  | Pass  | Pass   |
| Chat thread                                   | Pass  | Pass  | Pass   |
| Admin Users/Journeys/Requests/Reports / empty | Pass  | Pass  | Pass   |
| Style guide                                   | Pass  | Pass  | Pass   |
| Shared error / 404                            | Pass  | Pass  | Pass   |

Additional 375px interaction screenshots cover expanded search, accepted request, handover panel, report dialog, attachment preview, post success and a shortened chat viewport. Native modal dialogs keep background page controls inert; Chrome may allow a Tab stop in browser chrome, then returns to the modal. Escape correctly restores the opener. No custom focus trap was added to replace this native behavior.
