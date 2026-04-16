-- Promo / discount codes
-- Run against remote with: npx supabase db push

CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN (
    'percentage',          -- e.g. 20% off
    'fixed_amount',        -- e.g. $10 off
    'fixed_rate_per_hour'  -- e.g. $10/hour flat rate instead of normal price
  )),
  discount_value INTEGER NOT NULL, -- percentage (20 = 20%) or cents (1000 = $10)
  min_booking_cents INTEGER DEFAULT 0,
  max_discount_cents INTEGER, -- cap for percentage discounts
  usage_limit INTEGER, -- null = unlimited
  usage_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  applicable_rate_types TEXT[], -- null = all rates, or ['drop_in_1hr', 'trainer_private']
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can see active promo codes; admins can see all
CREATE POLICY "promo_codes_select" ON public.promo_codes
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

-- Only admins can insert / update / delete
CREATE POLICY "promo_codes_admin" ON public.promo_codes
  FOR ALL USING (public.is_admin());
