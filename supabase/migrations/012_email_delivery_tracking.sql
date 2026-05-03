-- Track email delivery / bounce / complaint events from Resend webhooks.
-- notification_log already has `provider_id` (we'll fill it with Resend's
-- email_id) and `status`. We extend status to include lifecycle states and
-- add timestamp columns so an admin can see exactly what happened.

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT,
  ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ;

ALTER TABLE public.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_status_check;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_status_check
  CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'complained'));

CREATE INDEX IF NOT EXISTS idx_notification_log_provider_id
  ON public.notification_log(provider_id)
  WHERE provider_id IS NOT NULL;
