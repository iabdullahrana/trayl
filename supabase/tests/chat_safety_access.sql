-- Self-contained fixtures; all accounts, files (metadata only) and messages roll back.
BEGIN;
DO $$
DECLARE sender uuid := gen_random_uuid(); recipient uuid := gen_random_uuid(); admin_id uuid := gen_random_uuid(); journey uuid; chat uuid; chat2 uuid;
BEGIN
  INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
    (sender, sender::text || '@example.invalid', '{"name":"Safety sender","is_adult_confirmed":true}'),
    (recipient, recipient::text || '@example.invalid', '{"name":"Safety recipient","is_adult_confirmed":true}'),
    (admin_id, admin_id::text || '@example.invalid', '{"name":"Safety admin","is_adult_confirmed":true}');
  UPDATE public.profiles SET role = 'admin' WHERE id = admin_id;
  INSERT INTO public.journeys(traveller_id,from_city,to_city,travel_date,travel_time,item_type)
    VALUES(recipient,'Safety A','Safety B',(now() AT TIME ZONE 'UTC')::date + 1,'12:00','document') RETURNING id INTO journey;
  INSERT INTO public.requests(journey_id,sender_id,status) VALUES(journey,sender,'accepted') RETURNING id INTO chat;
  INSERT INTO public.requests(journey_id,sender_id,status) VALUES(journey,sender,'accepted') RETURNING id INTO chat2;
  PERFORM set_config('test.sender',sender::text,true); PERFORM set_config('test.recipient',recipient::text,true);
  PERFORM set_config('test.admin',admin_id::text,true); PERFORM set_config('test.journey',journey::text,true);
  PERFORM set_config('test.chat',chat::text,true); PERFORM set_config('test.chat2',chat2::text,true);
  PERFORM set_config('test.message',gen_random_uuid()::text,true);
  PERFORM set_config('test.path',chat::text || '/' || gen_random_uuid()::text || '-report.pdf',true);
  INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('chat-media',current_setting('test.path'),sender::text,'{"mimetype":"application/pdf","size":12}');
  PERFORM set_config('request.jwt.claim.sub',sender::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE report uuid;
BEGIN
  INSERT INTO public.messages(id,request_id,sender_id,body,media_path,media_type,media_name,media_size)
    VALUES(current_setting('test.message')::uuid,current_setting('test.chat')::uuid,auth.uid(),'Reported text',current_setting('test.path'),'document','report.pdf',12);
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
  INSERT INTO public.message_reports(request_id,message_id,reporter_id,reason)
    VALUES(current_setting('test.chat')::uuid,current_setting('test.message')::uuid,auth.uid(),'Unsafe message') RETURNING id INTO report;
  PERFORM set_config('test.report',report::text,true);
  INSERT INTO public.message_reports(request_id,reporter_id,reason)
    VALUES(current_setting('test.chat2')::uuid,auth.uid(),'Empty conversation report') RETURNING id INTO report;
  PERFORM set_config('test.conversation_report',report::text,true);
  BEGIN
    INSERT INTO public.message_reports(request_id,message_id,reporter_id,reason)
      VALUES(current_setting('test.chat2')::uuid,current_setting('test.message')::uuid,auth.uid(),'Cross-chat forgery');
    RAISE EXCEPTION 'Cross-chat report allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.message_reports(request_id,reporter_id,reason)
      VALUES(current_setting('test.chat')::uuid,current_setting('test.sender')::uuid,'Forged identity');
    RAISE EXCEPTION 'Forged reporter allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.message_reports SET status='reviewed' WHERE id=current_setting('test.report')::uuid;
    RAISE EXCEPTION 'Reporter reviewed own report';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.admin_report_message(current_setting('test.report')::uuid);
    RAISE EXCEPTION 'Non-admin obtained reported content';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.sender'),true);
  IF EXISTS(SELECT 1 FROM public.message_reports WHERE id=current_setting('test.report')::uuid) THEN RAISE EXCEPTION 'Other participant sees report'; END IF;
END $$;
RESET ROLE;
DELETE FROM public.message_rate_limits WHERE sender_id=current_setting('test.sender')::uuid;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  FOR i IN 1..30 LOOP
    INSERT INTO public.messages(request_id,sender_id,body) VALUES(current_setting('test.chat')::uuid,auth.uid(),'Rate test');
  END LOOP;
  BEGIN
    INSERT INTO public.messages(request_id,sender_id,body) VALUES(current_setting('test.chat2')::uuid,auth.uid(),'31st across another chat');
    RAISE EXCEPTION '31st message allowed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'CHAT_RATE_LIMIT' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE public.message_rate_limits SET sent_at=ARRAY[now()-interval '61 seconds'] WHERE sender_id=current_setting('test.sender')::uuid;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  INSERT INTO public.messages(request_id,sender_id,body) VALUES(current_setting('test.chat')::uuid,auth.uid(),'Rate window expired');
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
  INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES(auth.uid(),current_setting('test.sender')::uuid);
  IF public.chat_send_state(current_setting('test.chat')::uuid) <> 'blocked' THEN RAISE EXCEPTION 'Blocker can send'; END IF;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.sender'),true);
  IF public.chat_send_state(current_setting('test.chat')::uuid) <> 'blocked' THEN RAISE EXCEPTION 'Blocked user can send'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.messages WHERE id=current_setting('test.message')::uuid) THEN RAISE EXCEPTION 'Block hid history'; END IF;
  BEGIN
    INSERT INTO public.messages(request_id,sender_id,body) VALUES(current_setting('test.chat')::uuid,auth.uid(),'Blocked send');
    RAISE EXCEPTION 'Blocked insert allowed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'CHAT_BLOCKED' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DELETE FROM public.user_blocks WHERE blocker_id=current_setting('test.recipient')::uuid;
UPDATE public.journeys SET travel_date=(now() AT TIME ZONE 'UTC')::date - 7 WHERE id=current_setting('test.journey')::uuid;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.chat_send_state(current_setting('test.chat')::uuid) <> 'locked' THEN RAISE EXCEPTION 'Old chat not locked'; END IF;
  BEGIN
    INSERT INTO public.messages(request_id,sender_id,body) VALUES(current_setting('test.chat')::uuid,auth.uid(),'Late send');
    RAISE EXCEPTION 'Late insert allowed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'CHAT_LOCKED' THEN RAISE; END IF; END;
  IF NOT EXISTS(SELECT 1 FROM public.messages WHERE id=current_setting('test.message')::uuid) THEN RAISE EXCEPTION 'Lock hid history'; END IF;
  PERFORM set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
  IF EXISTS(SELECT 1 FROM public.messages WHERE id=current_setting('test.message')::uuid) THEN RAISE EXCEPTION 'Admin has broad message read'; END IF;
  IF (SELECT count(*) FROM public.admin_report_message(current_setting('test.report')::uuid)) <> 1 THEN RAISE EXCEPTION 'Admin cannot read open reported message'; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_report_message(gen_random_uuid())) THEN RAISE EXCEPTION 'Unrelated report exposed content'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='chat-media' AND name=current_setting('test.path')) THEN RAISE EXCEPTION 'Admin cannot read open reported media'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.admin_reports('open',1)->'rows') row WHERE row->>'id'=current_setting('test.report')) THEN RAISE EXCEPTION 'Admin reports missing row'; END IF;
  IF NOT public.admin_review_report(current_setting('test.report')::uuid) THEN RAISE EXCEPTION 'Review failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_report_message(current_setting('test.report')::uuid)) THEN RAISE EXCEPTION 'Reviewed report exposed content'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='chat-media' AND name=current_setting('test.path')) THEN RAISE EXCEPTION 'Reviewed report exposed media'; END IF;
  IF NOT public.admin_deactivate_report_user(current_setting('test.conversation_report')::uuid) THEN RAISE EXCEPTION 'Report deactivation failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=current_setting('test.sender')::uuid AND is_active) THEN RAISE EXCEPTION 'Wrong conversation participant deactivated'; END IF;
END $$;
ROLLBACK;
