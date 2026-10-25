BEGIN;

CREATE TABLE public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id),
  -- NULL for a conversation report, including an empty conversation.
  message_id uuid REFERENCES public.messages(id),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_reports_status_created_idx ON public.message_reports(status, created_at DESC);
CREATE UNIQUE INDEX message_reports_open_message_idx ON public.message_reports(message_id, reporter_id)
  WHERE status = 'open' AND message_id IS NOT NULL;
CREATE UNIQUE INDEX message_reports_open_conversation_idx ON public.message_reports(request_id, reporter_id)
  WHERE status = 'open' AND message_id IS NULL;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.message_reports TO authenticated;
GRANT INSERT (request_id, message_id, reporter_id, reason) ON public.message_reports TO authenticated;
-- Report identity and chat membership come from the authenticated caller.
-- A supplied message must belong to this same readable accepted chat.
CREATE POLICY reports_insert_participant ON public.message_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = (SELECT auth.uid()) AND public.is_chat_participant(request_id)
  AND (message_id IS NULL OR EXISTS (
    SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.request_id = message_reports.request_id
  )));
-- Even admins use narrow moderation RPCs, not a broad reports SELECT policy.
CREATE POLICY reports_select_own ON public.message_reports FOR SELECT TO authenticated
USING (reporter_id = (SELECT auth.uid()) AND public.is_account_active());

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id),
  blocked_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_blocks TO authenticated;
GRANT INSERT (blocker_id, blocked_id) ON public.user_blocks TO authenticated;
CREATE POLICY blocks_select_own ON public.user_blocks FOR SELECT TO authenticated
USING (blocker_id = (SELECT auth.uid()) AND public.is_account_active());
CREATE POLICY blocks_insert_own ON public.user_blocks FOR INSERT TO authenticated
WITH CHECK (blocker_id = (SELECT auth.uid()) AND public.is_account_active());

CREATE FUNCTION public.chat_send_state(chat_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE peer uuid; departure date;
BEGIN
  IF NOT public.is_chat_participant(chat_id) THEN RETURN 'unavailable'; END IF;
  SELECT CASE WHEN r.sender_id = auth.uid() THEN j.traveller_id ELSE r.sender_id END, j.travel_date
  INTO peer, departure FROM public.requests r JOIN public.journeys j ON j.id = r.journey_id WHERE r.id = chat_id;
  IF EXISTS (SELECT 1 FROM public.user_blocks b WHERE
    (b.blocker_id = auth.uid() AND b.blocked_id = peer) OR (b.blocker_id = peer AND b.blocked_id = auth.uid()))
    THEN RETURN 'blocked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = peer AND is_active) THEN RETURN 'unavailable'; END IF;
  -- Close at 00:00 UTC seven calendar days after departure; SELECT stays unchanged.
  IF (now() AT TIME ZONE 'UTC')::date >= departure + 7 THEN RETURN 'locked'; END IF;
  RETURN 'available';
END $$;
REVOKE ALL ON FUNCTION public.chat_send_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_send_state(uuid) TO authenticated;

-- Serialize a new block with sends between the same pair in either direction.
CREATE FUNCTION public.serialize_chat_block() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('chat-pair:' || least(NEW.blocker_id, NEW.blocked_id)::text || ':' || greatest(NEW.blocker_id, NEW.blocked_id)::text, 0));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.serialize_chat_block() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER user_blocks_serialize BEFORE INSERT ON public.user_blocks
FOR EACH ROW EXECUTE FUNCTION public.serialize_chat_block();

-- Private rolling-window counters. Atomic row locks cover concurrent tabs,
-- bulk INSERTs, attachments and different chats; failed transactions roll back.
CREATE TABLE public.message_rate_limits (
  sender_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  sent_at timestamptz[] NOT NULL DEFAULT '{}'
);
INSERT INTO public.message_rate_limits(sender_id, sent_at)
SELECT sender_id, array_agg(created_at) FROM public.messages
WHERE created_at > now() - interval '1 minute' GROUP BY sender_id;
ALTER TABLE public.message_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_rate_limits FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.enforce_chat_safety() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE peer uuid; state text; recent timestamptz[]; current_time_value timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NEW.sender_id <> auth.uid() OR NOT public.is_chat_participant(NEW.request_id)
    THEN RAISE EXCEPTION 'CHAT_UNAVAILABLE' USING ERRCODE = 'P0001'; END IF;
  SELECT CASE WHEN r.sender_id = auth.uid() THEN j.traveller_id ELSE r.sender_id END INTO peer
  FROM public.requests r JOIN public.journeys j ON j.id = r.journey_id WHERE r.id = NEW.request_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('chat-pair:' || least(NEW.sender_id, peer)::text || ':' || greatest(NEW.sender_id, peer)::text, 0));
  state := public.chat_send_state(NEW.request_id);
  IF state <> 'available' THEN RAISE EXCEPTION '%', 'CHAT_' || upper(state) USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.message_rate_limits(sender_id) VALUES (NEW.sender_id) ON CONFLICT DO NOTHING;
  SELECT sent_at INTO recent FROM public.message_rate_limits WHERE sender_id = NEW.sender_id FOR UPDATE;
  current_time_value := clock_timestamp();
  SELECT coalesce(array_agg(t), '{}'::timestamptz[]) INTO recent FROM unnest(recent) AS t
    WHERE t > current_time_value - interval '1 minute';
  IF cardinality(recent) >= 30 THEN RAISE EXCEPTION 'CHAT_RATE_LIMIT' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.message_rate_limits SET sent_at = array_append(recent, current_time_value) WHERE sender_id = NEW.sender_id;
  NEW.created_at := current_time_value;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_chat_safety() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER messages_enforce_safety BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_safety();
DROP POLICY messages_insert_sender ON public.messages;
CREATE POLICY messages_insert_sender ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_id = (SELECT auth.uid()) AND public.chat_send_state(request_id) = 'available');
-- Reject new uploads too; existing media/history remain readable after a block/lock.
CREATE POLICY chat_media_send_allowed ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id <> 'chat-media' OR CASE
  WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN public.chat_send_state(((storage.foldername(name))[1])::uuid) = 'available' ELSE false END);

CREATE FUNCTION public.admin_reports(status_filter text DEFAULT 'all', page_number integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE rows_json jsonb; total_rows bigint;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  IF status_filter IS NULL OR status_filter NOT IN ('all','open','reviewed') OR page_number IS NULL OR page_number NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Invalid filters'; END IF;
  SELECT count(*) INTO total_rows FROM public.message_reports WHERE status_filter = 'all' OR status = status_filter;
  SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO rows_json FROM (
    SELECT r.id, r.request_id, r.message_id, r.reason, r.status, r.created_at,
      p.name AS reporter_name, reported.name AS reported_name, reported.id AS reported_user_id, reported.is_active AS reported_is_active
    FROM public.message_reports r JOIN public.profiles p ON p.id = r.reporter_id
    JOIN public.requests q ON q.id = r.request_id JOIN public.journeys j ON j.id = q.journey_id
    LEFT JOIN public.messages m ON m.id = r.message_id
    JOIN public.profiles reported ON reported.id = coalesce(m.sender_id, CASE WHEN q.sender_id = r.reporter_id THEN j.traveller_id ELSE q.sender_id END)
    WHERE status_filter = 'all' OR r.status = status_filter
    ORDER BY r.created_at DESC, r.id LIMIT 20 OFFSET (page_number - 1) * 20
  ) t;
  RETURN jsonb_build_object('rows', rows_json, 'total', total_rows);
END $$;

-- No arbitrary message ID parameter, chat transcript, or reviewed-report content.
CREATE FUNCTION public.admin_report_message(report_id uuid)
RETURNS TABLE (id uuid, sender_id uuid, body text, media_path text, media_type text, media_name text, media_size bigint, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT m.id, m.sender_id, m.body, m.media_path, m.media_type, m.media_name, m.media_size, m.created_at
    FROM public.message_reports r JOIN public.messages m ON m.id = r.message_id
    WHERE r.id = report_id AND r.status = 'open';
END $$;
CREATE FUNCTION public.admin_review_report(report_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  UPDATE public.message_reports SET status = 'reviewed' WHERE id = report_id AND status = 'open';
  RETURN FOUND;
END $$;
CREATE FUNCTION public.admin_deactivate_report_user(report_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(m.sender_id, CASE WHEN q.sender_id = r.reporter_id THEN j.traveller_id ELSE q.sender_id END) INTO target
  FROM public.message_reports r JOIN public.requests q ON q.id = r.request_id
  JOIN public.journeys j ON j.id = q.journey_id LEFT JOIN public.messages m ON m.id = r.message_id
  WHERE r.id = report_id AND r.status = 'open' FOR UPDATE OF r;
  IF target IS NULL THEN RETURN false; END IF;
  RETURN public.admin_deactivate_user(target);
END $$;
CREATE FUNCTION public.admin_can_read_reported_media(object_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_admin() AND EXISTS (SELECT 1 FROM public.message_reports r
    JOIN public.messages m ON m.id = r.message_id WHERE r.status = 'open' AND m.media_path = $1);
$$;
REVOKE ALL ON FUNCTION public.admin_reports(text,integer), public.admin_report_message(uuid), public.admin_review_report(uuid), public.admin_deactivate_report_user(uuid), public.admin_can_read_reported_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reports(text,integer), public.admin_report_message(uuid), public.admin_review_report(uuid), public.admin_deactivate_report_user(uuid), public.admin_can_read_reported_media(text) TO authenticated;
-- Admin-only signing/download access is limited to media attached to an open report.
CREATE POLICY chat_media_open_report_admin ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media' AND public.admin_can_read_reported_media(name));

COMMIT;
