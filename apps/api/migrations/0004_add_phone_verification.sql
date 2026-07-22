-- TODO(security): any future phone-number change must reset
-- phone_verified to false and clear outstanding OTP keys. Verified
-- status must never carry over to a new number.
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  event TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT NOT NULL,
  CONSTRAINT phone_verifications_event_check
    CHECK (event IN ('requested', 'confirmed', 'failed', 'expired', 'burned'))
);
