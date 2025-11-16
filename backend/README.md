# Event Management System - Backend

Backend API for Event Management and Booking System built with Node.js, Express, PostgreSQL, and Prisma.

## Features

- 🔐 JWT Authentication
- 📅 Event Management (CRUD)
- 📝 Custom Registration Forms
- 💳 Payment Integration (Razorpay/Stripe)
- 🎟️ QR Ticket Generation
- 📧 Email Notifications
- 🔄 Background Job Processing
- ☁️ AWS S3 Integration

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Queue**: BullMQ + Redis
- **Payment**: Razorpay
- **Email**: Nodemailer
- **PDF Generation**: Puppeteer
- **QR Code**: qrcode
- **Storage**: AWS S3

## Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL
- Redis (for background jobs)
- AWS Account (for production)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
copy .env.example .env
```

3. Update `.env` with your configuration

4. Generate Prisma Client:
```bash
npm run prisma:generate
```

5. Run database migrations:
```bash
npm run prisma:migrate
```

6. Start development server:
```bash
npm run dev
```

## Environment Variables

See `.env.example` for all required environment variables.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Public Events
- `GET /api/events` - Get all published events
- `GET /api/events/:id` - Get event details
- `GET /api/events/:id/form` - Get event registration form

### Admin (Protected)
- `POST /api/admin/events` - Create event
- `PUT /api/admin/events/:id` - Update event
- `DELETE /api/admin/events/:id` - Delete event
- `POST /api/admin/events/:id/poster-upload` - Upload poster
- `POST /api/admin/events/:id/form` - Create/update form
- `GET /api/admin/events/:id/registrations` - Get registrations

### Registration & Payment
- `POST /api/events/:id/register` - Register for event
- `POST /api/orders/:id/create-checkout-session` - Create payment session

### Webhooks
- `POST /api/webhooks/payments` - Razorpay webhook

### Tickets
- `POST /api/tickets/verify` - Verify ticket QR code
- `GET /api/tickets/:id/pdf` - Download ticket PDF

## Database Schema

The database schema is defined in `prisma/schema.prisma` and includes:
- Users
- Events
- Forms
- Registrations
- Orders
- Tickets

## Background Jobs

The system uses BullMQ for background processing:
- Ticket generation
- Email sending

## Security

- JWT-based authentication
- HMAC-signed QR codes
- Payment webhook verification
- Rate limiting
- Helmet security headers
- Input validation

## Development

```bash
# Run in development mode
npm run dev

# Access Prisma Studio
npm run prisma:studio

# Run migrations
npm run prisma:migrate
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production database
3. Set up Redis instance
4. Configure AWS S3
5. Set up payment gateway webhooks
6. Deploy to your preferred platform (AWS, Render, Railway, etc.)

## License

ISC
