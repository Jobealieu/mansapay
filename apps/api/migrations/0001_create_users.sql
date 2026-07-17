CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  country CHAR(2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_phone_number_e164_check CHECK (phone_number ~ '^\+[1-9]\d{1,14}$'),
  CONSTRAINT users_country_alpha2_check CHECK (country ~ '^[A-Z]{2}$')
);
