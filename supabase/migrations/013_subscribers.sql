-- Stores SMS/email opt-in records from the public /subscribe form.
-- Used to satisfy AWS End User Messaging (10DLC) registration requirements.
CREATE TABLE public.subscribers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL,
  phone         TEXT,
  sms_consent   BOOLEAN NOT NULL DEFAULT FALSE,
  -- ISO 8601 timestamp recorded at opt-in for TCPA audit trail
  consented_at  TIMESTAMPTZ,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT subscribers_email_key UNIQUE (email)
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Public insert: anyone can subscribe
CREATE POLICY "subscribers_insert" ON public.subscribers
  FOR INSERT TO anon WITH CHECK (true);

-- Prevent public reads
CREATE POLICY "subscribers_no_read" ON public.subscribers
  FOR SELECT TO anon USING (false);

-- Admins can read all subscribers
CREATE POLICY "subscribers_admin_read" ON public.subscribers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Trigger to keep updated_at fresh
CREATE TRIGGER subscribers_updated_at
  BEFORE UPDATE ON public.subscribers
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
