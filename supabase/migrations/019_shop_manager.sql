-- Shop manager role: can manage shop settings and orders only.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'trainer', 'staff', 'admin', 'shop_manager'));

-- Fulfillment / pickup status for shop orders. Orders themselves live in
-- Stripe (keyed by Checkout Session id); this only records our own status.
-- Accessed exclusively through the service role from the admin API.
CREATE TABLE IF NOT EXISTS public.shop_order_fulfillment (
  session_id   TEXT PRIMARY KEY,
  fulfilled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.shop_order_fulfillment ENABLE ROW LEVEL SECURITY;
