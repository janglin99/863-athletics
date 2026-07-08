-- Allow a staff-picked arbitrary date range ("custom") in addition to the
-- existing session/day/week/month period types.
ALTER TABLE public.customer_invoices
  DROP CONSTRAINT customer_invoices_period_type_check;

ALTER TABLE public.customer_invoices
  ADD CONSTRAINT customer_invoices_period_type_check
  CHECK (period_type IN ('session', 'day', 'week', 'month', 'custom'));
