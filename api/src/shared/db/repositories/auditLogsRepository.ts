import { type Database } from '../index.js';
import { auditLogs, type AuditLog, type NewAuditLog } from '../schema.js';

export interface CreateAuditLogInput {
  readonly userId: string | null;
  readonly action: string;
  readonly success: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly correlationId?: string;
}

export class AuditLogsRepository {
  public constructor(private readonly db: Database) {}

  /**
   * Inserts an audit log row.
   *
   * @param input - Action name, success flag, and optional context.
   * @returns The inserted row, including generated id and timestamp.
   */
  public async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const row: NewAuditLog = {
      userId: input.userId,
      action: input.action,
      success: input.success,
      metadata: input.metadata !== undefined ? { ...input.metadata } : null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      correlationId: input.correlationId ?? null,
    };

    const inserted = await this.db.insert(auditLogs).values(row).returning();
    const head = inserted[0];
    if (head === undefined) {
      throw new Error('AuditLogsRepository.create returned no row');
    }
    return head;
  }
}
