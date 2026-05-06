import { config } from '@/shared/config/index.js';
import { logger } from '@/shared/logger/index.js';

export interface CreateAccountInput {
  readonly email: string;
  readonly handle: string;
  readonly password: string;
  readonly inviteCode?: string;
}

export interface CreateAccountResult {
  readonly did: string;
  readonly handle: string;
  readonly accessJwt: string;
  readonly refreshJwt: string;
}

export interface CreateInviteCodeResult {
  readonly code: string;
}

export interface CreateSessionResult {
  readonly accessJwt: string;
  readonly refreshJwt: string;
  readonly handle: string;
  readonly did: string;
}

export interface PutProfileInput {
  readonly displayName: string;
  readonly description?: string;
}

interface PdsAdminClientOptions {
  readonly baseUrl?: string;
  readonly adminUsername?: string;
  readonly adminPassword?: string;
  /** Optional fetch override for testing. Defaults to global fetch. */
  readonly fetcher?: typeof fetch;
}

/**
 * Thin client around the Bluesky PDS XRPC endpoints fuzex-api needs.
 * Admin endpoints use Basic auth with PDS_ADMIN_USERNAME/PDS_ADMIN_PASSWORD;
 * session-bearing endpoints use the user's accessJwt.
 */
export class PdsAdminClient {
  private readonly baseUrl: string;
  private readonly adminUsername: string;
  private readonly adminPassword: string;
  private readonly fetcher: typeof fetch;

  public constructor(options: PdsAdminClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? config.env.PDS_URL;
    this.adminUsername = options.adminUsername ?? config.env.PDS_ADMIN_USERNAME;
    this.adminPassword = options.adminPassword ?? config.env.PDS_ADMIN_PASSWORD;
    this.fetcher = options.fetcher ?? fetch;
  }

  private adminAuthHeader(): string {
    const token = Buffer.from(`${this.adminUsername}:${this.adminPassword}`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Generates a single-use invite code via the admin endpoint.
   *
   * @param useCount - Number of times the code may be used (default 1).
   * @returns The generated code.
   */
  public async createInviteCode(useCount = 1): Promise<CreateInviteCodeResult> {
    const url = `${this.baseUrl}/xrpc/com.atproto.server.createInviteCode`;
    const res = await this.fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.adminAuthHeader(),
      },
      body: JSON.stringify({ useCount }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, 'PDS createInviteCode failed');
      throw new Error(`PDS createInviteCode failed: ${res.status}`);
    }

    return (await res.json()) as CreateInviteCodeResult;
  }

  /**
   * Creates a new account on the PDS. Public-facing endpoint — no admin auth.
   *
   * @param input - email, handle, password, and optional inviteCode.
   * @returns The new DID, confirmed handle, and an active session.
   */
  public async createAccount(input: CreateAccountInput): Promise<CreateAccountResult> {
    const url = `${this.baseUrl}/xrpc/com.atproto.server.createAccount`;
    const res = await this.fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body, handle: input.handle }, 'PDS createAccount failed');
      throw new Error(`PDS createAccount failed: ${res.status} ${body}`);
    }

    return (await res.json()) as CreateAccountResult;
  }

  /**
   * Mints an active session for an existing account.
   *
   * @param identifier - Handle or email.
   * @param password - The account password.
   * @returns Access/refresh JWTs and identity.
   */
  public async createSession(identifier: string, password: string): Promise<CreateSessionResult> {
    const url = `${this.baseUrl}/xrpc/com.atproto.server.createSession`;
    const res = await this.fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body, identifier }, 'PDS createSession failed');
      throw new Error(`PDS createSession failed: ${res.status}`);
    }

    return (await res.json()) as CreateSessionResult;
  }

  /**
   * Writes the user's `app.bsky.actor.profile` record. Requires an authenticated
   * session (accessJwt from createAccount or createSession).
   *
   * @param accessJwt - User's session token.
   * @param did - User's DID (the repo to write into).
   * @param profile - Display name and optional description.
   */
  public async putProfile(accessJwt: string, did: string, profile: PutProfileInput): Promise<void> {
    const url = `${this.baseUrl}/xrpc/com.atproto.repo.putRecord`;
    const record: Record<string, unknown> = {
      $type: 'app.bsky.actor.profile',
      displayName: profile.displayName,
      createdAt: new Date().toISOString(),
    };
    if (profile.description !== undefined) {
      record.description = profile.description;
    }

    const body = {
      repo: did,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      record,
    };

    const res = await this.fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessJwt}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, body: text, did }, 'PDS putProfile failed');
      throw new Error(`PDS putProfile failed: ${res.status}`);
    }
  }
}
