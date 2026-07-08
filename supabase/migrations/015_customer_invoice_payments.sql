-- Invoice status tracking + a ledger for payments recorded against an
-- invoice after the fact (e.g. customers billed via account/net terms who
-- don't pay at time of booking — bookings.payment_status alone isn't
-- trustworthy for these, since it's set to 'paid' at booking time even
-- though no money has actually changed hands).
ALTER TABLE public.customer_invoices
  ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'));

CREATE TABLE public.customer_invoice_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  amount_cents  INTEGER NOT NULL,
  method        TEXT NOT NULL DEFAULT 'other' CHECK (method IN ('cash', 'check', 'zelle', 'cash_app', 'card', 'other')),
  note          TEXT,
  recorded_by   UUID REFERENCES public.profiles(id),
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customer_invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_invoice_payments_admin" ON public.customer_invoice_payments FOR ALL USING (public.is_admin());
CREATE POLICY "customer_invoice_payments_own" ON public.customer_invoice_payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.customer_invoices ci
    WHERE ci.id = invoice_id AND ci.customer_id = auth.uid()
  )
);
