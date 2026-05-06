import { sql } from 'drizzle-orm';
import { boolean, index, inet, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  firebaseUid: text('firebase_uid').notNull().unique(),
  username: text('username').notNull().unique(),
  handle: text('handle').notNull().unique(),
  did: text('did').notNull().unique(),
  walletAddress: text('wallet_address').notNull(),
  chain: text('chain').notNull().default('ethereum'),
  tippingEnabled: boolean('tipping_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id'),
    action: text('action').notNull(),
    success: boolean('success').notNull(),
    metadata: jsonb('metadata'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    correlationId: text('correlation_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    userIdIdx: index('idx_audit_logs_user_id').on(table.userId),
    actionIdx: index('idx_audit_logs_action').on(table.action),
    createdAtIdx: index('idx_audit_logs_created_at').on(table.createdAt.desc()),
  }),
);

export const inviteCodes = pgTable(
  'invite_codes',
  {
    code: text('code').primaryKey(),
    createdForFirebaseUid: text('created_for_firebase_uid'),
    used: boolean('used').notNull().default(false),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    createdForIdx: index('idx_invite_codes_created_for').on(table.createdForFirebaseUid),
    expiresAtIdx: index('idx_invite_codes_expires_at').on(table.expiresAt),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;
