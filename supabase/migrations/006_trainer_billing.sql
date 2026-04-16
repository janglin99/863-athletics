-- Add trainer fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trainer_type TEXT CHECK (trainer_type IN ('in_house', 'external')),
  ADD COLUMN IF NOT EXISTS facility_rate_cents INTEGER DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS commission_rate INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'flat_per_session', 'flat_monthly'));

-- Trainer monthly billing/invoices
CREATE TABLE public.trainer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.profiles(id),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  total_sessions INTEGER DEFAULT 0,
  total_hours NUMERIC(10,2) DEFAULT 0,
  total_amount_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid')),
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainer_id, month, year)
);

ALTER TABLE public.trainer_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainer_invoices_admin" ON public.trainer_invoices FOR ALL USING (public.is_admin());
CREATE POLICY "trainer_invoices_own" ON public.trainer_invoices FOR SELECT USING (trainer_id = auth.uid());

-- Add trainer_account as allowed payment method
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_check CHECK (payment_method IN ('stripe_card', 'stripe_apple_pay', 'stripe_google_pay', 'zelle', 'cash_app', 'cash', 'trainer_account', 'other'));
