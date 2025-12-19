import { PrismaClient } from '@prisma/client';

// For Neon serverless - simple retry wrapper
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
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
