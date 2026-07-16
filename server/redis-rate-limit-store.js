const logger = require('./logger');
const { createRedisClient, hasRedisUrl } = require('./redis');

let storeModulePromise = null;

async function loadRedisStoreCtor() {
  if (!storeModulePromise) {
    storeModulePromise = import('rate-limit-redis');
  }
  const mod = await storeModulePromise;
  return mod.RedisStore || (mod.default && mod.default.RedisStore) || mod.default;
}

async function createRateLimitStore(config) {
  if (!hasRedisUrl(config)) return null;
  try {
    const client = await createRedisClient({ REDIS_URL: config.REDIS_URL }, 'rate-limit');
    const RedisStoreCtor = await loadRedisStoreCtor();
    if (!RedisStoreCtor) {
      logger.warn('rate_limit.redis_store_ctor_missing');
      return null;
    }
    return {
      create(prefix) {
        return new RedisStoreCtor({
          prefix: prefix || 'rl:',
          sendCommand() {
            return client.sendCommand(Array.prototype.slice.call(arguments));
          },
        });
      },
      async close() {
        try {
          await client.quit();
        } catch (quitErr) {
          logger.warn('rate_limit.redis_client_close_failed', { message: quitErr.message });
        }
      },
    };
  } catch (err) {
    logger.warn('rate_limit.redis_store_disabled', { message: err.message });
    return null;
  }
}

module.exports = { createRateLimitStore };
