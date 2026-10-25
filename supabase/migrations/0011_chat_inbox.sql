BEGIN;

-- Invoker security preserves request, journey and message RLS. The directory
-- exposes only names/IDs; no contact fields are included in the inbox.
CREATE FUNCTION public.chat_inbox()
RETURNS TABLE (
  request_id uuid, other_name text, from_city text, to_city text,
  travel_date date, last_body text, last_media_type text,
  last_message_at timestamptz, activity_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT r.id, p.name, j.from_city, j.to_city, j.travel_date,
         m.body, m.media_type, m.created_at,
         coalesce(m.created_at, r.updated_at, r.created_at)
  FROM public.requests r
  JOIN public.journeys j ON j.id = r.journey_id
  JOIN public.profile_directory p ON p.id = CASE
    WHEN r.sender_id = (SELECT auth.uid()) THEN j.traveller_id
    ELSE r.sender_id END
  LEFT JOIN LATERAL (
    SELECT msg.body, msg.media_type, msg.created_at
    FROM public.messages msg WHERE msg.request_id = r.id
    ORDER BY msg.created_at DESC, msg.id DESC LIMIT 1
  ) m ON true
  WHERE r.status = 'accepted'
    AND (r.sender_id = (SELECT auth.uid()) OR j.traveller_id = (SELECT auth.uid()))
    AND public.is_account_active();
$$;
REVOKE ALL ON FUNCTION public.chat_inbox() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_inbox() TO authenticated;
COMMIT;
