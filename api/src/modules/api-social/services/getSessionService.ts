import { type UsersRepository } from '@/shared/db/repositories/index.js';
import { BadRequestError, NotFoundError } from '@/shared/errors/index.js';
import { logger } from '@/shared/logger/index.js';
import { decrypt } from '@/shared/utils/encryption.js';

import { type PdsAdminClient } from '../lib/pdsAdminClient.js';

export interface GetSessionInput {
  readonly firebaseUid: string;
}

export interface GetSessionResult {
  readonly did: string;
  readonly handle: string;
  readonly accessJwt: string;
  readonly refreshJwt: string;
}

export class GetSessionService {
  public constructor(
    private readonly usersRepo: UsersRepository,
    private readonly pdsClient: PdsAdminClient,
  ) {}

  /**
   * Issues a fresh PDS session for an existing user.
   *
   * @param input - The verified Firebase UID.
   * @returns Access/refresh JWTs and identity.
   * @throws NotFoundError - User has not yet called createAccount.
   * @throws BadRequestError - User predates Phase 2 (no encrypted password stored).
   */
  public async execute(input: GetSessionInput): Promise<GetSessionResult> {
    const user = await this.usersRepo.findByFirebaseUid(input.firebaseUid);
    if (user === null) {
      throw new NotFoundError(
        'no atproto account exists for this user — call createAccount first',
        { firebaseUid: input.firebaseUid },
      );
    }

    if (user.pdsPasswordEncrypted === null) {
      throw new BadRequestError(
        'this account was seeded without a PDS password and cannot be used for getSession',
        { firebaseUid: input.firebaseUid },
      );
    }

    const password = decrypt(user.pdsPasswordEncrypted);
    const session = await this.pdsClient.createSession(user.handle, password);

    logger.info({ firebaseUid: input.firebaseUid, did: user.did }, 'getSession: issued');

    return {
      did: session.did,
      handle: session.handle,
      accessJwt: session.accessJwt,
      refreshJwt: session.refreshJwt,
    };
  }
}
