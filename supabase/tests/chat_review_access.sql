-- All fixtures roll back. Tests RLS and message metadata validation, not the HTTP Storage service.
BEGIN;
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); journey uuid; accepted uuid; pending uuid; declined uuid;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) SELECT id,id::text || '@example.invalid','{"name":"Chat review fixture","is_adult_confirmed":true}'::jsonb FROM unnest(ARRAY[a,b,c]) id;
  INSERT INTO public.journeys(traveller_id,from_city,to_city,travel_date,travel_time,item_type)
    VALUES(a,'Review A','Review B',(now() AT TIME ZONE 'UTC')::date+1,'12:00','document') RETURNING id INTO journey;
  INSERT INTO public.requests(journey_id,sender_id,status) VALUES(journey,b,'accepted') RETURNING id INTO accepted;
  INSERT INTO public.requests(journey_id,sender_id,status) VALUES(journey,b,'pending') RETURNING id INTO pending;
  INSERT INTO public.requests(journey_id,sender_id,status) VALUES(journey,b,'declined') RETURNING id INTO declined;
  PERFORM set_config('test.a',a::text,true); PERFORM set_config('test.b',b::text,true); PERFORM set_config('test.c',c::text,true);
  PERFORM set_config('test.chat',accepted::text,true); PERFORM set_config('test.pending',pending::text,true); PERFORM set_config('test.declined',declined::text,true);
  PERFORM set_config('test.path',accepted::text || '/' || gen_random_uuid()::text || '-fixture.pdf',true);
  PERFORM set_config('test.bad_type',accepted::text || '/' || gen_random_uuid()::text || '-bad.exe',true);
  PERFORM set_config('test.oversize',accepted::text || '/' || gen_random_uuid()::text || '-huge.pdf',true);
  -- Trusted fixtures intentionally bypass Storage HTTP validation to test the message trigger independently.
  INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES
    ('chat-media',current_setting('test.path'),a::text,'{"mimetype":"application/pdf","size":12}'),
    ('chat-media',current_setting('test.bad_type'),a::text,'{"mimetype":"application/x-msdownload","size":12}'),
    ('chat-media',current_setting('test.oversize'),a::text,'{"mimetype":"application/pdf","size":15728641}');
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='chat-media' AND NOT public AND file_size_limit=15728640
    AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','application/pdf']::text[]
    AND cardinality(allowed_mime_types)=7) THEN RAISE EXCEPTION 'Bucket restrictions incorrect'; END IF;
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE msg uuid; request_key text;
BEGIN
  INSERT INTO public.messages(request_id,sender_id,body,media_path,media_type,media_name,media_size)
  VALUES(current_setting('test.chat')::uuid,auth.uid(),'Review fixture',current_setting('test.path'),'document','fixture.pdf',12) RETURNING id INTO msg;
  PERFORM set_config('test.message',msg::text,true);
  BEGIN
    INSERT INTO public.messages(request_id,sender_id,media_path,media_type,media_name,media_size)
    VALUES(current_setting('test.chat')::uuid,auth.uid(),current_setting('test.bad_type'),'document','bad.exe',12);
    RAISE EXCEPTION 'Disallowed MIME metadata accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.messages(request_id,sender_id,media_path,media_type,media_name,media_size)
    VALUES(current_setting('test.chat')::uuid,auth.uid(),current_setting('test.oversize'),'document','huge.pdf',15728641);
    RAISE EXCEPTION 'Oversize metadata accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  FOREACH request_key IN ARRAY ARRAY['test.pending','test.declined'] LOOP
    IF public.is_chat_participant(current_setting(request_key)::uuid) THEN RAISE EXCEPTION 'Unaccepted chat authorized'; END IF;
    BEGIN
      INSERT INTO public.messages(request_id,sender_id,body) VALUES(current_setting(request_key)::uuid,auth.uid(),'Not accepted');
      RAISE EXCEPTION 'Unaccepted chat allowed a send';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'CHAT_UNAVAILABLE' THEN RAISE; END IF; END;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.b'),true);
  IF NOT EXISTS(SELECT 1 FROM public.messages WHERE id=msg) THEN RAISE EXCEPTION 'Participant B cannot read'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='chat-media' AND name=current_setting('test.path')) THEN RAISE EXCEPTION 'Participant B cannot list media'; END IF;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.c'),true);
  IF EXISTS(SELECT 1 FROM public.messages WHERE request_id=current_setting('test.chat')::uuid) THEN RAISE EXCEPTION 'User C can read messages'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='chat-media' AND name LIKE current_setting('test.chat') || '/%') THEN RAISE EXCEPTION 'User C can list or authorize private objects'; END IF;
  IF public.can_join_chat_topic('chat:' || current_setting('test.chat')) THEN RAISE EXCEPTION 'User C can join private realtime'; END IF;
  BEGIN
    INSERT INTO public.messages(request_id,sender_id,body) VALUES(current_setting('test.chat')::uuid,auth.uid(),'Outsider');
    RAISE EXCEPTION 'User C can send';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'CHAT_UNAVAILABLE' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
