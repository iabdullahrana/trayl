-- Uses temporary Storage metadata only; no files are uploaded. Everything rolls back.
BEGIN;
DO $$
DECLARE chat record; base text;
BEGIN
 SELECT r.id,r.sender_id,j.traveller_id INTO chat FROM public.requests r
 JOIN public.journeys j ON j.id=r.journey_id
 JOIN public.profiles a ON a.id=r.sender_id AND a.is_active
 JOIN public.profiles b ON b.id=j.traveller_id AND b.is_active
 WHERE r.status='accepted' LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'An accepted chat between active users is required'; END IF;
 PERFORM set_config('test.chat',chat.id::text,true);
 PERFORM set_config('test.sender',chat.sender_id::text,true);
 PERFORM set_config('test.recipient',chat.traveller_id::text,true);
 PERFORM set_config('request.jwt.claim.sub',chat.sender_id::text,true);
 base:=chat.id::text||'/'||gen_random_uuid()::text;
 PERFORM set_config('test.sent',base||'-sent.png',true);
 PERFORM set_config('test.unused',base||'-unused.png',true);
 PERFORM set_config('test.foreign',base||'-foreign.png',true);
 INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES
 ('chat-media',current_setting('test.sent'),chat.sender_id::text,'{"mimetype":"image/png","size":1000}'::jsonb),
 ('chat-media',current_setting('test.unused'),chat.sender_id::text,'{"mimetype":"image/png","size":1000}'::jsonb),
 ('chat-media',current_setting('test.foreign'),chat.traveller_id::text,'{"mimetype":"image/png","size":1000}'::jsonb);
END $$;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 BEGIN
  INSERT INTO public.messages(request_id,sender_id,media_path,media_type,media_name,media_size)
  VALUES(current_setting('test.chat')::uuid,auth.uid(),current_setting('test.sent'),'image','bad-size.png',999);
  RAISE EXCEPTION 'Incorrect media size was accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.messages(request_id,sender_id,media_path,media_type,media_name,media_size)
  VALUES(current_setting('test.chat')::uuid,auth.uid(),current_setting('test.foreign'),'image','foreign.png',1000);
  RAISE EXCEPTION 'Another user upload was accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO public.messages(request_id,sender_id,media_path,media_type,media_name,media_size)
 VALUES(current_setting('test.chat')::uuid,auth.uid(),current_setting('test.sent'),'image','sent.png',1000);
 IF public.prepare_chat_media_cleanup(current_setting('test.chat')::uuid,current_setting('test.sent')) THEN RAISE EXCEPTION 'Sent attachment could be cleaned up'; END IF;
 IF NOT public.prepare_chat_media_cleanup(current_setting('test.chat')::uuid,current_setting('test.unused')) THEN RAISE EXCEPTION 'Uploader could not claim unused upload'; END IF;
 IF NOT public.can_cleanup_chat_media(current_setting('test.unused')) THEN RAISE EXCEPTION 'Cleanup permission missing'; END IF;
 IF public.chat_media_path_available(current_setting('test.unused')) THEN RAISE EXCEPTION 'Abandoned path may be reused'; END IF;
 BEGIN
  INSERT INTO public.messages(request_id,sender_id,media_path,media_type,media_name,media_size)
  VALUES(current_setting('test.chat')::uuid,auth.uid(),current_setting('test.unused'),'image','unused.png',1000);
  RAISE EXCEPTION 'Late insert attached an abandoned upload';
 EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
 IF public.can_cleanup_chat_media(current_setting('test.unused')) THEN RAISE EXCEPTION 'Other participant may clean up upload'; END IF;
 IF public.prepare_chat_media_cleanup(current_setting('test.chat')::uuid,current_setting('test.unused')) THEN RAISE EXCEPTION 'Other participant may claim upload'; END IF;
END $$;
ROLLBACK;
