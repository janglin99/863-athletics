-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT,
  phone_verified        BOOLEAN DEFAULT FALSE,
  avatar_url            TEXT,
  role                  TEXT NOT NULL DEFAULT 'customer'
                          CHECK (role IN ('customer', 'trainer', 'staff', 'admin')),
  trainer_specialties   TEXT[],
  bio                   TEXT,
  emergency_name        TEXT,
  emergency_phone       TEXT,
  waiver_signed         BOOLEAN DEFAULT FALSE,
  waiver_signed_at      TIMESTAMPTZ,
  waiver_ip             TEXT,
  stripe_customer_id    TEXT,
  notification_email    BOOLEAN DEFAULT TRUE,
  notification_sms      BOOLEAN DEFAULT TRUE,
  notification_reminders BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RATES (pricing tiers)
-- ============================================================
CREATE TABLE public.rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN (
                    'drop_in_1hr',
                    'drop_in_multi',
                    'day_pass',
                    'trainer_private',
                    'trainer_group_small',
                    'trainer_group_large',
                    'membership_monthly',
                    'pack_5',
                    'pack_10',
                    'staff_access',
                    'event'
                  )),
  price_cents     INTEGER NOT NULL,
  per_unit        TEXT DEFAULT 'session'
                    CHECK (per_unit IN ('session', 'hour', 'month', 'person')),
  min_hours       INTEGER DEFAULT 1,
  max_hours       INTEGER,
  min_people      INTEGER DEFAULT 1,
  max_people      INTEGER DEFAULT 1,
  advance_notice_hours INTEGER DEFAULT 1,
  cancellation_hours   INTEGER DEFAULT 24,
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  color_hex       TEXT DEFAULT '#FF4700',
  icon            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FACILITY HOURS (weekly schedule)
-- ============================================================
CREATE TABLE public.facility_hours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time       TIME NOT NULL DEFAULT '06:00',
  close_time      TIME NOT NULL DEFAULT '22:00',
  is_open         BOOLEAN DEFAULT TRUE,
  UNIQUE(day_of_week)
);

-- ============================================================
-- AVAILABILITY BLOCKS
-- ============================================================
CREATE TABLE public.availability_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL DEFAULT 'Unavailable',
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  is_recurring    BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT,
  reason          TEXT,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE SEQUENCE booking_number_seq START 10001;

CREATE TABLE public.bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number      TEXT UNIQUE NOT NULL
                        DEFAULT 'BK' || LPAD(nextval('booking_number_seq')::TEXT, 6, '0'),
  customer_id         UUID NOT NULL REFERENCES public.profiles(id),
  trainer_id          UUID REFERENCES public.profiles(id),
  rate_id             UUID NOT NULL REFERENCES public.rates(id),
  status              TEXT NOT NULL DEFAULT 'pending_payment'
                        CHECK (status IN (
                          'pending_payment', 'confirmed', 'in_progress',
                          'completed', 'cancelled', 'no_show', 'refunded'
                        )),
  payment_status      TEXT NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN (
                          'unpaid', 'pending_manual', 'paid',
                          'partially_refunded', 'fully_refunded'
                        )),
  payment_method      TEXT CHECK (payment_method IN (
                        'stripe_card', 'stripe_apple_pay', 'stripe_google_pay',
                        'zelle', 'cash_app', 'cash', 'other'
                      )),
  subtotal_cents      INTEGER NOT NULL,
  discount_cents      INTEGER DEFAULT 0,
  total_cents         INTEGER NOT NULL,
  participant_count   INTEGER DEFAULT 1,
  notes               TEXT,
  internal_notes      TEXT,
  is_recurring        BOOLEAN DEFAULT FALSE,
  recurring_parent_id UUID REFERENCES public.bookings(id),
  recurring_pattern   JSONB,
  waiver_confirmed    BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        UUID REFERENCES public.profiles(id),
  cancel_reason       TEXT,
  cancel_initiated_by TEXT CHECK (cancel_initiated_by IN ('customer', 'admin', 'system'))
);

-- ============================================================
-- BOOKING SLOTS
-- ============================================================
CREATE TABLE public.booking_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  status          TEXT DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_slots_time ON booking_slots(start_time, end_time);
CREATE INDEX idx_booking_slots_booking ON booking_slots(booking_id);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                UUID NOT NULL REFERENCES public.bookings(id),
  customer_id               UUID NOT NULL REFERENCES public.profiles(id),
  amount_cents              INTEGER NOT NULL,
  method                    TEXT NOT NULL,
  status                    TEXT DEFAULT 'pending'
                              CHECK (status IN (
                                'pending', 'processing', 'completed',
                                'failed', 'refunded', 'partially_refunded'
                              )),
  stripe_payment_intent_id  TEXT,
  stripe_charge_id          TEXT,
  stripe_refund_id          TEXT,
  manual_reference          TEXT,
  manual_payment_screenshot TEXT,
  manual_confirmed_by       UUID REFERENCES public.profiles(id),
  manual_confirmed_at       TIMESTAMPTZ,
  notes                     TEXT,
  refund_reason             TEXT,
  refunded_amount_cents     INTEGER DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACCESS CODES (igloohome via Seam API)
-- ============================================================
CREATE TABLE public.access_codes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID NOT NULL REFERENCES public.bookings(id),
  booking_slot_id     UUID REFERENCES public.booking_slots(id),
  pin_code            TEXT NOT NULL,
  seam_access_code_id TEXT,
  seam_device_id      TEXT,
  valid_from          TIMESTAMPTZ NOT NULL,
  valid_until         TIMESTAMPTZ NOT NULL,
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN (
                          'pending', 'active', 'expired', 'revoked', 'failed'
                        )),
  sent_sms            BOOLEAN DEFAULT FALSE,
  sent_email          BOOLEAN DEFAULT FALSE,
  sms_sent_at         TIMESTAMPTZ,
  email_sent_at       TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATION LOG
-- ============================================================
CREATE TABLE public.notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES public.profiles(id),
  booking_id      UUID REFERENCES public.bookings(id),
  type            TEXT NOT NULL CHECK (type IN (
                    'booking_confirmed', 'booking_modified', 'booking_cancelled',
                    'booking_reminder_24h', 'booking_reminder_1h',
                    'access_code_sent', 'payment_received',
                    'payment_pending_manual', 'welcome', 'password_reset'
                  )),
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient       TEXT NOT NULL,
  subject         TEXT,
  preview         TEXT,
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  provider_id     TEXT,
  sent_at         TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CART ITEMS
-- ============================================================
CREATE TABLE public.cart_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rate_id           UUID NOT NULL REFERENCES public.rates(id),
  trainer_id        UUID REFERENCES public.profiles(id),
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  participant_count INTEGER DEFAULT 1,
  notes             TEXT,
  is_recurring      BOOLEAN DEFAULT FALSE,
  recurring_config  JSONB,
  price_snapshot    JSONB,
  expires_at        TIMESTAMPTZ DEFAULT NOW() + INTERVAL '45 minutes',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WAITLIST
-- ============================================================
CREATE TABLE public.waitlist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES public.profiles(id),
  rate_id       UUID REFERENCES public.rates(id),
  trainer_id    UUID REFERENCES public.profiles(id),
  requested_date DATE NOT NULL,
  preferred_times JSONB,
  notified      BOOLEAN DEFAULT FALSE,
  notified_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE public.reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES public.bookings(id),
  customer_id   UUID NOT NULL REFERENCES public.profiles(id),
  trainer_id    UUID REFERENCES public.profiles(id),
  overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  facility_rating INTEGER CHECK (facility_rating BETWEEN 1 AND 5),
  trainer_rating  INTEGER CHECK (trainer_rating BETWEEN 1 AND 5),
  comment       TEXT,
  is_published  BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
