-- Add 'hourly' to commission_type options
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_commission_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_commission_type_check
  CHECK (commission_type IN ('percentage', 'flat_per_session', 'flat_monthly', 'hourly'));

-- Invoice line items table
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.trainer_invoices(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  session_date TIMESTAMPTZ NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  hours NUMERIC(10,2) NOT NULL,
  rate_cents INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_items_admin" ON invoice_items FOR ALL USING (public.is_admin());
CREATE POLICY "invoice_items_own" ON invoice_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM trainer_invoices ti WHERE ti.id = invoice_id AND ti.trainer_id = auth.uid())
);
