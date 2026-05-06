import { afterAll, describe, expect, it } from '@jest/globals';

import { createTestDb } from '@/shared/testing/testDb.js';

import { pingDatabase } from './healthCheck.js';

describe('pingDatabase', () => {
  const handle = createTestDb();

  afterAll(async () => {
    await handle.close();
  });

  it('returns true when the connection is healthy', async () => {
    const result = await pingDatabase(handle.db);
    expect(result).toBe(true);
  });
});
