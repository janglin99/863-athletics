-- Default SMS notifications OFF until Twilio is fully configured.
-- New signups go through handle_new_user(), which doesn't set notification_*
-- explicitly — it relies on these column defaults.

ALTER TABLE public.profiles
  ALTER COLUMN notification_sms SET DEFAULT FALSE;

-- Apply to existing rows so nobody gets unexpected texts in the meantime.
UPDATE public.profiles
   SET notification_sms = FALSE
 WHERE notification_sms = TRUE;
