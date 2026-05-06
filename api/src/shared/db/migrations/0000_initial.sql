CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "firebase_uid" text NOT NULL,
  "username" text NOT NULL,
  "handle" text NOT NULL,
  "did" text NOT NULL,
  "wallet_address" text NOT NULL,
  "chain" text NOT NULL DEFAULT 'ethereum',
  "tipping_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "users_firebase_uid_unique" UNIQUE ("firebase_uid"),
  CONSTRAINT "users_username_unique" UNIQUE ("username"),
  CONSTRAINT "users_handle_unique" UNIQUE ("handle"),
  CONSTRAINT "users_did_unique" UNIQUE ("did")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "action" text NOT NULL,
  "success" boolean NOT NULL,
  "metadata" jsonb,
  "ip_address" inet,
  "user_agent" text,
  "correlation_id" text,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "audit_logs_user_id_fk" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action");
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" ("created_at" DESC);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
  "code" text PRIMARY KEY,
  "created_for_firebase_uid" text,
  "used" boolean NOT NULL DEFAULT false,
  "used_at" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX "idx_invite_codes_created_for" ON "invite_codes" ("created_for_firebase_uid");
--> statement-breakpoint
CREATE INDEX "idx_invite_codes_expires_at" ON "invite_codes" ("expires_at");
