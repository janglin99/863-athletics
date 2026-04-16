-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Profiles
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Rates (public read, admin write)
CREATE POLICY "rates_select_all" ON public.rates
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "rates_admin_write" ON public.rates
  FOR ALL USING (public.is_admin());

-- Facility hours (public read)
CREATE POLICY "facility_hours_select" ON public.facility_hours
  FOR SELECT USING (TRUE);

CREATE POLICY "facility_hours_admin" ON public.facility_hours
  FOR ALL USING (public.is_admin());

-- Availability blocks
CREATE POLICY "avail_blocks_select" ON public.availability_blocks
  FOR SELECT USING (TRUE);

CREATE POLICY "avail_blocks_admin" ON public.availability_blocks
  FOR ALL USING (public.is_admin());

-- Bookings
CREATE POLICY "bookings_select_own" ON public.bookings
  FOR SELECT USING (customer_id = auth.uid() OR trainer_id = auth.uid() OR public.is_admin());

CREATE POLICY "bookings_insert_own" ON public.bookings
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "bookings_update_own" ON public.bookings
  FOR UPDATE USING (customer_id = auth.uid() OR public.is_admin());

-- Booking slots
CREATE POLICY "slots_select_own" ON public.booking_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.customer_id = auth.uid() OR public.is_admin())
    )
  );

-- Payments
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());

-- Access codes
CREATE POLICY "access_codes_select_own" ON public.access_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.customer_id = auth.uid()
    ) OR public.is_admin()
  );

-- Cart items
CREATE POLICY "cart_select_own" ON public.cart_items
  FOR ALL USING (customer_id = auth.uid());

-- Waitlist
CREATE POLICY "waitlist_own" ON public.waitlist
  FOR ALL USING (customer_id = auth.uid() OR public.is_admin());

-- Reviews
CREATE POLICY "reviews_select_published" ON public.reviews
  FOR SELECT USING (is_published = TRUE OR customer_id = auth.uid() OR public.is_admin());

CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid());
