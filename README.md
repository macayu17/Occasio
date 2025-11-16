# Event Management and Booking System

A full-stack event management platform built with MERN stack (React + Node.js + PostgreSQL) that allows organizers to create events, manage registrations, and issue QR-coded tickets.

## 🌟 Features

### Admin/Organizer Features
- 🔐 Secure authentication and authorization
- 📅 Create, edit, and delete events
- 🖼️ Upload event posters
- 📝 Build custom registration forms with drag-and-drop
- 📊 View analytics and registrations
- 💰 Track revenue and payments
- 📥 Export attendee data to CSV
- 🎫 Manage ticket distribution

### Public User Features
- 🔍 Browse and search events
- 📖 View detailed event information
- 📋 Fill dynamic registration forms
- 💳 Secure payment processing (Razorpay/Stripe)
- 📧 Receive QR-coded tickets via email
- ✅ Quick ticket verification at venue

### System Features
- 🔒 HMAC-signed QR codes for security
- 🔔 Webhook-based payment confirmation
- ⚡ Background job processing with BullMQ
- 📄 PDF ticket generation with Puppeteer
- ☁️ AWS S3 integration for file storage
- 🎨 Modern, responsive UI with Tailwind CSS

## 🛠️ Tech Stack

### Frontend
- React 18 with Vite
- Tailwind CSS
- React Router v6
- Axios
- React Hook Form
- React Hot Toast
- Lucide Icons
- date-fns

### Backend
- Node.js + Express
- PostgreSQL with Prisma ORM
- JWT Authentication
- BullMQ + Redis (job queue)
- Nodemailer (email)
- Puppeteer (PDF generation)
- QRCode generation
- Razorpay/Stripe integration
- AWS S3 (file storage)

## 📋 Prerequisites

- Node.js v18 or higher
- PostgreSQL database
- Redis server
- AWS Account (for production)
- Razorpay/Stripe account

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "Event Management and Booking System"
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
copy .env.example .env

# Update .env with your configuration

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
copy .env.example .env

# Update .env with your configuration

# Start development server
npm run dev
```

The frontend will run on `http://localhost:5173`

## 📁 Project Structure

```
Event Management and Booking System/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── server.js
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
│
└── README.md
```

## 🔑 Environment Variables

### Backend (.env)

```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/event_management
JWT_SECRET=your_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET_NAME=your_bucket_name
REDIS_HOST=localhost
REDIS_PORT=6379
QR_SECRET_KEY=your_qr_secret
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

## 📊 Database Schema

The system uses the following main entities:
- **Users** - Admin and organizer accounts
- **Events** - Event information
- **Forms** - Custom registration forms
- **Registrations** - User registrations
- **Orders** - Payment records
- **Tickets** - QR-coded tickets

## 🔄 Workflow

1. **Event Creation**: Admin creates an event with details and custom form
2. **Registration**: Users fill the form and proceed to payment
3. **Payment**: Integration with Razorpay/Stripe processes payment
4. **Webhook**: Payment confirmation triggers ticket generation
5. **Ticket Generation**: Background worker creates PDF with QR code
6. **Email Delivery**: Ticket sent to user's email
7. **Verification**: QR code scanned at venue for entry

## 🧪 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user

### Public Events
- `GET /api/events` - Get all events
- `GET /api/events/:id` - Get event details
- `GET /api/events/:id/form` - Get registration form

### Admin (Protected)
- `POST /admin/events` - Create event
- `PUT /admin/events/:id` - Update event
- `DELETE /admin/events/:id` - Delete event
- `POST /admin/events/:id/form` - Create/update form
- `GET /admin/events/:id/registrations` - Get registrations

### Registration
- `POST /events/:id/register` - Register for event
- `POST /orders/:id/create-checkout-session` - Create payment

### Webhooks
- `POST /webhooks/payments` - Payment webhook

### Tickets
- `POST /tickets/verify` - Verify QR code
- `GET /tickets/:id/pdf` - Download ticket

## 🚢 Deployment

### Deploying to Vercel

#### Option 1: Deploy Frontend and Backend Separately (Recommended)

**Backend Deployment (Railway/Render):**
1. Create account on Railway (https://railway.app) or Render (https://render.com)
2. Create new project and connect GitHub repository
3. Select backend folder
4. Add environment variables from `.env`
5. Add PostgreSQL and Redis services
6. Deploy and get backend URL

**Frontend Deployment (Vercel):**
1. Install Vercel CLI: `npm install -g vercel`
2. Navigate to frontend folder: `cd frontend`
3. Run: `vercel`
4. Follow prompts to link project
5. Add environment variables:
   ```bash
   vercel env add VITE_API_URL production
   # Enter your backend URL (e.g., https://your-app.railway.app/api)
   
   vercel env add VITE_RAZORPAY_KEY_ID production
   # Enter your Razorpay key
   ```
6. Deploy: `vercel --prod`

#### Option 2: Deploy as Monorepo (Advanced)

**Prerequisites:**
- PostgreSQL database (Neon, Supabase, or Railway)
- Redis instance (Upstash or Railway)
- AWS S3 bucket or Vercel Blob storage

**Steps:**

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Configure Backend for Vercel**

The `backend/vercel.json` is already configured. Update `backend/package.json` scripts:
```json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma migrate deploy"
  }
}
```

3. **Deploy Backend First**
```bash
cd backend
vercel

# Add environment variables
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add RAZORPAY_KEY_ID production
vercel env add RAZORPAY_KEY_SECRET production
vercel env add SMTP_HOST production
vercel env add SMTP_PORT production
vercel env add SMTP_USER production
vercel env add SMTP_PASS production
vercel env add EMAIL_FROM production
vercel env add REDIS_HOST production
vercel env add REDIS_PORT production
vercel env add AWS_ACCESS_KEY_ID production
vercel env add AWS_SECRET_ACCESS_KEY production
vercel env add S3_BUCKET_NAME production
vercel env add QR_SECRET_KEY production
vercel env add FRONTEND_URL production

# Deploy to production
vercel --prod
```

4. **Deploy Frontend**
```bash
cd ../frontend
vercel

# Add environment variables
vercel env add VITE_API_URL production
# Use your backend Vercel URL: https://your-backend.vercel.app/api

vercel env add VITE_RAZORPAY_KEY_ID production

# Deploy to production
vercel --prod
```

5. **Update CORS Settings**

After deployment, update backend's CORS to allow your frontend domain in `backend/src/server.js`.

### Alternative: Deploy Backend to Railway

**Railway is better for backend with Redis/PostgreSQL:**

1. Create Railway account: https://railway.app
2. New Project → Deploy from GitHub
3. Add PostgreSQL service
4. Add Redis service
5. Configure environment variables
6. Deploy backend
7. Get backend URL and use in frontend deployment

### Database Options

**For Production PostgreSQL:**
- **Neon** (Free tier): https://neon.tech
- **Supabase** (Free tier): https://supabase.com
- **Railway** (Paid): Built-in PostgreSQL

**For Production Redis:**
- **Upstash** (Free tier): https://upstash.com
- **Railway** (Paid): Built-in Redis

### Environment Setup Checklist

- [ ] PostgreSQL database provisioned
- [ ] Redis instance provisioned
- [ ] AWS S3 bucket created (or use Vercel Blob)
- [ ] Razorpay account and keys
- [ ] SMTP credentials (Gmail App Password)
- [ ] All environment variables added
- [ ] Database migrations run
- [ ] CORS configured
- [ ] Webhook URLs updated in Razorpay dashboard

### Post-Deployment

1. **Test Payment Flow**: Make test payment with Razorpay test keys
2. **Configure Webhooks**: Add your backend webhook URL in Razorpay dashboard
3. **Test Email**: Verify ticket delivery emails work
4. **Monitor Logs**: Check Vercel/Railway logs for errors
5. **Set up Monitoring**: Use Vercel Analytics or Sentry

### Troubleshooting Deployment

**Serverless Function Timeout:**
- Vercel has 10s limit on Hobby plan
- Move background jobs (PDF generation, emails) to separate worker
- Consider upgrading to Pro plan or use Railway for backend

**Database Connection Issues:**
- Ensure connection pooling is enabled
- Use `?connection_limit=10` in DATABASE_URL
- Check if database allows connections from Vercel IPs

**Redis Connection Issues:**
- Upstash Redis works well with Vercel
- Ensure Redis URL format is correct
- Check Redis connection limits

## 📝 Development Roadmap

- [x] Authentication system
- [x] Event CRUD operations
- [x] Form builder
- [x] Payment integration
- [x] Ticket generation
- [x] Email delivery
- [x] Admin dashboard
- [ ] Analytics dashboard
- [ ] Mobile app
- [ ] Social sharing
- [ ] Multiple ticket types
- [ ] Seat selection

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC

---
