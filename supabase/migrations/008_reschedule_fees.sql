-- Reschedule fee tiers
CREATE TABLE public.reschedule_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_hours_before INTEGER NOT NULL,  -- minimum hours before booking
  max_hours_before INTEGER,           -- null = unlimited (e.g. 48+ hours)
  fee_cents INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reschedule_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reschedule_fees_select" ON reschedule_fees FOR SELECT USING (true);
CREATE POLICY "reschedule_fees_admin" ON reschedule_fees FOR ALL USING (public.is_admin());

-- Default tiers
INSERT INTO reschedule_fees (name, min_hours_before, max_hours_before, fee_cents, sort_order) VALUES
  ('24+ hours notice', 24, null, 0, 1),
  ('12-24 hours notice', 12, 24, 500, 2),
  ('6-12 hours notice', 6, 12, 1000, 3),
  ('Less than 6 hours', 0, 6, 1500, 4);

-- Add reschedule tracking to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rescheduled_from UUID REFERENCES public.bookings(id),
  ADD COLUMN IF NOT EXISTS reschedule_fee_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ;
