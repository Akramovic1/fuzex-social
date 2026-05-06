-- Seed the test account 'akram' for Phase 1 verification.
-- Idempotent: running this multiple times has no effect after the first run.
--
-- Replace `0x0000000000000000000000000000000000000001` with akram's real
-- wallet address before deploying to production-like environments.

INSERT INTO users (
  firebase_uid,
  username,
  handle,
  did,
  wallet_address,
  chain,
  tipping_enabled
)
VALUES (
  'firebase_uid_placeholder_for_akram',
  'akram',
  'akram.dev.fuzex.social',
  'did:plc:cwbqnunxsu7isx4vv4zul4un',
  '0x0000000000000000000000000000000000000001',
  'ethereum',
  true
)
ON CONFLICT (username) DO NOTHING;

-- Verify
SELECT username, handle, did, tipping_enabled FROM users WHERE username = 'akram';
