import { PrismaClient } from '@prisma/client';

// For Neon/Postgres free tier - strict connection pooling
const connectionUrl = process.env.DATABASE_URL;
const withLimit = connectionUrl && !connectionUrl.includes('connection_limit')
  ? `${connectionUrl}${connectionUrl.includes('?') ? '&' : '?'}connection_limit=5`
  : connectionUrl;

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: withLimit,
    },
  },
});

// Test connection on startup with retry
const connectWithRetry = async (retries = 5, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (err) {
      console.error(`❌ Database connection attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ Database connection failed after all retries');
        // Don't exit - let the app continue and retry on individual queries
      }
    }
  }
};

connectWithRetry();

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
