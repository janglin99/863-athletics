-- Temporary slot holds
CREATE TABLE public.slot_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slot_holds_time ON slot_holds(start_time, end_time);
CREATE INDEX idx_slot_holds_expires ON slot_holds(expires_at);

ALTER TABLE slot_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slot_holds_own" ON slot_holds FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "slot_holds_select_all" ON slot_holds FOR SELECT USING (true);

-- Admin setting for hold duration
CREATE TABLE public.admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_settings_select" ON admin_settings FOR SELECT USING (true);
CREATE POLICY "admin_settings_admin" ON admin_settings FOR ALL USING (public.is_admin());

-- Default hold time: 5 minutes
INSERT INTO admin_settings (key, value) VALUES ('slot_hold_minutes', '5');
