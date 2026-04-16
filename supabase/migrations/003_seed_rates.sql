INSERT INTO public.rates (name, description, type, price_cents, per_unit, min_hours, max_hours, min_people, max_people, sort_order, color_hex) VALUES
  ('Drop-In (1 Hour)',        'Single hour of open gym access',         'drop_in_1hr',          1500, 'hour',    1, 1,    1, 1,  1, '#FF4700'),
  ('Drop-In (2-3 Hours)',     'Extended session — best value per hour', 'drop_in_multi',        2500, 'session', 2, 3,    1, 1,  2, '#FF4700'),
  ('Full Day Pass',           'Unlimited access for the entire day',    'day_pass',             3500, 'session', null, null, 1, 1, 3, '#FF4700'),
  ('Private Training (1hr)',  '1-on-1 session with a certified trainer','trainer_private',      7500, 'hour',    1, null, 1, 1,  4, '#1B98E0'),
  ('Group Training (2-5 ppl)','Small group with a trainer',             'trainer_group_small',  5000, 'hour',    1, null, 2, 5,  5, '#1B98E0'),
  ('Group Training (6+ ppl)', 'Large group session with a trainer',     'trainer_group_large',  4000, 'hour',    1, null, 6, 30, 6, '#1B98E0'),
  ('5-Session Pack',          'Pre-paid 5 drop-in sessions (save 10%)', 'pack_5',               6750, 'session', null, null, 1, 1, 7, '#22C55E'),
  ('10-Session Pack',         'Pre-paid 10 sessions (save 20%)',        'pack_10',              12000,'session', null, null, 1, 1, 8, '#22C55E'),
  ('Monthly Membership',      'Unlimited open gym all month',           'membership_monthly',   8900, 'month',   null, null, 1, 1, 9, '#22C55E'),
  ('Staff/Trainer Access',    'Internal staff access code',             'staff_access',         0,    'session', null, null, 1, 1, 10,'#4A4A56');

-- Default facility hours
INSERT INTO public.facility_hours (day_of_week, open_time, close_time, is_open) VALUES
  (0, '08:00', '20:00', TRUE),
  (1, '06:00', '22:00', TRUE),
  (2, '06:00', '22:00', TRUE),
  (3, '06:00', '22:00', TRUE),
  (4, '06:00', '22:00', TRUE),
  (5, '06:00', '22:00', TRUE),
  (6, '07:00', '20:00', TRUE);
