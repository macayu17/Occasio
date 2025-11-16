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

### Backend Deployment
- Deploy to Railway, Render, or AWS EC2
- Set up PostgreSQL and Redis instances
- Configure environment variables
- Set up AWS S3 bucket

### Frontend Deployment
- Deploy to Vercel or Netlify
- Update API URL in environment variables

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
