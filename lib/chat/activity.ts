import type { RealtimeChannel } from "@supabase/supabase-js";

export type ChatActivity = { online: boolean; typing: boolean };
const THROTTLE_MS = 2000;
const IDLE_MS = 3000;

// Ephemeral state only. Each tab has its own session ID, so one tab stopping
// typing or leaving cannot hide activity from the participant's other tab.
export function createChatActivity(
  channel: RealtimeChannel,
  userId: string,
  otherId: string,
  sessionId: string,
  onChange: (state: ChatActivity) => void,
  onError: (message: string) => void = () => {},
) {
  let disposed = false;
  let connected = false;
  let localTyping = false;
  let lastSent = -Infinity;
  let lastInput = -Infinity;
  let sequence = 0;
  let trailing: ReturnType<typeof setTimeout> | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const remoteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const remoteSequence = new Map<string, number>();
  let state: ChatActivity = { online: false, typing: false };

  function publish() {
    if (disposed) return;
    const online =
      connected &&
      Object.values(channel.presenceState<{ user_id: string }>()).some(
        (entries) => entries.some((entry) => entry.user_id === otherId),
      );
    const next = { online, typing: connected && remoteTimers.size > 0 };
    if (next.online !== state.online || next.typing !== state.typing) {
      state = next;
      onChange(next);
    }
  }
  function hintResult(result: string) {
    if (!disposed)
      onError(
        result === "ok"
          ? ""
          : "Typing and online hints are unavailable. Reconnect to retry.",
      );
  }
  function send(typing: boolean) {
    if (!connected || disposed) return;
    // Never queue transient hints while disconnected (or use HTTP fallback).
    void channel
      .send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id: userId,
          session_id: sessionId,
          typing,
          sequence: ++sequence,
        },
      })
      .then(hintResult)
      .catch(() => hintResult("error"));
  }
  function sendTyping() {
    trailing = undefined;
    if (!localTyping || Date.now() - lastInput >= IDLE_MS) return;
    lastSent = Date.now();
    send(true);
  }
  function stop() {
    clearTimeout(trailing);
    trailing = undefined;
    clearTimeout(idle);
    idle = undefined;
    if (localTyping) send(false);
    localTyping = false;
  }
  function input(hasText: boolean) {
    if (!connected || disposed) return;
    if (!hasText) {
      stop();
      return;
    }
    localTyping = true;
    lastInput = Date.now();
    clearTimeout(idle);
    idle = setTimeout(stop, IDLE_MS);
    const remaining = THROTTLE_MS - (Date.now() - lastSent);
    if (remaining <= 0) {
      clearTimeout(trailing);
      sendTyping();
    } else if (!trailing) trailing = setTimeout(sendTyping, remaining);
  }
  channel.on("broadcast", { event: "typing" }, ({ payload }) => {
    if (
      disposed ||
      !connected ||
      payload?.user_id !== otherId ||
      typeof payload.session_id !== "string" ||
      payload.session_id.length > 100 ||
      typeof payload.typing !== "boolean" ||
      !Number.isSafeInteger(payload.sequence)
    )
      return;
    const id = payload.session_id;
    if (payload.sequence <= (remoteSequence.get(id) ?? -1)) return;
    remoteSequence.set(id, payload.sequence);
    clearTimeout(remoteTimers.get(id));
    remoteTimers.delete(id);
    if (payload.typing)
      remoteTimers.set(
        id,
        setTimeout(() => {
          remoteTimers.delete(id);
          publish();
        }, IDLE_MS),
      );
    publish();
  });
  channel.on("presence", { event: "sync" }, () => {
    if (disposed || !connected) return;
    const sessions = new Set(
      Object.values(
        channel.presenceState<{ user_id: string; session_id: string }>(),
      )
        .flat()
        .filter((entry) => entry.user_id === otherId)
        .map((entry) => entry.session_id),
    );
    for (const [id, timer] of remoteTimers)
      if (!sessions.has(id)) {
        clearTimeout(timer);
        remoteTimers.delete(id);
      }
    publish();
  });
  function disconnected() {
    connected = false;
    stop();
    lastSent = -Infinity;
    for (const timer of remoteTimers.values()) clearTimeout(timer);
    remoteTimers.clear();
    remoteSequence.clear();
    publish();
  }
  return {
    input,
    stop,
    disconnected,
    subscribed() {
      if (disposed) return;
      connected = true;
      void channel
        .track({ user_id: userId, session_id: sessionId })
        .then(hintResult)
        .catch(() => hintResult("error"));
      publish();
    },
    dispose() {
      stop();
      disposed = true;
      if (connected) void channel.untrack().catch(() => {});
      disconnected();
    },
  };
}
