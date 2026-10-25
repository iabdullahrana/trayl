BEGIN;

-- Authorization only: no typing, presence, or last-seen rows are stored.
-- Realtime evaluates these policies when joining a private chat:<UUID> topic.
-- Reuse the accepted-request/active-account check and guard malformed UUIDs.
CREATE FUNCTION public.can_join_chat_topic(topic text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT CASE
    WHEN $1 ~ '^chat:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN public.is_chat_participant(substring($1 from 6)::uuid)
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION public.can_join_chat_topic(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_join_chat_topic(text) TO authenticated;

-- Only accepted-chat participants may receive ephemeral Broadcast/Presence.
CREATE POLICY chat_activity_receive ON realtime.messages
FOR SELECT TO authenticated
USING (
  extension IN ('broadcast', 'presence')
  AND public.can_join_chat_topic((SELECT realtime.topic()))
);

-- Only accepted-chat participants may send typing and track channel presence.
CREATE POLICY chat_activity_send ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  extension IN ('broadcast', 'presence')
  AND public.can_join_chat_topic((SELECT realtime.topic()))
);

COMMIT;
