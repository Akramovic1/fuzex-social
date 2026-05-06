import { type UsersRepository } from '@/shared/db/repositories/index.js';
import { type User } from '@/shared/db/schema.js';
import { HandleResolutionError } from '@/shared/errors/index.js';
import { parseHandle } from '@/shared/utils/index.js';

import {
  isUsernameReserved,
  validateUsernameFormat,
  type UsernameValidationFailure,
} from '../lib/index.js';

export interface UserResolverDeps {
  readonly usersRepository: UsersRepository;
  readonly handleDomain: string;
}

export interface ResolvedHandleSummary {
  readonly handle: string;
  readonly did: string;
  readonly walletAddress: string;
  readonly chain: string;
  readonly tippingEnabled: boolean;
}

const VALIDATION_FAILURE_MESSAGES: Record<UsernameValidationFailure, string> = {
  TOO_SHORT: 'username is too short',
  TOO_LONG: 'username is too long',
  INVALID_CHARSET: 'username contains invalid characters',
  STARTS_OR_ENDS_WITH_HYPHEN: 'username cannot start or end with a hyphen',
  CONSECUTIVE_HYPHENS: 'username cannot contain consecutive hyphens',
  ONLY_DIGITS: 'username cannot be all digits',
};

export class UserResolver {
  public constructor(private readonly deps: UserResolverDeps) {}

  /**
   * Resolves a Host header (or full handle) to a DID for atproto handle verification.
   *
   * Used by GET /.well-known/atproto-did.
   *
   * @param hostHeader - The request Host header (e.g., "akram.dev.fuzex.app").
   * @returns The DID string.
   * @throws HandleResolutionError if the handle is malformed or no user matches.
   */
  public async resolveHostToDid(hostHeader: string): Promise<string> {
    const username = this.parseHostToUsername(hostHeader);
    const user = await this.deps.usersRepository.findByUsername(username);
    if (user === null) {
      throw HandleResolutionError.notFound(hostHeader);
    }
    return user.did;
  }

  /**
   * Resolves a fully-qualified handle to its public summary for tipping.
   *
   * Used by GET /v1/resolve/:handle.
   *
   * @param handle - The full handle (e.g., "akram.dev.fuzex.app").
   * @returns Resolved summary suitable for the public response.
   * @throws HandleResolutionError on malformed handle, missing user, or tipping disabled.
   */
  public async resolveHandleForTipping(handle: string): Promise<ResolvedHandleSummary> {
    const username = this.parseHostToUsername(handle);
    const user = await this.deps.usersRepository.findByUsername(username);
    if (user === null) {
      throw HandleResolutionError.notFound(handle);
    }
    if (!user.tippingEnabled) {
      throw HandleResolutionError.tippingDisabled(handle);
    }
    return this.toSummary(user, handle);
  }

  private parseHostToUsername(hostOrHandle: string): string {
    const parsed = parseHandle(hostOrHandle, this.deps.handleDomain);
    if (!parsed.ok) {
      throw HandleResolutionError.invalidHandle(parsed.reason);
    }

    const username = parsed.username;

    const formatResult = validateUsernameFormat(username);
    if (!formatResult.ok) {
      throw HandleResolutionError.invalidHandle(VALIDATION_FAILURE_MESSAGES[formatResult.reason]);
    }

    if (isUsernameReserved(username)) {
      // Reserved names should never be in the DB. If somehow one is, treat as
      // not found so we don't leak existence of a reserved record.
      throw HandleResolutionError.notFound(hostOrHandle);
    }

    return username;
  }

  private toSummary(user: User, handle: string): ResolvedHandleSummary {
    return {
      handle,
      did: user.did,
      walletAddress: user.walletAddress,
      chain: user.chain,
      tippingEnabled: user.tippingEnabled,
    };
  }
}
