-- Migration 011: Create verification_token table explicitly.
--
-- Audit fix #12: Previously this was created via CREATE TABLE IF NOT EXISTS
-- inside auth.ts as a module-level side effect, causing an unnecessary DB
-- query on every serverless cold start.

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  expires    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);
