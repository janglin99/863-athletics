export interface Profile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  phone_verified: boolean
  avatar_url: string | null
  role: "customer" | "trainer" | "staff" | "admin"
  trainer_specialties: string[] | null
  bio: string | null
  emergency_name: string | null
  emergency_phone: string | null
  waiver_signed: boolean
  waiver_signed_at: string | null
  waiver_ip: string | null
  stripe_customer_id: string | null
  notification_email: boolean
  notification_sms: boolean
  notification_reminders: boolean
  trainer_type: "in_house" | "external" | null
  facility_rate_cents: number | null
  commission_rate: number | null
  commission_type: "percentage" | "flat_per_session" | "flat_monthly" | "hourly" | null
  created_at: string
  updated_at: string
}

export interface TrainerInvoice {
  id: string
  trainer_id: string
  month: number
  year: number
  total_sessions: number
  total_hours: number
  total_amount_cents: number
  status: "pending" | "invoiced" | "paid"
  notes: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
  trainer?: Profile
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  booking_id: string
  session_date: string
  start_time: string
  end_time: string
  hours: number
  rate_cents: number
  amount_cents: number
  created_at: string
}

export interface Rate {
  id: string
  name: string
  description: string | null
  type: string
  price_cents: number
  per_unit: "session" | "hour" | "month" | "person"
  min_hours: number | null
  max_hours: number | null
  min_people: number
  max_people: number
  advance_notice_hours: number
  cancellation_hours: number
  is_active: boolean
  sort_order: number
  color_hex: string
  icon: string | null
  created_at: string
  updated_at: string
}

export interface FacilityHours {
  id: string
  day_of_week: number
  open_time: string
  close_time: string
  is_open: boolean
}

export interface AvailabilityBlock {
  id: string
  title: string
  start_time: string
  end_time: string
  is_recurring: boolean
  recurrence_rule: string | null
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface Booking {
  id: string
  booking_number: string
  customer_id: string
  trainer_id: string | null
  rate_id: string
  status: BookingStatus
  payment_status: PaymentStatus
  payment_method: string | null
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  participant_count: number
  notes: string | null
  internal_notes: string | null
  is_recurring: boolean
  recurring_parent_id: string | null
  recurring_pattern: RecurringPattern | null
  waiver_confirmed: boolean
  created_at: string
  updated_at: string
  confirmed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  cancel_initiated_by: "customer" | "admin" | "system" | null
  // Joined data
  customer?: Profile
  trainer?: Profile
  rate?: Rate
  slots?: BookingSlot[]
  payments?: Payment[]
  access_codes?: AccessCode[]
}

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "refunded"

export type PaymentStatus =
  | "unpaid"
  | "pending_manual"
  | "paid"
  | "partially_refunded"
  | "fully_refunded"

export interface RecurringPattern {
  frequency: "weekly" | "biweekly"
  daysOfWeek: number[]
  endDate: string
}

export interface BookingSlot {
  id: string
  booking_id: string
  start_time: string
  end_time: string
  status: "scheduled" | "in_progress" | "completed" | "cancelled"
  created_at: string
}

export interface Payment {
  id: string
  booking_id: string
  customer_id: string
  amount_cents: number
  method: string
  status: string
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  stripe_refund_id: string | null
  manual_reference: string | null
  manual_payment_screenshot: string | null
  manual_confirmed_by: string | null
  manual_confirmed_at: string | null
  notes: string | null
  refund_reason: string | null
  refunded_amount_cents: number
  created_at: string
  updated_at: string
}

export interface AccessCode {
  id: string
  booking_id: string
  booking_slot_id: string | null
  pin_code: string
  seam_access_code_id: string | null
  seam_device_id: string | null
  valid_from: string
  valid_until: string
  status: "pending" | "active" | "expired" | "revoked" | "failed"
  sent_sms: boolean
  sent_email: boolean
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface TimeSlot {
  start: string
  end: string
  available: boolean
}

export interface DayAvailability {
  date: string
  slots: TimeSlot[]
}

export interface AvailabilityMap {
  [date: string]: DayAvailability
}
