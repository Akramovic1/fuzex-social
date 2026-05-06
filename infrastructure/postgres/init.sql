-- One-time PostgreSQL setup for fuzex-api on the VPS.
-- Run as the postgres superuser:
--   sudo -u postgres psql -f /opt/fuzex-social/infrastructure/postgres/init.sql
--
-- Idempotent: re-running has no effect after the first successful run.
-- Replace 'CHANGE_ME_STRONG_PASSWORD' with the actual password before running,
-- OR use psql variables:
--   sudo -u postgres psql -v dbpass="'real-password-here'" -f init.sql

\set ON_ERROR_STOP on

-- Create the application user (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fuzex_api') THEN
    EXECUTE format('CREATE ROLE fuzex_api LOGIN PASSWORD %L', 'CHANGE_ME_STRONG_PASSWORD');
  END IF;
END
$$;

-- Create the database (idempotent — checked outside DO block since CREATE DATABASE
-- can't run inside a transaction block on most managed Postgres providers)
SELECT 'CREATE DATABASE fuzex_social OWNER fuzex_api'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fuzex_social')\gexec

-- Connect to the new database
\c fuzex_social

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO fuzex_api;
ALTER SCHEMA public OWNER TO fuzex_api;

-- pgcrypto for gen_random_uuid() (also enabled by the migration, but safe to do here)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Verify
\du fuzex_api
\l fuzex_social
