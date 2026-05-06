import { config } from '@/shared/config/index.js';
import { type AuditLogsRepository, type UsersRepository } from '@/shared/db/repositories/index.js';
import { ConflictError, UnprocessableEntityError } from '@/shared/errors/index.js';
import { logger } from '@/shared/logger/index.js';
import { type FirebaseAuthContext } from '@/shared/middleware/firebaseAuth.js';
import { encrypt } from '@/shared/utils/encryption.js';

import { type PdsAdminClient } from '../lib/pdsAdminClient.js';
import { generatePdsPassword } from '../lib/pdsPassword.js';
import { deriveEmail } from '../lib/syntheticEmail.js';

import { type FirestoreUserService } from './firestoreUserService.js';

export interface CreateAccountInput {
  readonly firebaseAuth: FirebaseAuthContext;
  readonly correlationId: string;
}

export interface CreateAccountResult {
  readonly did: string;
  readonly handle: string;
  readonly displayName: string;
}

interface CreateAccountServiceOptions {
  readonly handleDomain?: string;
}

export class CreateAccountService {
  private readonly handleDomain: string;

  public constructor(
    private readonly firestoreUserService: FirestoreUserService,
    private readonly pdsClient: PdsAdminClient,
    private readonly usersRepo: UsersRepository,
    private readonly auditRepo: AuditLogsRepository,
    options: CreateAccountServiceOptions = {},
  ) {
    this.handleDomain = options.handleDomain ?? config.env.HANDLE_DOMAIN;
  }

  /**
   * Orchestrates the createAccount flow:
   *
   *   1. Idempotency: existing user → return current identity unchanged.
   *   2. Read profile from Firestore (with retry).
   *   3. Validate age against MIN_USER_AGE.
   *   4. Pre-check username uniqueness (race-safe via DB unique constraint).
   *   5. Optionally generate a PDS invite code (when PDS_INVITE_REQUIRED).
   *   6. Create the PDS account.
   *   7. Best-effort write of the Bluesky profile record.
   *   8. Insert the Postgres row with encrypted PDS password.
   *   9. Append an audit log entry.
   *
   * @param input - Verified Firebase auth + correlation ID for log threading.
   * @returns The new identity (DID, handle, displayName).
   */
  public async execute(input: CreateAccountInput): Promise<CreateAccountResult> {
    const { firebaseAuth, correlationId } = input;
    const log = logger.child({ correlationId, firebaseUid: firebaseAuth.uid });

    log.info('createAccount: start');

    // 1. Idempotency
    const existing = await this.usersRepo.findByFirebaseUid(firebaseAuth.uid);
    if (existing !== null) {
      log.info(
        { did: existing.did, handle: existing.handle },
        'createAccount: already exists, returning existing',
      );
      return {
        did: existing.did,
        handle: existing.handle,
        displayName: existing.displayName ?? existing.username,
      };
    }

    // 2. Firestore profile
    const firestoreUser = await this.firestoreUserService.fetchUser(firebaseAuth.uid);

    // 3. Age check
    if (!this.firestoreUserService.isOldEnough(firestoreUser.dateOfBirth)) {
      throw new UnprocessableEntityError(
        `user must be at least ${String(config.env.MIN_USER_AGE)} years old`,
        { dateOfBirth: firestoreUser.dateOfBirth, minAge: config.env.MIN_USER_AGE },
      );
    }

    // 4. Username uniqueness pre-check
    const usernameClash = await this.usersRepo.findByUsername(firestoreUser.username);
    if (usernameClash !== null) {
      throw new ConflictError(`username '${firestoreUser.username}' is already taken`, {
        username: firestoreUser.username,
      });
    }

    // 5. Build handle, derive email, generate PDS password
    const handle = `${firestoreUser.username}${this.handleDomain}`;
    const pdsEmail = deriveEmail(firebaseAuth);
    const pdsPassword = generatePdsPassword();

    // 6. Optional invite
    let inviteCode: string | undefined;
    if (config.env.PDS_INVITE_REQUIRED) {
      const invite = await this.pdsClient.createInviteCode(1);
      inviteCode = invite.code;
      log.info({ inviteCode }, 'createAccount: invite generated');
    }

    // 7. Create PDS account
    const pdsResult = await this.pdsClient.createAccount({
      email: pdsEmail,
      handle,
      password: pdsPassword,
      ...(inviteCode !== undefined ? { inviteCode } : {}),
    });
    log.info(
      { did: pdsResult.did, handle: pdsResult.handle },
      'createAccount: PDS account created',
    );

    // 8. Best-effort profile write
    try {
      await this.pdsClient.putProfile(pdsResult.accessJwt, pdsResult.did, {
        displayName: firestoreUser.displayName,
      });
      log.info('createAccount: bluesky profile written');
    } catch (err) {
      log.warn({ err }, 'createAccount: putProfile failed (account created, profile pending)');
    }

    // 9. Insert in Postgres
    const inserted = await this.usersRepo.createWithProfile({
      firebaseUid: firebaseAuth.uid,
      username: firestoreUser.username,
      handle: pdsResult.handle,
      did: pdsResult.did,
      walletAddress: firestoreUser.walletAddress,
      chain: config.env.DEFAULT_WALLET_CHAIN,
      email: firebaseAuth.email,
      phoneNumber: firebaseAuth.phoneNumber,
      authProvider: firebaseAuth.authProvider,
      emailVerified: firebaseAuth.emailVerified,
      phoneVerified: firebaseAuth.phoneVerified,
      displayName: firestoreUser.displayName,
      dateOfBirth: firestoreUser.dateOfBirth,
      gender: firestoreUser.gender,
      countryCode: null,
      locale: 'en',
      pdsPasswordEncrypted: encrypt(pdsPassword),
    });

    // 10. Audit
    await this.auditRepo.create({
      userId: inserted.id,
      action: 'account_created',
      success: true,
      metadata: {
        authProvider: firebaseAuth.authProvider,
        emailKind: firebaseAuth.email !== null ? 'real' : 'synthetic',
      },
      correlationId,
    });

    log.info({ id: inserted.id, did: inserted.did }, 'createAccount: complete');

    return {
      did: inserted.did,
      handle: inserted.handle,
      displayName: firestoreUser.displayName,
    };
  }
}
