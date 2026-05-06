/**
 * Reserved usernames that cannot be claimed by users.
 *
 * IMPORTANT: NEVER remove entries from this list. Only add.
 * Removing a name that's been reserved for months risks letting a malicious
 * user claim a username that was previously protected (e.g., 'admin', 'support').
 */

const INFRASTRUCTURE: readonly string[] = [
  'pds',
  'api',
  'app',
  'www',
  'admin',
  'mail',
  'ftp',
  'smtp',
  'pop',
  'imap',
  'ns1',
  'ns2',
  'ns3',
  'dev',
  'staging',
  'stage',
  'prod',
  'production',
  'test',
  'testing',
  'qa',
  'cdn',
  'static',
  'media',
  'assets',
  'docs',
  'help',
  'support',
];

const ATPROTO_RESERVED: readonly string[] = [
  'did',
  'at',
  'bsky',
  'atproto',
  'firehose',
  'relay',
  'appview',
  'plc',
];

const BRAND: readonly string[] = [
  'fuzex',
  'fuzexapp',
  'fuzex_official',
  'fuzexofficial',
  'team',
  'official',
  'info',
  'contact',
  'press',
  'media',
  'careers',
  'jobs',
  'legal',
  'privacy',
  'terms',
  'about',
];

const SYSTEM: readonly string[] = [
  'null',
  'undefined',
  'none',
  'delete',
  'system',
  'root',
  'superuser',
  'sudo',
  'guest',
  'anonymous',
  'anon',
  'me',
  'self',
  'all',
  'everyone',
  'nobody',
];

const IMPERSONATION_RISK: readonly string[] = [
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'crypto',
  'wallet',
  'nft',
  'web3',
  'vitalik',
  'satoshi',
  'metamask',
  'coinbase',
  'binance',
  'usdc',
  'usdt',
];

const ACTIVITY_TYPES: readonly string[] = [
  'yoga',
  'running',
  'crossfit',
  'pilates',
  'cycling',
  'fitness',
  'workout',
  'meditation',
  'mindfulness',
];

/**
 * The complete set of reserved usernames as a Set for O(1) lookup.
 * Frozen to prevent accidental mutation at runtime.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  ...INFRASTRUCTURE,
  ...ATPROTO_RESERVED,
  ...BRAND,
  ...SYSTEM,
  ...IMPERSONATION_RISK,
  ...ACTIVITY_TYPES,
]);

/**
 * Regex patterns that match additional reserved name shapes.
 * Anything matching one of these is also rejected even if not in RESERVED_USERNAMES.
 */
export const RESERVED_PATTERNS: readonly RegExp[] = [/^admin/i, /^root/i, /^api/i, /^_+$/];

/**
 * Returns true if the username is reserved.
 * Comparison is case-INsensitive (we lowercase input first).
 *
 * @param username - The candidate username (any case).
 * @returns true if reserved, false otherwise.
 */
export function isUsernameReserved(username: string): boolean {
  const lower = username.toLowerCase();
  if (RESERVED_USERNAMES.has(lower)) {
    return true;
  }
  return RESERVED_PATTERNS.some((pattern) => pattern.test(lower));
}
