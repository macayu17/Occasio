import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;

// Only attempt Redis connection if configured
if (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost') {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('⚠️ Redis connection failed after 3 attempts, disabling Redis');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
      }
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      // Only log once, not repeatedly
      if (err.code === 'ECONNREFUSED') {
        console.warn('⚠️ Redis not available (connection refused)');
      }
    });
  } catch (error) {
    console.warn('⚠️ Redis initialization failed:', error.message);
    redisClient = null;
  }
} else {
  console.log('ℹ️ Redis not configured - running without Redis');
}

export default redisClient;
