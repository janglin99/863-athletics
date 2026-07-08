-- Customer invoices: staff-generated, saved to the customer's profile.
-- Line items are an immutable snapshot at generation time (not recomputed from
-- bookings on every view), so a saved invoice never changes retroactively.
CREATE SEQUENCE customer_invoice_number_seq START 1001;

CREATE TABLE public.customer_invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   TEXT UNIQUE NOT NULL DEFAULT 'INV' || LPAD(nextval('customer_invoice_number_seq')::TEXT, 6, '0'),
  customer_id      UUID NOT NULL REFERENCES public.profiles(id),
  period_type      TEXT NOT NULL DEFAULT 'month' CHECK (period_type IN ('session', 'day', 'week', 'month')),
  period_start     TIMESTAMPTZ NOT NULL,
  period_end       TIMESTAMPTZ NOT NULL,
  total_cents      INTEGER NOT NULL DEFAULT 0,
  paid_cents       INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  generated_by     UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, period_type, period_start, period_end)
);

CREATE TABLE public.customer_invoice_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  booking_id     UUID REFERENCES public.bookings(id),
  description    TEXT NOT NULL,
  session_date   TIMESTAMPTZ NOT NULL,
  payment_status TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_invoices_admin" ON public.customer_invoices FOR ALL USING (public.is_admin());
CREATE POLICY "customer_invoices_own" ON public.customer_invoices FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "customer_invoice_items_admin" ON public.customer_invoice_items FOR ALL USING (public.is_admin());
CREATE POLICY "customer_invoice_items_own" ON public.customer_invoice_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.customer_invoices ci
    WHERE ci.id = invoice_id AND ci.customer_id = auth.uid()
  )
);
