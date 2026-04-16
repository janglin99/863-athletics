-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_bookings
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_payments
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to check slot availability
CREATE OR REPLACE FUNCTION public.get_booked_slots(
  check_start TIMESTAMPTZ,
  check_end TIMESTAMPTZ
)
RETURNS TABLE(start_time TIMESTAMPTZ, end_time TIMESTAMPTZ) AS $$
  SELECT bs.start_time, bs.end_time
  FROM public.booking_slots bs
  JOIN public.bookings b ON bs.booking_id = b.id
  WHERE bs.status != 'cancelled'
    AND b.status NOT IN ('cancelled', 'refunded')
    AND bs.start_time < check_end
    AND bs.end_time > check_start;
$$ LANGUAGE SQL SECURITY DEFINER;
