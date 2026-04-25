-- User credits
CREATE TABLE public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_type TEXT NOT NULL CHECK (credit_type IN ('dollar', 'hours', 'sessions')),
  original_amount NUMERIC(10,2) NOT NULL,
  remaining_amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_credits_customer ON user_credits(customer_id);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credits_own" ON user_credits FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());
CREATE POLICY "credits_admin_write" ON user_credits FOR ALL USING (public.is_admin());

-- Credit usage log
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.user_credits(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id),
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('grant', 'use', 'refund', 'expire', 'adjust')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_tx_own" ON credit_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_credits uc WHERE uc.id = credit_id AND (uc.customer_id = auth.uid() OR public.is_admin()))
);
CREATE POLICY "credit_tx_admin_write" ON credit_transactions FOR ALL USING (public.is_admin());
