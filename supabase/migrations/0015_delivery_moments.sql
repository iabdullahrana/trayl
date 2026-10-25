BEGIN;

-- Completion belongs to an accepted request, not to the whole journey.
CREATE TABLE public.handovers (
  request_id uuid PRIMARY KEY REFERENCES public.requests(id) ON DELETE CASCADE,
  sender_confirmed_at timestamptz,
  traveller_confirmed_at timestamptz,
  completed_at timestamptz,
  CHECK ((completed_at IS NOT NULL) = (sender_confirmed_at IS NOT NULL AND traveller_confirmed_at IS NOT NULL))
);
ALTER TABLE public.handovers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.handovers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.handovers TO authenticated;
-- Only the two participants can read confirmation state; writes use the RPC below.
CREATE POLICY handovers_select_participant ON public.handovers FOR SELECT TO authenticated
USING (public.is_chat_participant(request_id) AND public.is_account_active());

-- Server-owned, durable milestones. No direct client writes or cross-user reads.
CREATE TABLE public.user_milestones (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('first_journey', 'first_handover')),
  achieved_at timestamptz NOT NULL DEFAULT now(),
  source_id uuid, -- journey or request ID, depending on kind; survives source deletion
  celebrated_at timestamptz,
  PRIMARY KEY (user_id, kind)
);
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_milestones FROM PUBLIC, anon, authenticated;
-- Existing posters are not brand-new users. Do not celebrate an old achievement.
INSERT INTO public.user_milestones(user_id, kind, achieved_at, celebrated_at)
SELECT traveller_id, 'first_journey', coalesce(min(created_at), now()), now()
FROM public.journeys GROUP BY traveller_id;
CREATE FUNCTION public.record_first_journey() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.user_milestones(user_id, kind, source_id) VALUES (NEW.traveller_id, 'first_journey', NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_first_journey() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER journeys_first_milestone AFTER INSERT ON public.journeys
FOR EACH ROW EXECUTE FUNCTION public.record_first_journey();

CREATE FUNCTION public.claim_first_moment(moment_kind text, moment_source uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE claimed boolean;
BEGIN
  IF NOT public.is_account_active() THEN RETURN false; END IF;
  UPDATE public.user_milestones SET celebrated_at = now()
  WHERE user_id = auth.uid() AND kind = moment_kind AND celebrated_at IS NULL
    AND (kind <> 'first_handover' OR source_id = moment_source)
  RETURNING true INTO claimed;
  RETURN coalesce(claimed, false);
END $$;
REVOKE ALL ON FUNCTION public.claim_first_moment(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_moment(text, uuid) TO authenticated;

CREATE FUNCTION public.confirm_handover(chat_id uuid) RETURNS public.handovers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request_row public.requests; traveller uuid; peer uuid; result public.handovers;
BEGIN
  -- Lock the parent first: simultaneous/repeated confirmations are serialized.
  SELECT * INTO request_row FROM public.requests WHERE id = chat_id FOR UPDATE;
  IF request_row.id IS NULL OR request_row.status <> 'accepted' OR NOT public.is_account_active()
    THEN RAISE EXCEPTION 'HANDOVER_UNAVAILABLE' USING ERRCODE = 'P0001'; END IF;
  SELECT traveller_id INTO traveller FROM public.journeys WHERE id = request_row.journey_id;
  IF auth.uid() IS NULL OR auth.uid() NOT IN (request_row.sender_id, traveller) OR request_row.sender_id = traveller
    THEN RAISE EXCEPTION 'HANDOVER_UNAVAILABLE' USING ERRCODE = 'P0001'; END IF;
  peer := CASE WHEN auth.uid() = traveller THEN request_row.sender_id ELSE traveller END;
  -- Use the same pair lock as the block trigger, so a concurrent block wins safely.
  PERFORM pg_advisory_xact_lock(hashtextextended('chat-pair:' || least(auth.uid(), peer)::text || ':' || greatest(auth.uid(), peer)::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = peer AND is_active)
    OR EXISTS (SELECT 1 FROM public.user_blocks WHERE
      (blocker_id = auth.uid() AND blocked_id = peer) OR (blocker_id = peer AND blocked_id = auth.uid()))
    THEN RAISE EXCEPTION 'HANDOVER_UNAVAILABLE' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.handovers(request_id) VALUES (chat_id) ON CONFLICT DO NOTHING;
  SELECT * INTO result FROM public.handovers WHERE request_id = chat_id FOR UPDATE;
  IF auth.uid() = request_row.sender_id THEN result.sender_confirmed_at := coalesce(result.sender_confirmed_at, now());
  ELSE result.traveller_confirmed_at := coalesce(result.traveller_confirmed_at, now()); END IF;
  IF result.sender_confirmed_at IS NOT NULL AND result.traveller_confirmed_at IS NOT NULL THEN
    result.completed_at := coalesce(result.completed_at, now());
  END IF;
  UPDATE public.handovers SET sender_confirmed_at = result.sender_confirmed_at,
    traveller_confirmed_at = result.traveller_confirmed_at, completed_at = result.completed_at WHERE request_id = chat_id;
  IF result.completed_at IS NOT NULL THEN
    INSERT INTO public.user_milestones(user_id, kind, source_id) VALUES
      (request_row.sender_id, 'first_handover', chat_id), (traveller, 'first_handover', chat_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.confirm_handover(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_handover(uuid) TO authenticated;

COMMIT;
