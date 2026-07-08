-- Invoices are drafts until staff explicitly publish them to the customer's
-- portal. viewed_at tracks whether the customer has acknowledged a newly
-- published invoice, driving a "new invoice" notice on their dashboard.
ALTER TABLE public.customer_invoices
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN viewed_at TIMESTAMPTZ;

-- Customers can only see invoices staff have published — tighten the "own"
-- read policies (child tables join back to the parent invoice) beyond the
-- existing customer_id = auth.uid() check.
DROP POLICY "customer_invoices_own" ON public.customer_invoices;
CREATE POLICY "customer_invoices_own" ON public.customer_invoices FOR SELECT USING (
  customer_id = auth.uid() AND published_at IS NOT NULL
);

DROP POLICY "customer_invoice_items_own" ON public.customer_invoice_items;
CREATE POLICY "customer_invoice_items_own" ON public.customer_invoice_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.customer_invoices ci
    WHERE ci.id = invoice_id AND ci.customer_id = auth.uid() AND ci.published_at IS NOT NULL
  )
);

DROP POLICY "customer_invoice_payments_own" ON public.customer_invoice_payments;
CREATE POLICY "customer_invoice_payments_own" ON public.customer_invoice_payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.customer_invoices ci
    WHERE ci.id = invoice_id AND ci.customer_id = auth.uid() AND ci.published_at IS NOT NULL
  )
);

-- Customers need to dismiss the "new invoice" notice (set viewed_at) but
-- must not be able to touch any other column (total_cents, status, etc.) on
-- their own invoice row. A blanket RLS UPDATE policy can't enforce that
-- column-level restriction, so use a SECURITY DEFINER function scoped to
-- exactly this one mutation — the same pattern as public.is_admin().
CREATE OR REPLACE FUNCTION public.mark_customer_invoices_viewed()
RETURNS VOID AS $$
  UPDATE public.customer_invoices
  SET viewed_at = NOW()
  WHERE customer_id = auth.uid() AND published_at IS NOT NULL AND viewed_at IS NULL;
$$ LANGUAGE SQL SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_customer_invoices_viewed() TO authenticated;
