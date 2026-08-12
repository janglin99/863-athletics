-- Rental line items (rate type 'gym_rental') bill by the hour, so the
-- invoice needs to show the actual time block, not just the date.
ALTER TABLE public.customer_invoice_items
  ADD COLUMN session_end TIMESTAMPTZ,
  ADD COLUMN is_rental BOOLEAN NOT NULL DEFAULT false;
