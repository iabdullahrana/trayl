-- Rollback-only checks of the installed Realtime authorization predicates.
-- Evaluate their actual pg_policy expressions against synthetic descriptors:
-- no activity rows or managed Realtime storage partitions are created.
BEGIN;
CREATE FUNCTION pg_temp.activity_allowed(operation text, extension_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE predicate text; allowed boolean;
BEGIN
  SELECT CASE WHEN operation = 'receive' THEN pg_get_expr(polqual, polrelid)
              ELSE pg_get_expr(polwithcheck, polrelid) END INTO predicate
  FROM pg_policy
  WHERE polrelid = 'realtime.messages'::regclass
    AND polname = 'chat_activity_' || operation
    AND 'authenticated'::regrole::oid = ANY(polroles);
  IF predicate IS NULL THEN RAISE EXCEPTION 'Missing activity policy: %', operation; END IF;
  EXECUTE 'SELECT coalesce((' || predicate || '), false) FROM (VALUES ($1)) AS messages(extension)'
    INTO allowed USING extension_name;
  RETURN allowed;
END $$;
DO $$
DECLARE chat record; inactive_request uuid;
BEGIN
  SELECT r.id, r.sender_id, r.journey_id, j.traveller_id INTO chat
  FROM public.requests r JOIN public.journeys j ON j.id = r.journey_id
  JOIN public.profiles s ON s.id = r.sender_id AND s.is_active
  JOIN public.profiles t ON t.id = j.traveller_id AND t.is_active
  WHERE r.status = 'accepted' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'An accepted chat between active accounts is required'; END IF;
  INSERT INTO public.requests(journey_id, sender_id, status)
  VALUES (chat.journey_id, chat.sender_id, 'declined') RETURNING id INTO inactive_request;
  PERFORM set_config('test.topic', 'chat:' || chat.id::text, true);
  PERFORM set_config('test.inactive_topic', 'chat:' || inactive_request::text, true);
  PERFORM set_config('test.sender', chat.sender_id::text, true);
  PERFORM set_config('test.recipient', chat.traveller_id::text, true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE participant text; operation text; extension_name text;
BEGIN
  FOREACH participant IN ARRAY ARRAY[current_setting('test.sender'), current_setting('test.recipient')] LOOP
    PERFORM set_config('request.jwt.claim.sub', participant, true);
    PERFORM set_config('realtime.topic', current_setting('test.topic'), true);
    FOREACH operation IN ARRAY ARRAY['receive', 'send'] LOOP
      FOREACH extension_name IN ARRAY ARRAY['broadcast', 'presence'] LOOP
        IF NOT pg_temp.activity_allowed(operation, extension_name) THEN RAISE EXCEPTION 'Accepted participant denied % %', operation, extension_name; END IF;
      END LOOP;
      IF pg_temp.activity_allowed(operation, 'unknown') THEN RAISE EXCEPTION 'Unknown extension allowed'; END IF;
    END LOOP;
  END LOOP;
  PERFORM set_config('realtime.topic', current_setting('test.inactive_topic'), true);
  IF pg_temp.activity_allowed('receive', 'broadcast') OR pg_temp.activity_allowed('send', 'presence') THEN RAISE EXCEPTION 'Unaccepted chat allowed'; END IF;
  PERFORM set_config('realtime.topic', 'chat:invalid', true);
  IF pg_temp.activity_allowed('receive', 'presence') THEN RAISE EXCEPTION 'Malformed topic allowed'; END IF;
  PERFORM set_config('realtime.topic', current_setting('test.topic'), true);
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  FOREACH operation IN ARRAY ARRAY['receive', 'send'] LOOP
    FOREACH extension_name IN ARRAY ARRAY['broadcast', 'presence'] LOOP
      IF pg_temp.activity_allowed(operation, extension_name) THEN RAISE EXCEPTION 'Outsider allowed % %', operation, extension_name; END IF;
    END LOOP;
  END LOOP;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.can_join_chat_topic(text)', 'EXECUTE') THEN RAISE EXCEPTION 'Anonymous topic helper access'; END IF;
END $$;
ROLLBACK;
