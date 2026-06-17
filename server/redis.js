const logger = require('./logger');

let redisModulePromise = null;

function hasRedisUrl(config) {
  return !!(config && config.REDIS_URL);
}

async function loadRedisModule() {
  if (!redisModulePromise) {
    redisModulePromise = import('redis');
  }
  return redisModulePromise;
}

async function createRedisClient(config, purpose) {
  if (!hasRedisUrl(config)) return null;
  const redis = await loadRedisModule();
  const client = redis.createClient({
    url: config.REDIS_URL,
    socket: {
      reconnectStrategy: function (retries) {
        return Math.min(retries * 100, 2000);
      },
    },
  });
  client.on('error', function (err) {
    logger.warn('redis.client_error', { purpose, message: err && err.message ? err.message : String(err) });
  });
  await client.connect();
  logger.info('redis.connected', { purpose });
  return client;
}

module.exports = {
  createRedisClient,
  hasRedisUrl,
};
