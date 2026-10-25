# Chat end-to-end review checklist

## Evidence and limits

This pass includes automated application regression tests, a production build,
and rollback-only checks against the linked Supabase database. Browser access
is unavailable to the reviewing agent: **375px rendering, physical keyboard
behavior, live WebSocket delivery, browser console cleanliness, and actual
Storage HTTP probes are not marked passed**. Run the unchecked items below
before release. Mock/unit tests are not substitutes for these checks.

## Setup

- [ ] Apply all migrations through `0013_chat_safety.sql` and run `npm run dev`.
- [ ] Create active, ordinary accounts A, B and C in separate browser profiles.
      C must not be an admin. Use test accounts; never a service-role key.
- [ ] A posts a journey dated today or later. B requests it; A accepts.
      Record the request UUID. Also prepare pending and declined A/B requests.
- [ ] A sends one text and one small PDF/image. Record that message's private
      `media_path` for API checks. Do not share a signed URL with C.
- [ ] Open DevTools Console with Preserve log, and Network/WebSocket frames.

## 1. Authorization and private files

Automated coverage: `supabase/tests/chat_review_access.sql` verifies participant
reads, outsider SELECT denial for messages/Storage metadata, rejection of
pending/declined sends, private-channel authorization, exact bucket restrictions,
and rejection of forged disallowed/oversize upload metadata. All fixtures roll
back. `chat_safety_access.sql` verifies blocks and admin content boundaries.

- [ ] As C, open `/chat/<A-B-request>`: redirects to `/dashboard`, no names,
      conversation contents, or attachment thumbnails from that chat.
- [ ] As A and B, open pending and declined chats: redirects to `/dashboard`.
- [ ] Run the API probe below: C cannot read messages, list this request's
      objects, or mint a signed URL for a known path. A and B can do all relevant
      reads/signing; this positive control rules out an invalid-token false pass.
- [ ] A copied, already-signed URL is a temporary bearer capability. Do not
      mistake opening A's deliberately shared URL for C being able to mint one.
      The test is **C's own authenticated createSignedUrl call**.

### Actual Storage API probe

Use Node 22+ in a separate disposable terminal at the project root. Supply the
project URL/public anon key and current access tokens from your own three test
sessions (e.g. the bearer token of each session's Supabase request in DevTools).
Never commit tokens, paste them into reports, or use an admin/service-role key.
In PowerShell:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'YOUR_PROJECT_URL'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_KEY'
$env:CHAT_TEST_A_TOKEN = 'A_CURRENT_ACCESS_TOKEN'
$env:CHAT_TEST_B_TOKEN = 'B_CURRENT_ACCESS_TOKEN'
$env:CHAT_TEST_C_TOKEN = 'C_CURRENT_ACCESS_TOKEN'
$env:CHAT_TEST_REQUEST_ID = 'ACCEPTED_FUTURE_UNBLOCKED_REQUEST_UUID'
$env:CHAT_TEST_MEDIA_PATH = 'REQUEST_UUID/EXISTING_ATTACHMENT_FILENAME'
node scripts/check-chat-api.mjs --uploads
```

Expected: two PASS lines and exit code 0. Refresh expired tokens if needed.
Without `--uploads`, this performs only reads/signing. With the flag, it uploads
one tiny PDF positive control and attempts an executable MIME and a 15 MiB + 1
byte PDF. Every unique test path is cleaned through the existing safe cleanup
RPC and Storage API in `finally`; small cleanup claims are retained by design.
If cleanup reports failure, use Storage dashboard to remove only those unused
`review-*` test objects. Close the terminal afterward to discard token variables.
The script never prints tokens or signed URLs.

## 2. File validation and recovery

- [ ] Select a `.exe` / unsupported MIME: friendly allowed-format error; no upload.
- [ ] Select a valid-type file larger than 15 MiB: friendly size error; no upload.
- [ ] Run the API probe's `--uploads` cases to bypass client validation: server
      rejects both disallowed MIME and size; the valid tiny PDF succeeds.
- [ ] Select valid JPEG/PNG/GIF, MP4/MOV and PDF, preview, cancel, send a caption.
      Images resize to max 1600px; GIFs become still frames as disclosed in preview.
- [ ] Go offline during upload: progress stops, a retryable error appears.
      Restore connectivity and retry: one confirmed bubble, no duplicate row.
- [ ] Trigger a failed message insert after upload (e.g. block from B during
      upload): uploaded file is cleaned or the pending bubble explains cleanup retry.
- [ ] Fail signed-URL refresh: bubble shows Retry, never a public URL fallback.
      Restore connectivity and retry. Video decode failures offer Reload/Open file.

## 3. Blocks, locks and moderation

- [ ] B blocks A. B's composer is replaced immediately; A's refresh/focus (or
      visible 10-second poll) shows “You can't send messages in this chat”.
- [ ] Attempt direct message inserts as both accounts: rejected even before the
      other browser polls. Existing messages/attachments remain readable.
- [ ] Run `chat_safety_access.sql`: 31st send/minute is rejected across chats,
      seven-day lock preserves history, reports stay private, and reviewed reports
      no longer expose content/media to an unrelated admin.
- [ ] Report a message and an empty conversation; repeated submit has no duplicate
      open report. Review/deactivate through `/admin`; unauthorized admin URLs fail.
- [ ] A dismissed safety banner stays dismissed for that user/chat in this browser.

## 4. Realtime, duplicates, receipts and hints

- [ ] With A and B in the accepted chat, send 5 numbered texts each way, plus an
      attachment each. Each message appears exactly once without refreshing.
- [ ] Keep B scrolled up while A sends: scroll stays put, New messages pill shows.
      Load older messages; prepend preserves scroll and creates no duplicates.
- [ ] Drop a network connection after a send, reconnect and retry. HTTP confirmation,
      Realtime INSERT and catch-up must resolve to a single message ID/bubble.
- [ ] Keep B hidden: incoming messages remain unread. Show B: batch-read happens,
      A's ticks become double checks and the unread badge clears.
- [ ] Type continuously: at most one typing=true broadcast every 2 seconds.
      Stop for 3 seconds / clear / send / blur: typing clears. Offline or failed
      Broadcast/Presence shows recoverable status; no unhandled rejected promise.
- [ ] Open B in two tabs; closing one does not hide the other's online hint.

## 5. Mobile: 375px wide and a real keyboard

Run at **375 × 812** and **375 × 667**, then a real iOS Safari or Android Chrome
keyboard test. Desktop device emulation alone does not reproduce virtual keyboards.

- [ ] No horizontal document or message-list scroll, including a very long name,
      unbroken message, filename, route and expanded message menu.
- [ ] Focus the composer and enter four lines: Send and paperclip remain above
      the keyboard. Scroll history while focused; closing keyboard restores height.
- [ ] Repeat with safety banner, long header, errors, preview caption, report dialog,
      portrait/landscape rotation, browser toolbar expansion and 200% text zoom.
- [ ] Document/body width does not exceed viewport width. In DevTools:
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- [ ] Inspect visible custom buttons/links/summaries using the Elements box model:
      both hit-area dimensions >= 44px. Include Retry, Close, report menu and file links.
      Native video controls are platform-owned; verify usability on the physical device.
- [ ] Tab/Shift+Tab and Enter/Space work; dialogs trap focus, Escape closes them,
      and focus returns to their trigger. Focus rings are visible and labels announced.

The fixed chat follows `visualViewport.height/offsetTop`; resize/scroll listeners
are detached on unmount. CSS `100dvh` is the fallback. Regression tests cover the
viewport arithmetic and listener cleanup, **not rendered-device verification**.

## 6. Console and cleanup

- [ ] Clear console; visit chat, send, attach, read, report, and leave five times.
      No hydration errors, React warnings, duplicate subscription warnings, unhandled
      promises, or exceptions. Record any message verbatim with reproduction steps.
- [ ] Network frames show a chat join on entry and leave on exit. After leaving,
      no chat-specific typing/receipt/availability timers or listeners keep firing.
      The shared authenticated inbox channel is expected to remain mounted.
- [ ] Reconnect uses one active chat subscription. Development Strict Mode may
      mount/unmount once extra; it must settle to one channel, not grow each visit.
- [ ] Force disconnect during navigation: no rejected cleanup promise in console;
      local teardown runs even if the leave acknowledgement fails. Do not disconnect
      the shared Supabase client, which would break the inbox channel.

Expected offline HTTP failures can appear in Network/console browser diagnostics;
record those separately from application exceptions. Do not hide real JS errors.

## Supabase call/error audit (chat scope)

| Call group                                | Error handling / feedback                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth/participant/directory SSR reads      | Auth redirects; request/profile/query failures reach the existing route error boundary                                                                 |
| Message insert / pagination               | Catches thrown and returned errors; retry bubble or load error; scoped confirmation of committed retries                                               |
| Read receipts                             | Batch update and reconciliation errors shown with Retry receipts                                                                                       |
| Media upload / message metadata / cleanup | Pending progress/error bubble; cleanup claim and remove failures remain retryable; never delete committed media                                        |
| Signed URL batches                        | Returned, partial and thrown failures produce per-attachment Retry; no public fallback                                                                 |
| Inbox/unread RPCs                         | Retain last data, show error and Retry in inbox; no false empty success                                                                                |
| Safety/report/block calls                 | Fail closed, display inline errors, validate identity server-side and in RLS                                                                           |
| Admin report media                        | Admin guard, open-report RPC, Storage RLS; returned/thrown errors yield readable no-store 503 responses                                                |
| Chat Realtime subscribe/send/track        | Subscribe errors show Reconnect; non-ok and rejected send/track results show hint feedback                                                             |
| Channel leave/untrack                     | No screen remains to show teardown feedback: promises are contained, local handlers/timers disposed, unsubscribe fallback tears down only that channel |

All entrypoints use the caller's public-key client and RLS; no service-role shortcut
is used. This audit does not claim browser console or network delivery was observed.
