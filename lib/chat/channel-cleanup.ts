import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
// A leaving screen cannot display a cleanup error. Retry unsubscribe locally
// without producing unhandled promises or closing unrelated inbox channels.
export async function releaseChatChannel(
  client: Pick<SupabaseClient, "removeChannel">,
  channel: RealtimeChannel,
) {
  try {
    if ((await client.removeChannel(channel)) === "ok") return;
  } catch {
    /* Fallback below. */
  }
  try {
    await channel.unsubscribe(1000);
  } catch {
    /* Handlers are already guarded by unmounted flags. */
  } finally {
    channel.teardown();
  }
}
