const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

let redisErrorLogged = false;
redisClient.on('error', (err) => {
    if (!redisErrorLogged) {
        console.log('Redis Client Error (Note: Redis is optional for local development)', err.message);
        redisErrorLogged = true;
    }
});

const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.log('Redis not available, falling back to memory store for rate limiting and skipping cache.');
    }
};

module.exports = { redisClient, connectRedis };
