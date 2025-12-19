import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth.routes.js';
import eventRoutes from './routes/event.routes.js';
import adminRoutes from './routes/admin.routes.js';
import registrationRoutes from './routes/registration.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import waitlistRoutes from './routes/waitlist.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// Webhook routes need raw body
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

// Regular JSON parsing for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', registrationRoutes);
app.use('/api', waitlistRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/tickets', ticketRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
