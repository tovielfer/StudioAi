import * as crypto from 'crypto';

/** Prefix that identifies a vookapix personal API token. */
export const API_TOKEN_PREFIX = 'vpx_';

/**
 * Generates a new personal API token. Returns the raw token (shown to the user
 * exactly once), its SHA-256 hash (stored in the DB), and a short non-secret
 * display prefix for the UI.
 */
export function generateApiToken(): {
  token: string;
  hash: string;
  displayPrefix: string;
} {
  const secret = crypto.randomBytes(32).toString('hex');
  const token = `${API_TOKEN_PREFIX}${secret}`;
  return {
    token,
    hash: hashApiToken(token),
    displayPrefix: `${token.slice(0, 12)}…`,
  };
}

/** Hashes a raw token so it can be compared against the stored hash. */
export function hashApiToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
