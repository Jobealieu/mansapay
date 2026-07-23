CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES users(id),
  recipient_user_id UUID NOT NULL REFERENCES users(id),
  sender_public_key TEXT NOT NULL,
  recipient_public_key TEXT NOT NULL,
  amount NUMERIC(20, 7) NOT NULL,
  asset TEXT NOT NULL,
  status TEXT NOT NULL,
  stellar_tx_hash TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT transactions_status_check CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX transactions_sender_user_id_idx ON transactions (sender_user_id);
CREATE INDEX transactions_recipient_user_id_idx ON transactions (recipient_user_id);
