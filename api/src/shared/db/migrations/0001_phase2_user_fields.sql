-- Phase 2: extend users table with profile fields and per-user encrypted PDS password.
-- Run via: npm run db:migrate

ALTER TABLE "users" ADD COLUMN "email" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" text NOT NULL DEFAULT 'password';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" date;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sex" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country_code" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" text NOT NULL DEFAULT 'en';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" text NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pds_password_encrypted" text;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_valid"
  CHECK ("status" IN ('active', 'suspended', 'deleted'));
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sex_valid"
  CHECK ("sex" IS NULL OR "sex" IN ('female', 'male', 'prefer_not_to_say'));
--> statement-breakpoint
-- NOTE: "must have email or phone" is enforced in application code
-- (createAccountService) rather than via a CHECK constraint, because the
-- existing Phase 1 seed row (akram) has neither field set yet.
CREATE INDEX "users_status_idx" ON "users" ("status");
--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" ("email") WHERE "email" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" ("phone_number") WHERE "phone_number" IS NOT NULL;
