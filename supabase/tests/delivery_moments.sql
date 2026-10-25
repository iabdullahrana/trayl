-- Run after 0015. Every fixture and confirmation rolls back.
BEGIN;
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); j uuid; r uuid; p uuid; d uuid;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (a,a::text || '@example.invalid','{"name":"Delivery A","is_adult_confirmed":true}'),
    (b,b::text || '@example.invalid','{"name":"Delivery B","is_adult_confirmed":true}'),
    (c,c::text || '@example.invalid','{"name":"Delivery C","is_adult_confirmed":true}');
  INSERT INTO public.journeys(traveller_id,from_city,to_city,travel_date,travel_time,item_type)
    VALUES(b,'Jaipur','Gurgaon',current_date+1,'17:30','document') RETURNING id INTO j;
  INSERT INTO public.requests(journey_id,sender_id,status) VALUES(j,a,'accepted') RETURNING id INTO r;
  INSERT INTO public.requests(journey_id,sender_id,status) VALUES(j,a,'pending') RETURNING id INTO p;
  INSERT INTO public.requests(journey_id,sender_id,status) VALUES(j,a,'declined') RETURNING id INTO d;
  PERFORM set_config('test.a',a::text,true); PERFORM set_config('test.b',b::text,true); PERFORM set_config('test.c',c::text,true);
  PERFORM set_config('test.j',j::text,true); PERFORM set_config('test.r',r::text,true); PERFORM set_config('test.p',p::text,true); PERFORM set_config('test.d',d::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE result public.handovers; first_time timestamptz; target uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.b'),true);
  IF NOT public.claim_first_moment('first_journey') THEN RAISE EXCEPTION 'First post missing'; END IF;
  IF public.claim_first_moment('first_journey') THEN RAISE EXCEPTION 'First post repeated'; END IF;
  IF public.claim_first_moment('first_handover', current_setting('test.r')::uuid) THEN RAISE EXCEPTION 'Unearned handover'; END IF;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.a'),true);
  FOREACH target IN ARRAY ARRAY[current_setting('test.p')::uuid,current_setting('test.d')::uuid] LOOP
    BEGIN
      PERFORM public.confirm_handover(target);
      RAISE EXCEPTION 'Nonaccepted request confirmed';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'HANDOVER_UNAVAILABLE' THEN RAISE; END IF; END;
  END LOOP;
  result := public.confirm_handover(current_setting('test.r')::uuid);
  IF result.sender_confirmed_at IS NULL OR result.completed_at IS NOT NULL THEN RAISE EXCEPTION 'One-sided delivery completed'; END IF;
  first_time := result.sender_confirmed_at;
  result := public.confirm_handover(current_setting('test.r')::uuid);
  IF result.sender_confirmed_at <> first_time OR result.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Retry not idempotent'; END IF;
  BEGIN
    UPDATE public.handovers SET completed_at=now() WHERE request_id=current_setting('test.r')::uuid;
    RAISE EXCEPTION 'Direct completion allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.c'),true);
  IF EXISTS(SELECT 1 FROM public.handovers WHERE request_id=current_setting('test.r')::uuid) THEN RAISE EXCEPTION 'Nonparticipant read'; END IF;
  BEGIN
    PERFORM public.confirm_handover(current_setting('test.r')::uuid);
    RAISE EXCEPTION 'Nonparticipant confirmed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'HANDOVER_UNAVAILABLE' THEN RAISE; END IF; END;
  IF public.claim_first_moment('first_journey') THEN RAISE EXCEPTION 'Other user claimed milestone'; END IF;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.b'),true);
  result := public.confirm_handover(current_setting('test.r')::uuid);
  IF result.completed_at IS NULL OR result.traveller_confirmed_at IS NULL THEN RAISE EXCEPTION 'Both-sided completion missing'; END IF;
  IF (SELECT status FROM public.journeys WHERE id=current_setting('test.j')::uuid) <> 'active' THEN RAISE EXCEPTION 'Whole journey completed'; END IF;
  IF public.claim_first_moment('first_handover', current_setting('test.p')::uuid) THEN RAISE EXCEPTION 'Wrong delivery claimed first moment'; END IF;
  IF NOT public.claim_first_moment('first_handover', current_setting('test.r')::uuid) OR public.claim_first_moment('first_handover', current_setting('test.r')::uuid) THEN RAISE EXCEPTION 'Traveller milestone not exactly once'; END IF;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.a'),true);
  IF public.claim_first_moment('first_handover', current_setting('test.p')::uuid) THEN RAISE EXCEPTION 'Wrong delivery claimed first moment'; END IF;
  IF NOT public.claim_first_moment('first_handover', current_setting('test.r')::uuid) OR public.claim_first_moment('first_handover', current_setting('test.r')::uuid) THEN RAISE EXCEPTION 'Sender milestone not exactly once'; END IF;
  INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES(auth.uid(),current_setting('test.b')::uuid);
  BEGIN
    PERFORM public.confirm_handover(current_setting('test.r')::uuid);
    RAISE EXCEPTION 'Blocked caller confirmed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'HANDOVER_UNAVAILABLE' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.b'),true);
  BEGIN
    PERFORM public.confirm_handover(current_setting('test.r')::uuid);
    RAISE EXCEPTION 'Other direction block ignored';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'HANDOVER_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE public.profiles SET is_active=false WHERE id=current_setting('test.b')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.claim_first_moment('first_handover', current_setting('test.r')::uuid) THEN RAISE EXCEPTION 'Inactive claim allowed'; END IF;
  BEGIN
    PERFORM public.confirm_handover(current_setting('test.r')::uuid);
    RAISE EXCEPTION 'Inactive confirmation allowed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'HANDOVER_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.confirm_handover(current_setting('test.r')::uuid);
    RAISE EXCEPTION 'Anonymous confirm allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
