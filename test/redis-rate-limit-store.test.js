import { describe, it, expect } from 'vitest';

import { createRateLimitStore } from '../server/redis-rate-limit-store.js';

describe('Redis rate limit store fallback', () => {
  it('returns null when REDIS_URL is missing', async () => {
    const store = await createRateLimitStore({ REDIS_URL: '' });
    expect(store).toBeNull();
  });
});
