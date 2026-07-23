CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  stellar_public_key TEXT NOT NULL UNIQUE,
  encrypted_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
